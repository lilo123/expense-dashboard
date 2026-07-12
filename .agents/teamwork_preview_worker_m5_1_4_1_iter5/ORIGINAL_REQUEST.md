## 2026-07-07T23:29:45Z

You are Worker 1 (`teamwork_preview_worker`) for Milestone 5.4 Iteration 5 (M5.4: Tier 4 E2E Test Pass - Real-World Application Scenarios) for the Next.js retirement calculator expansion at `/usr/local/google/home/duynguyenn/expense-dashboard`.
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_4_1_iter5`.
Your identity is `teamwork_preview_worker_m5_1_4_1_iter5`.

## Domain Skill
Load and follow the domain skill at:
`/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

## MANDATORY INTEGRITY WARNING
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Task Description & Fix Strategy
Previous verification swarm agents and Explorers 14 & 15 uncovered 5 critical vulnerabilities and INTEGRITY VIOLATIONS in `e2e/run_e2e.ts`. You must implement the following concrete, verified fix strategy in `e2e/run_e2e.ts` to achieve full contract conformance and eliminate OOM/concurrency bugs without circumventing the audit or disabling rules:

1. **Fix `ps` Truncation (Exit Code 137)**: `ps -eo pid,args --width 4096` truncates long command lines, hiding `run_e2e.ts` from `protectedPids`. In `killLingeringProcessesScoped`, add an explicit `pgrep -f` check to populate `protectedPids`:
   ```typescript
   try {
     const pgrepPids = execSync(`pgrep -f "run_e2e|verify_|stress_test_|adv_|playwright|next|jetski|gemini|task" 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n');
     for (const line of pgrepPids) {
       const pid = Number(line.trim());
       if (!isNaN(pid) && pid > 0) {
         protectedPids.add(pid);
         addAncestors(pid);
         addDescendants(pid);
       }
     }
   } catch (e) {}
   ```

2. **Fix `healthMonitorInterval` Race Condition**: Leaking intervals on retry, concurrent `fetch` piling up, and dual teardown collision where `pwProcess.kill('SIGKILL')` triggers `pwProcess.on('close')` which rejects the promise and calls a second `robustSupabaseRestart()` concurrently with the one in the interval callback.
   - Wrap the Playwright execution promise in a `try...finally` block to guarantee `clearInterval(healthMonitorInterval)`.
   - Remove `robustSupabaseRestart()` from the `healthMonitorInterval` callback entirely. Allow `pwProcess.kill('SIGKILL')` to reject the promise and let the main `while` loop's `catch` block handle the restart cleanly.

3. **Fix Fabricated Claims in `acquireLock()`**: `maxWaitMs = 15 * 60 * 1000` (15 minutes) breaks out and forcefully overwrites `lockfile` (`fs.writeFileSync`), faking lock acquisition.
   - Align `maxWaitMs` with `PROJECT.md` by setting it to `30 * 60 * 1000` (30 minutes).
   - Replace `fs.existsSync(lockfile)` / `fs.writeFileSync` with atomic `fs.openSync(lockfile, 'wx')` (or equivalent atomic check) to eliminate TOCTOU.
   - Replace the forceful lock override at the end of `acquireLock()` with `throw new Error('Failed to acquire mutex lock after 30 minutes. Aborting to prevent concurrent collision.');`.

4. **Fix `etimes > 2700` Contract Conformance**: `run_e2e.ts` checks `etimes > 900` (15 minutes) in three separate locations (lines 118, 163, 284), killing valid long-running test runners. Change `etimes > 900` to `etimes > 2700` at all three locations in `e2e/run_e2e.ts`.

5. **Maintain Cache Bypass Absence**: Ensure `/tmp/run_e2e.success.permanent.cache` remains completely absent from the codebase.

## Verification & Handoff
1. Implement these surgical fixes in `e2e/run_e2e.ts`.
2. Execute `npm test` and the master E2E test runner command mandated by `TEST_READY.md`:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsx e2e/verify_global_market_data.ts
   npx tsx e2e/verify_accumulation.ts
   npx tsx e2e/verify_monte_carlo.ts
   npx tsx e2e/verify_tier3_combinations.ts
   npx tsx e2e/stress_test_m4.ts
   npx tsx e2e/stress_test_m4_edge_cases.ts
   npx tsx e2e/adv_planner_gaps.ts
   node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
3. Verify that all tests pass across all 5 browser projects (`chromium`, `firefox`, `webkit`, `mobile-chrome`, `mobile-safari`) with exit code 0.
4. Write your completion report (`handoff.md`) in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_4_1_iter5`) and send a completion message to me (your parent).

## 2026-07-07T23:39:58Z

**Context**: M5.4 Tier 4 E2E Test Pass (Real-World Application Scenarios) - Iteration 5 Worker 1 Proposed Drop-in Replacement
**Content**: Explorer 13 Iteration 5 (`8d706ebe-a124-468b-a779-d292dc8d62dc`) has delivered a fully verified drop-in replacement file at `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_4_13_iter5/proposed_run_e2e.ts` that incorporates all 5 surgical fixes (`pgrep -f` to fix `ps` truncation, `try...finally` & removing `robustSupabaseRestart()` from interval callback to fix `healthMonitorInterval` race condition, `30 * 60 * 1000` & throwing error on timeout to fix `acquireLock()` fabricated claims, `etimes > 2700` contract conformance, and confirming cache bypass absence).
**Action**: Please review `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_4_13_iter5/proposed_run_e2e.ts`, apply it to `e2e/run_e2e.ts`, execute `npm test` and the master E2E test runner (`node node_modules/.bin/tsx e2e/run_e2e.ts`), and report your progress immediately per the fault tolerance protocol.
