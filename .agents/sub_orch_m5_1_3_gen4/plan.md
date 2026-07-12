# Plan: M5.3 Tier 3 E2E Test Pass (Iteration 11)

## Objective
Achieve 100% passing Tier 3 E2E tests (M5.3) by fixing `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` to include robust Supabase startup logic (5-retry loop, environment variables), implement runtime Supabase health monitoring and recovery during Playwright execution, increase the stale process lock threshold from 15/30 minutes to 45 minutes (2700s) to prevent lock collisions during test retries, refine `killCmd` to prevent process suicide (`grep -v docker | grep -v bash`), ensure `robustSupabaseRestart()` executes `e2e/seed.ts`, enhance the shared success cache (`/tmp/run_e2e.success.cache`) with git commit/diff hashes, and implement application-level memory management to avoid OOM kills (exit code 137), ensuring clean environment verification and flawless CLEAN audit verdict.

## Step-by-Step Plan (Iteration 11)

### Step 1: Exploratory Investigation & Synthesis (Iteration 11)
- **Action**: Spawn 3 Explorers (`teamwork_preview_explorer`) to investigate `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` and recommend a concrete fix strategy addressing the four critical defects uncovered in Iteration 10:
  1. **Process Suicide via Unscoped Grep in `teardownSupabase()`**: `ps auxww | grep -i supabase` matches the parent `bash` task runner (due to `name=supabase` in `docker rm -f $(docker ps -a -q --filter name=supabase)`) and kills it with `SIGKILL` (exit code 137). `killCmd` must be refined in both `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` to include `grep -v docker` and `grep -v bash`, or use a safer process tree / container scoping mechanism.
  2. **`robustSupabaseRestart()` Wipes Database and Omits Seed Data**: When `healthMonitorInterval` triggers `robustSupabaseRestart()` during Playwright execution, it tears down Supabase, restarts it, and runs `e2e/init_db.ts`, but fails to execute `e2e/seed.ts`. This leaves the database empty and causes all subsequent Playwright tests to fail. `robustSupabaseRestart()` must be updated to execute `npx tsx --env-file=.env.test e2e/seed.ts` immediately after `e2e/init_db.ts`.
  3. **Time-Based Shared Success Cache Vulnerability (`/tmp/run_e2e.success.cache`)**: The success cache relies solely on a 5-minute timestamp window (`300` seconds), allowing E2E test bypassing even if the codebase state changes. The cache validation must be enhanced to include a hash of the current working directory's git commit and uncommitted diffs (e.g., `git rev-parse HEAD` plus a hash of `git diff`), ensuring it invalidates immediately if the codebase state changes.
  4. **Ineffective `protectProcessTree()` OOM Protection & Memory Pressure**: `protectProcessTree()` attempts to write `-1000` to `/proc/[pid]/oom_score_adj`, which fails silently with `Permission denied` in non-root environments (`duynguyenn`). Spawning `supabase start` while Playwright is running creates massive memory pressure, resulting in an OOM kill (exit code 137). Application-level memory management must be implemented (e.g., pausing Playwright during Supabase restarts, tuning Node/Supabase memory limits) rather than relying on privileged `/proc` modifications.
- **Verification**: Wait for all 3 Explorers to deliver their `handoff.md` reports. Synthesize findings into `synthesis.md`.

### Step 2: Implementation & Clean Environment Verification (Iteration 11)
- **Action**: Spawn a Worker (`teamwork_preview_worker`) with `software-engineering` skill to implement the synthesized fixes in `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` by replacing their contents entirely with the fully verified proposed files from Explorer 1 gen11.
- **Verification**: Worker executes the clean environment verification command:
  ```bash
  docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
  ```
  Must pass with exit code 0.

### Step 3: Independent Review & Adversarial Stress-Testing (Iteration 11)
- **Action**: Spawn 2 Reviewers (`teamwork_preview_reviewer`) to independently verify correctness and evaluate failure modes.
- **Verification**: Reviewers execute the clean environment verification command and verify 100% passing tests.

### Step 4: Empirical Adversarial Verification (Iteration 11)
- **Action**: Spawn 2 Challengers (`teamwork_preview_challenger`) with `solution-stress-testing` skill to empirically verify correctness and test edge cases.
- **Verification**: Challengers execute the clean environment verification command and confirm zero vulnerabilities.

### Step 5: Forensic Integrity Audit (Iteration 11)
- **Action**: Spawn a Forensic Auditor (`teamwork_preview_auditor`) to perform integrity verification (no hardcoded test results, no facade implementations, no pre-populated artifacts).
- **Verification**: Auditor executes the clean environment verification command and awards a CLEAN verdict.

### Step 6: Gate Evaluation (Iteration 11)
- **Action**: Collect all results (Worker build/test results, Reviewer verdicts, Challenger reports, Auditor verdict).
- **Verification**: If all pass, mark milestone M5.3 done in `progress.md` and deliver final `handoff.md` to parent `sub_orch_m5_1` (`e0762fd9-e344-42b8-94b2-333966260dfc`).
