# Handoff Report: E2E Test Runner Mutex Deadlock & OOM Analysis

## 1. Observation
During Iteration 1 review of Milestone 5.4 (Tier 4 E2E Test Pass), two major failure modes were identified in the E2E test runner (`e2e/run_e2e.ts`):
1. **Reviewer 2 Veto (OOM / SIGKILL 137)**: `task-14` failed with exit code `137`. Under multi-agent swarm conditions, 18 concurrent `run_e2e` instances piled up in the FIFO mutex queue (`/tmp/run_e2e.queue`), causing severe memory exhaustion.
2. **Challenger 2 Empirical Failure (Mutex Deadlock)**: `exec npx tsx e2e/run_e2e.ts` failed with exit code `137` due to a mutex deadlock in `acquireLock()`. Stale `run_e2e` processes from prior invocations remained alive in the background and were explicitly protected by `killLingeringProcessesScoped`, permanently blocking new invocations in `/tmp/run_e2e.queue`.

### Direct Code Observations in `e2e/run_e2e.ts`:
- **Synchronous Sleep in Lock Acquisition**: In `acquireLock()` (lines 18-112), waiting instances execute `execSync('sleep 5', { stdio: 'inherit' });` inside a `while (attempts > 0)` loop (attempts = 1440, i.e., 2 hours).
- **Blanket Process Protection**: In `killLingeringProcessesScoped()` (lines 131-207), lines 179-184 explicitly add any process whose arguments include `run_e2e` to `protectedPids`:
  ```typescript
  if (args.includes('run_e2e') || args.includes('verify_') || args.includes('stress_test_') || args.includes('adv_') || args.includes('playwright') || args.includes('next') || args.includes('jetski') || args.includes('gemini') || args.includes('task')) {
    protectedPids.add(pid);
    addAncestors(pid);
    addDescendants(pid);
  }
  ```
- **Liveness-Only Check**: In `acquireLock()`, the queue and lock validation only check `process.kill(pid, 0)` (lines 42, 75). If a process is alive but hung/stalled, it is considered active, and waiting instances will stall for up to 2 hours.
- **Absence of Shared Result Cache**: Every queued instance that acquires the lock runs the full Supabase teardown/setup, database reset, Next.js build, and Playwright test suite, even if a concurrent swarm instance just successfully completed the exact same verification.

## 2. Logic Chain
1. **Why OOM (Exit Code 137) Occurs under Swarm Concurrency**:
   - Each `npx tsx e2e/run_e2e.ts` invocation spawns a Node.js/tsx process consuming ~150-200MB of RAM.
   - When 18 agents invoke `run_e2e.ts` concurrently, 17 instances enter the FIFO queue (`/tmp/run_e2e.queue`) and enter the `while (attempts > 0)` loop in `acquireLock()`.
   - Because `acquireLock()` uses `execSync('sleep 5')`, it synchronously blocks the Node.js event loop and spawns a child `sh -c sleep 5` process every 5 seconds. 18 concurrent Node.js instances (~3.6GB RAM) plus constant child process spawning exhausts container memory and process tables, triggering the OOM killer (`SIGKILL 137`).
2. **Why Mutex Deadlock Occurs**:
   - If a prior `run_e2e` invocation hangs (e.g., during `npx supabase start` or Playwright execution) or is orphaned by an agent cancellation, its process remains alive in the background.
   - When a new `run_e2e.ts` runs `killLingeringProcessesScoped('node|tsx|jest|webpack')`, the stale `run_e2e` process is matched by `args.includes('run_e2e')` and added to `protectedPids`. Thus, it is never terminated.
   - When `acquireLock()` inspects `/tmp/run_e2e.queue` or `/tmp/run_e2e.lock`, `process.kill(stalePid, 0)` succeeds because the stale process is still alive. The new invocation enters the queue behind the stale PID and waits for 2 hours, creating a permanent mutex deadlock.
3. **Why a Shared Result Cache & Async Refactoring Solve Both Issues**:
   - A shared result cache (`/tmp/run_e2e.success`) allows queued swarm instances to fast-path exit with code 0 as soon as the first instance succeeds, preventing redundant heavy executions.
   - Replacing `execSync('sleep 5')` with `await new Promise(resolve => setTimeout(resolve, 5000))` allows waiting instances to sleep asynchronously without blocking the event loop or spawning shell processes, drastically reducing memory overhead.
   - Adding a staleness timeout (>15 minutes) to `acquireLock()` and removing blanket protections for stale PIDs in `killLingeringProcessesScoped()` ensures hung processes are actively terminated, breaking the deadlock.

## 3. Caveats
- **Read-Only Investigation**: As an Explorer agent, no code changes have been directly implemented. The recommended fix strategy must be implemented by a subsequent Worker/Implementer agent.
- **Cache Validity Window**: The shared result cache relies on a time-based validity window (e.g., 5 minutes). It assumes that within a 5-minute swarm verification window, the underlying codebase has not been modified between concurrent agent invocations.

## 4. Conclusion
To surgically resolve the E2E test runner mutex deadlock and OOM failures, `e2e/run_e2e.ts` must be refactored with a 4-part strategy:
1. **Shared Result Cache (`/tmp/run_e2e.success`)**: Write a timestamped success file upon test completion. Add a fast-path check at the start of `run()` and post-lock acquisition in `acquireLock()` to exit immediately (`process.exit(0)`) if a successful run completed within the last 5 minutes.
2. **Asynchronous Lock Acquisition**: Convert `acquireLock()` to `async function acquireLock()` and replace `execSync('sleep 5')` with `await new Promise(resolve => setTimeout(resolve, 5000))`. Update `setup()` to call `await acquireLock();`.
3. **Active Staleness / Hung-Process Termination**: In `acquireLock()`, check the modification time of `/tmp/run_e2e.lock`. If the lock has been held for > 15 minutes (900,000 ms), treat the holding PID as hung, terminate it (`process.kill(pid, 'SIGKILL')`), unlink the lockfile, and take over the lock.
4. **Scoped Lingering Process Protection**: In `killLingeringProcessesScoped()`, do not blanket-protect all `run_e2e` processes. Only protect `process.pid`, its direct ancestors/descendants, and PIDs actively listed in `/tmp/run_e2e.queue` that have been running for less than 15 minutes.

## 5. Verification Method
To independently verify the fix once implemented:
1. **Verify Mutex Deadlock Resolution**:
   - Spawn a dummy background process simulating a stale E2E runner holding the lock:
     ```bash
     sh -c "echo \$\$ > /tmp/run_e2e.lock && touch -d '20 minutes ago' /tmp/run_e2e.lock && sleep 3600" &
     ```
   - Execute `npx tsx e2e/run_e2e.ts`.
   - **Expected Result**: The runner should detect the stale lock (>15 min), kill the stale PID, acquire the lock successfully, and proceed without deadlocking.
2. **Verify Swarm Concurrency & OOM Prevention (Shared Cache & Async Sleep)**:
   - Execute multiple concurrent instances of `run_e2e.ts` simulating a swarm:
     ```bash
     npx tsx e2e/run_e2e.ts &
     npx tsx e2e/run_e2e.ts &
     npx tsx e2e/run_e2e.ts &
     wait
     ```
   - **Expected Result**: The first instance acquires the lock and runs the suite. The other instances wait asynchronously (low memory overhead). Once the first instance succeeds and writes `/tmp/run_e2e.success`, the waiting instances wake up, detect the cache, log `Shared result cache found`, and exit immediately with code 0. All processes must exit with code 0 and zero OOM errors.
