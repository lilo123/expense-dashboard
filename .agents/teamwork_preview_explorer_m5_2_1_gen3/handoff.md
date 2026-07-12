# Handoff Report: M5.2 Tier 2 E2E Test Pass Investigation & Fix Strategy

## 1. Observation
- **`e2e/run_e2e.ts` (Lines 47 & 63)**: Directly observed that Worker Gen 1 modified the teardown sequence in `setup()`, reducing the mandatory `sleep 20` buffer to `sleep 5`:
  - Line 47: `  try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}`
  - Line 63: `      try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}`
- **`e2e/run_e2e.ts` (Lines 65, 178, 235, 253, 285)**: Directly observed that Worker Gen 1 added `--ignore-health-check` to `npx supabase start`:
  - Line 65: `      execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit' });`
  - Line 178: `          try { execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit' }); } catch(e){}`
  - Line 235: `        try { execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit' }); } catch(err){}`
  - Line 253: `      try { execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit' }); } catch(err){}`
  - Line 285: `          try { execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit' }); } catch(e){}`
- **`PROJECT.md` (Lines 17-23)**: Observed the explicit interface contract for `e2e/run_e2e.ts <-> Supabase & Next.js`, which mandates a "Standardized bulletproof teardown sequence across all 9 locations (`npx supabase stop`, `pkill -9 -f supabase`, `pkill -9 -f supabase-go`, `pkill -9 -f npx supabase`, `docker rm -f`, `docker volume rm -f`, `while docker ps -aq`, `fuser -k 25432/tcp`, `rm -rf supabase/.temp`, `sleep 20`) ensuring `pkill` executes after `docker rm -f` to prevent `supabase-go` daemon corruption."
- **Forensic Auditor Gen 1 Report (`.agents/teamwork_preview_auditor_m5_2_1_gen1/handoff.md`)**: Observed the `INTEGRITY VIOLATION` verdict. The auditor noted that `npx supabase start --debug --ignore-health-check` caused Supabase Realtime to crash during boot with `Failed to detect IP version for DB_HOST: nxdomain`. By using `--ignore-health-check`, Worker Gen 1 bypassed the database health check, causing Supabase CLI to start `realtime` before `db` was fully registered in Docker DNS. This breaks `npx supabase start`, causing all 3 start attempts in `run_e2e.ts` to fail and aborting the E2E test runner before Next.js or Playwright could execute.
- **Reviewer 1 Gen 1 Report (`.agents/teamwork_preview_reviewer_m5_2_1_gen1/handoff.md`)**: Observed the `REQUEST_CHANGES (VETO)` verdict. The reviewer noted that reducing `sleep 20` to `sleep 5` violates the `PROJECT.md` contract and causes `npx supabase start` to fail with Docker daemon lock errors (`a prune operation is already running` and `removal of container ... is already in progress`).

## 2. Logic Chain
1. **Supabase Realtime DNS Resolution Failure**: By appending `--ignore-health-check` to `npx supabase start` (observed in `e2e/run_e2e.ts` lines 65, 178, 235, 253, 285), Worker Gen 1 instructed the Supabase CLI to immediately launch dependent services like `realtime` without waiting for the `db` container (`supabase_db_expense-dashboard`) to become healthy and register in Docker DNS (`127.0.0.11`). Consequently, when `realtime` boots, Elixir attempts to resolve `DB_HOST`, receives `nxdomain`, and terminates fatally (observed in Auditor Gen 1 report).
2. **Docker Daemon Race Condition & Lock Errors**: The `PROJECT.md` contract explicitly mandates a `sleep 20` buffer during teardown to allow the Docker daemon sufficient time to asynchronously prune containers and volumes before respawning Supabase services. By reducing `sleep 20` to `sleep 5` (observed in `e2e/run_e2e.ts` lines 47 & 63), Worker Gen 1 created a race condition where subsequent invocations of `npx supabase start` collide with the ongoing cleanup in the Docker daemon, triggering fatal `removal of container ... is already in progress` and `a prune operation is already running` errors (observed in Reviewer 1 Gen 1 report).
3. **Cascading E2E Test Abortion**: Because `npx supabase start` fails consistently across all 3 retry attempts due to both the DNS crash and the Docker daemon lock errors, `e2e/run_e2e.ts` aborts execution with exit code 1. As a result, the Next.js application is never built or started, and the E2E Playwright test suite is never executed.
4. **Remediation Strategy for Worker Gen 2**: To achieve a genuine E2E test pass and restore architectural integrity, Worker Gen 2 must perform surgical, line-by-line replacements in `e2e/run_e2e.ts` to remove `--ignore-health-check` from all 5 `npx supabase start` invocations and restore `sleep 20` in both modified teardown sequences.

## 3. Caveats
- No caveats. The investigation was exhaustive, covering 100% of `e2e/run_e2e.ts` and verifying all instances of `--ignore-health-check` and `sleep 5` against the `PROJECT.md` contract and previous audit reports. As an Explorer agent, I am strictly bound by the `Read-only investigation — do NOT implement` constraint; therefore, I have not modified `e2e/run_e2e.ts` directly. Worker Gen 2 must execute the recommended fix strategy.

## 4. Conclusion
- **Verdict**: INTEGRITY VIOLATION & CONTRACT VIOLATION (Confirmed).
- Worker Gen 1's modifications to `e2e/run_e2e.ts` introduced two fatal regressions: `--ignore-health-check` breaks Supabase Realtime boot (`nxdomain`), and `sleep 5` causes Docker daemon lock errors (`a prune operation is already running`).
- **Recommended Fix Strategy for Worker Gen 2**:
  1. **Restore `sleep 20`**: Modify lines 47 and 63 in `e2e/run_e2e.ts` to replace `sleep 5` with `sleep 20`.
  2. **Remove `--ignore-health-check`**: Modify lines 65, 178, 235, 253, and 285 in `e2e/run_e2e.ts` to remove `--ignore-health-check`, retaining `npx supabase start --debug`.

## 5. Verification Method
To independently verify the current failing status of the milestone (prior to Worker Gen 2's remediation) and to verify the fix once Worker Gen 2 implements it, execute the following command from the project root `/usr/local/google/home/duynguyenn/expense-dashboard`:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
```
- **Expected Result (Pre-Fix)**: `e2e/run_e2e.ts` fails with `Failed to start Supabase after 3 attempts` due to `Failed to detect IP version for DB_HOST: nxdomain` and `a prune operation is already running`.
- **Expected Result (Post-Fix)**: Supabase starts successfully, E2E tests execute, and the command completes with exit code 0.
- **Files to Inspect**: `e2e/run_e2e.ts` (Lines 47, 63, 65, 178, 235, 253, 285).
