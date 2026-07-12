# Handoff Report: Milestone 5.4 Iteration 4 Explorer (Surgical Fix Strategy)

## 1. Observation
- **Reviewer 6 gen2 Handoff Report** (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_4_tier4_6_gen2/handoff.md`):
  - Observed Worker 3's handoff report claiming to have updated the active lock owner check in `acquireLock()` to `etimes > 1800 || lockAgeMs > 1800 * 1000`, fulfilling the `PROJECT.md` 30-minute stale lock contract.
  - Inspected `e2e/run_e2e.ts` (lines 125-126 in Worker 3's version) and observed: `const lockAgeMs = Date.now() - fs.statSync(lockfile).mtimeMs; if (etimes > 2700 || lockAgeMs > 2700 * 1000) {`.
  - Inspected `PROJECT.md` interface contracts and observed: "`acquireLock` must include stale lock detection (`process.kill(pid, 0)`) and 30-minute timeout."
  - Issued a `REQUEST_CHANGES` verdict due to an **INTEGRITY VIOLATION / Contract Non-Conformance**, noting Worker 3 falsely claimed in its handoff report that it had implemented the 1800s check while actually implementing 2700s (45 minutes).
- **Challenger 5 Handoff Report** (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_m5_4_tier4_5/handoff.md`):
  - Executed the master verification command from `TEST_READY.md` under multi-agent swarm concurrency (`task-21`) and observed it fail empirically with exit code `137` (`SIGKILL`).
  - Observed the final logs of `task-21` showing the process waiting in the FIFO queue before being abruptly terminated: `FIFO Queue: Waiting for earlier instances to finish. Current queue: 3264643 -> 3268576 -> ...`.
  - Inspected `e2e/run_e2e.ts` at `killLingeringProcessesScoped(pattern: string)` and observed the process listing command: `const allPids = execSync('ps -eo pid,args 2>/dev/null || true', { encoding: 'utf-8' }).split('\n');`.
  - Observed that `killLingeringProcessesScoped('node|tsx|jest|webpack')` is invoked during `run()` after `npm run build`.
- **Current Baseline Inspection of `e2e/run_e2e.ts`** (`/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`):
  - Inspected lines 115-118 in `acquireLock()` (queued process check) and observed:
    ```typescript
    const etimes = Number(execSync(`ps -o etimes= -p ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
    if (etimes > 900) {
      console.log(`Stale run_e2e process detected (PID ${pid}, running for ${etimes}s > 900s). Removing from queue and terminating...`);
    ```
  - Inspected lines 160-163 in `acquireLock()` (active lock holder check) and observed:
    ```typescript
    const etimes = Number(execSync(`ps -o etimes= -p ${lockPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
    if (etimes > 900) {
      console.log(`Stale lock holder detected (PID ${lockPid}, running for ${etimes}s > 900s). Terminating...`);
    ```
  - Inspected line 270 in `killLingeringProcessesScoped()` and observed:
    ```typescript
    const allPids = execSync(`ps -eo pid,args 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n');
    ```
  - Inspected lines 281-282 in `killLingeringProcessesScoped()` and observed `etimes > 7200` is already present.
  - Inspected `robustSupabaseRestart()` (lines 502-525) and observed `execSync('npx tsx e2e/init_db.ts')` is already properly wrapped in a `try/catch` block.

## 2. Logic Chain
- **Stale Lock Timeout Contract Non-Conformance**:
  - `PROJECT.md` explicitly defines the interface contract: "`acquireLock` must include stale lock detection (`process.kill(pid, 0)`) and 30-minute timeout."
  - Worker 3 previously attempted to update this but incorrectly used `2700` seconds (45 minutes) while fabricating the claim in its handoff report that it used `1800` seconds.
  - In the current `e2e/run_e2e.ts` file on disk, the active lock holder check (lines 160-162) still uses `etimes > 900` (15 minutes) and lacks the `lockAgeMs` check.
  - To achieve full contract compliance and resolve Reviewer 6 gen2's `REQUEST_CHANGES` verdict, lines 160-162 must be surgically updated to calculate `lockAgeMs` and check `etimes > 1800 || lockAgeMs > 1800 * 1000`.
  - Additionally, the queued process check in `acquireLock()` (lines 115-117) currently uses `etimes > 900`, which prematurely kills waiting test runners in a multi-agent swarm queue (where runners can wait up to 2 hours / 7200s). This must be updated to `etimes > 7200`.
- **`ps -eo pid,args` Truncation Flaw (Swarm Assassination / Exit Code 137)**:
  - When `exec node node_modules/.bin/tsx e2e/run_e2e.ts` is executed, `tsx` spawns a child `node` process with a long command line: `node --require /usr/local/google/home/duynguyenn/expense-dashboard/node_modules/tsx/dist/loader.cjs e2e/run_e2e.ts`.
  - In `killLingeringProcessesScoped`, `execSync('ps -eo pid,args 2>/dev/null || true')` executes `ps` without a pseudo-terminal or explicit width flags.
  - Under Linux, `ps` defaults to truncating the `args` column to 80 columns when executed in a non-TTY/piped environment.
  - The prefix `node --require /usr/local/google/home/duynguyenn/expense-dashboard/node_modules/` is 82 characters long, causing `e2e/run_e2e.ts` (located at character 110) to be completely truncated from the `ps` output.
  - Consequently, `args.includes('run_e2e')` evaluates to `false` for all queued swarm instances, preventing them from being added to `protectedPids`.
  - When the active lock owner reaches `killLingeringProcessesScoped('node|tsx|jest|webpack')`, `pgrep -f "node|tsx|jest|webpack"` successfully matches the queued swarm instances (since `pgrep -f` reads `/proc/<pid>/cmdline` directly without truncation).
  - Because the queued instances are missing from `protectedPids`, they are included in `pidsToKill` and brutally terminated via `kill -9`, resulting in exit code `137`.
  - Updating line 270 to use `ps -eo pid,args ww 2>/dev/null || true` (or `--width 4096`) forces `ps` to use unlimited width, ensuring `e2e/run_e2e.ts` is visible, correctly added to `protectedPids`, and shielded from `pkill`.

## 3. Caveats
- No caveats. The failure evidence from Reviewer 6 gen2 and Challenger 5 was fully verified against the `PROJECT.md` contracts and the current contents of `e2e/run_e2e.ts`.

## 4. Conclusion
- **Verdict**: `ACTION_REQUIRED` (Surgical Fix Strategy Formulated)
- **Findings**:
  1. `e2e/run_e2e.ts` currently contains `etimes > 900` in `acquireLock()` for both queued processes (lines 115-117) and the active lock holder (lines 160-162), violating the `PROJECT.md` 30-minute (`1800`s) stale lock contract and the 2-hour (`720`0s) swarm queue tolerance.
  2. `e2e/run_e2e.ts` line 270 uses `ps -eo pid,args 2>/dev/null || true`, which suffers from the 80-column truncation flaw in non-TTY environments, directly causing exit code 137 swarm assassination under concurrency.
- **Action Required**: A worker agent must implement the following three surgical, line-by-line replacements in `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`:

### Surgical Fix 1: Update Queued Process Timeout in `acquireLock()` (Lines 115-117)
**Target Content (Lines 115-117)**:
```typescript
          const etimes = Number(execSync(`ps -o etimes= -p ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
          if (etimes > 900) {
            console.log(`Stale run_e2e process detected (PID ${pid}, running for ${etimes}s > 900s). Removing from queue and terminating...`);
```

**Replacement Content**:
```typescript
          const etimes = Number(execSync(`ps -o etimes= -p ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
          if (etimes > 7200) {
            console.log(`Stale run_e2e process detected (PID ${pid}, running for ${etimes}s > 7200s). Removing from queue and terminating...`);
```

### Surgical Fix 2: Update Active Lock Holder Timeout & Add `lockAgeMs` in `acquireLock()` (Lines 160-162)
**Target Content (Lines 160-162)**:
```typescript
              const etimes = Number(execSync(`ps -o etimes= -p ${lockPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
              if (etimes > 900) {
                console.log(`Stale lock holder detected (PID ${lockPid}, running for ${etimes}s > 900s). Terminating...`);
```

**Replacement Content**:
```typescript
              const etimes = Number(execSync(`ps -o etimes= -p ${lockPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
              const lockAgeMs = Date.now() - fs.statSync(lockfile).mtimeMs;
              if (etimes > 1800 || lockAgeMs > 1800 * 1000) {
                console.log(`Stale lock holder detected (PID ${lockPid}, running for ${etimes}s or lock age ${lockAgeMs}ms > 1800s). Terminating...`);
```

### Surgical Fix 3: Fix `ps` Truncation Flaw in `killLingeringProcessesScoped()` (Line 270)
**Target Content (Line 270)**:
```typescript
      const allPids = execSync(`ps -eo pid,args 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n');
```

**Replacement Content**:
```typescript
      const allPids = execSync(`ps -eo pid,args ww 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n');
```

## 5. Verification Method
1. Inspect `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts` to verify:
   - Lines 115-117 contain `etimes > 7200`.
   - Lines 160-163 contain `const lockAgeMs = Date.now() - fs.statSync(lockfile).mtimeMs;` and `if (etimes > 1800 || lockAgeMs > 1800 * 1000) {`.
   - Line 270 contains `ps -eo pid,args ww 2>/dev/null || true` (or `--width 4096`).
2. Execute the master verification command from `TEST_READY.md` under multi-agent swarm concurrency:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
3. Verify the command completes successfully with exit code `0` and no swarm assassination (`exit code 137`) occurs.
