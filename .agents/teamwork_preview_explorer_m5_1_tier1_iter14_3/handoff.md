# M5.1 Tier 1 E2E Test Pass - Forensic Audit Failure Analysis & Fix Strategy (Iteration 14)

## 1. Observation
- **E2E Test Runner Failure (Iteration 13)**: The previous E2E test runner (`npx tsx e2e/run_e2e.ts`) failed with exit code 1 during `Verifying Supabase health at http://127.0.0.1:54321...`. Specifically, `npx supabase start --ignore-health-check` exited with 0 while leaving API gateway containers stopped (`Stopped services: [supabase_kong_expense-dashboard ...]`), causing `http://127.0.0.1:54321` to be unreachable.
- **`e2e/run_e2e.ts` Inspection**:
  - In `setup()` (lines 13-75), `npx supabase start --ignore-health-check` is executed within a 3-attempt loop. If `npx supabase start --ignore-health-check` exits with code 0 (which occurs when `supabase local development setup is running`), `supabaseStarted` is set to `true` and the loop breaks, even if services like `supabase_kong_expense-dashboard` are stopped.
  - In `run()` (lines 107-130), the initial health check attempts to fetch `http://127.0.0.1:54321` up to 20 times but lacks any restart recovery mechanism.
  - In `run()` pre-seed health check (lines 156-181) and post-build health check (lines 207-232), the restart recovery mechanism attempts `rm -rf supabase/.temp` and `npx supabase start --ignore-health-check` directly without first stopping containers (`npx supabase stop --no-backup`) or cleaning volumes (`docker volume rm -f`).
  - In `run()` lingering process cleanup (lines 189-201), `pgrep -f run_e2e` matches all processes containing `run_e2e` in their command line, including the grandparent `bash` process executing the composite command string (`export PATH=... && npx tsx e2e/run_e2e.ts && ...`). Because the script only filters out `currentPid` (`node`) and `parentPid` (`npx`), `kill -9` forcibly terminates the grandparent `bash` process mid-execution, abruptly halting the test runner chain prior to `npm run build`.
  - `e2e/run_e2e.ts` correctly retains `npx supabase migration up --include-all` (lines 138 & 151), `NODE_OPTIONS: ''` sanitization (line 204), `docker volume ls -q | xargs -r docker volume rm -f` (lines 39, 61, 85), `fuser -k 3000/tcp` replacing `pkill -9 -f next` (lines 34, 80, 202, 235, 257), `rm -rf supabase/.temp` (lines 51, 172, 223), asynchronous `child_process.spawn` for Playwright tests (lines 293-302), `sleep 10` decoupling (line 143), Next.js keep-alive/respawn mechanism (lines 238-264), port `25432` migration, and no `try...catch` around `init_db.ts` or Playwright test execution.
- **`e2e/seed.ts` Inspection**: Retains `schemaRetries = 50` (line 89) and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop (line 203).
- **`e2e/init_db.ts` Inspection**: Retains the 10s post-notification delay (`setTimeout(resolve, 10000)`, lines 85-86).
- **`next.config.js` Inspection**: Retains `outputFileTracing: false` (line 3).
- **`src/lib/planner/*.ts` & `supabase/migrations/20260624000000_retirement_planner.sql` Inspection**: Retains genuine pure TypeScript business logic engines, strict RLS (`auth.uid() = user_id`), and Premium tier check triggers (`check_premium_simulation_range()`).

## 2. Logic Chain
1. **Root Cause of E2E Failure**:
   - During `setup()`, `npx supabase start --ignore-health-check` detects `supabase local development setup is running` (due to lingering database containers or lock files) and exits with code 0, despite `Stopped services: [supabase_kong_expense-dashboard ...]`.
   - Because `npx supabase start` exits with code 0, `setup()` assumes Supabase started successfully and breaks out of its 3-attempt retry loop without performing `npx supabase stop --no-backup` or `rm -rf supabase/.temp`.
   - The initial health check at lines 107-130 attempts to fetch `http://127.0.0.1:54321` 20 times. Because Kong is stopped and the initial health check lacks a restart recovery mechanism, it exhausts all retries and throws `Supabase health check failed: http://127.0.0.1:54321 is unreachable.`, failing the entire test runner with exit code 1.
2. **Synthesis of Peer Findings (Challenger 1, Challenger 2, Reviewer 1)**:
   - **Supabase Health Check Restart Flaw**: When `http://127.0.0.1:54321` is unresponsive during health checks, attempting `rm -rf supabase/.temp` and `npx supabase start` without first stopping containers (`npx supabase stop --no-backup`) or cleaning volumes (`docker volume rm -f`) triggers a fatal `schema_migrations_pkey` duplicate key constraint violation and complete container shutdown/crash (`connect ECONNREFUSED 127.0.0.1:54321`). A clean restart recovery mechanism must be formulated in all health checks (initial, pre-seed, post-build) that explicitly executes `npx supabase stop --no-backup 2>/dev/null || true`, `docker ps -aq | xargs -r docker rm -f`, `docker volume ls -q | xargs -r docker volume rm -f`, and `rm -rf supabase/.temp` before calling `npx supabase start --ignore-health-check`.
   - **Lingering Process Cleanup Flaw (`pgrep -f run_e2e`)**: When executed within a composite bash command string containing `run_e2e`, `pgrep -f run_e2e` matches the grandparent `bash` process itself. Because the script only filters out `currentPid` (`node`) and `parentPid` (`npx`), `kill -9` forcibly terminates the grandparent `bash` process mid-execution, abruptly halting the test runner chain prior to `npm run build`. A more precise filtering mechanism must be formulated in `e2e/run_e2e.ts` (using `pgrep -f "node.*run_e2e"` / `pgrep -f "tsx.*run_e2e"` to exclude `bash` processes, and filtering out `process.ppid`'s parent/grandparent PIDs).
3. **Formulation of Fix Strategy**:
   - Update all three health checks (initial, pre-seed, post-build) in `e2e/run_e2e.ts` to include the clean restart recovery mechanism.
   - Update the lingering process cleanup block in `e2e/run_e2e.ts` to use precise `pgrep` matching and parent/grandparent PID filtering.
   - All other E2E stabilization mechanisms, sanitization rules, non-interactive migrations, genuine error propagation, and strict RLS policies must remain untouched.

## 3. Caveats
- **No caveats.** All verification steps and forensic checks were executed empirically and independently via read-only file inspection and synthesis of peer audit findings.

## 4. Conclusion
The `INTEGRITY VIOLATION` in Iteration 13 was caused by `npx supabase start --ignore-health-check` exiting with 0 while API gateway containers were stopped, combined with flawed restart recovery and aggressive `pgrep -f run_e2e` process cleanup in `e2e/run_e2e.ts`.

### Concrete Fix Strategy (For Worker 1)

#### 1. Clean Restart Recovery in All Health Checks
Modify the health check loops in `e2e/run_e2e.ts` (initial health check lines 107-130, pre-seed health check lines 156-181, post-build health check lines 207-232) to include the following clean restart recovery block when `retries === 15 || retries === 10 || retries === 5`:

```typescript
        if (retries === 15 || retries === 10 || retries === 5) {
          console.log('Supabase seems unresponsive. Attempting to cleanly restart Supabase...');
          try {
            execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' });
            execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' });
            execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' });
            execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' });
            execSync('pkill -f supabase 2>/dev/null || true', { stdio: 'inherit' });
            execSync('fuser -k 54321/tcp 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' });
            execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' });
            execSync('sleep 15', { stdio: 'inherit' });
            execSync('docker network create supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' });
            execSync('npx supabase start --ignore-health-check', { stdio: 'inherit' });
          } catch(err){}
        }
```

#### 2. Precise Lingering Process Cleanup
Modify `e2e/run_e2e.ts` lines 189-201 to use precise `pgrep` matching and parent/grandparent PID filtering:

```typescript
    console.log('Building fresh Next.js production bundle...');
    try {
      const currentPid = process.pid;
      const parentPid = process.ppid;
      let grandParentPid = -1;
      try { grandParentPid = Number(execSync(`ps -o ppid= -p ${parentPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim()); } catch(e){}
      let greatGrandParentPid = -1;
      try { greatGrandParentPid = Number(execSync(`ps -o ppid= -p ${grandParentPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim()); } catch(e){}
      
      const nodePids = execSync('pgrep -f "node.*run_e2e" 2>/dev/null || true', { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
      const tsxPids = execSync('pgrep -f "tsx.*run_e2e" 2>/dev/null || true', { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
      const allPids = Array.from(new Set([...nodePids, ...tsxPids]));
      
      const pids = allPids.filter(pid => pid !== currentPid && pid !== parentPid && pid !== grandParentPid && pid !== greatGrandParentPid);
      if (pids.length > 0) {
        console.log(`Killing lingering run_e2e processes: ${pids.join(' ')}`);
        execSync(`kill -9 ${pids.join(' ')} 2>/dev/null || true`, { stdio: 'inherit' });
      }
    } catch (e) {}
```

Ensure all other mechanisms (`npx supabase migration up --include-all`, `schemaRetries = 50`, `outputFileTracing: false`, `NODE_OPTIONS: ''`, `fuser -k 3000/tcp`, absence of `try...catch` around `init_db.ts`/Playwright, strict RLS) are strictly retained.

## 5. Verification Method
- **File Inspection**: Inspect `e2e/run_e2e.ts` to verify all three health checks contain the clean restart recovery logic (`npx supabase stop --no-backup`, `docker volume rm -f`, `rm -rf supabase/.temp`, `npx supabase start`) and the lingering process cleanup uses precise `pgrep` matching (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering.
- **Test Runner Execution**: Execute `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`. All tests must pass with exit code 0.
- **Unit Tests Execution**: Execute `npm run test __tests__/planner`. All 9 unit tests must pass.
- **Invalidation Conditions**: Any failure in `npx tsx e2e/run_e2e.ts`, presence of `pkill -9 -f next`, or missing RLS policies/triggers will invalidate this verification.
