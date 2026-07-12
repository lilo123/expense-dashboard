# Handoff Report — Milestone 5.1 Reviewer 1 (Iteration 6)

## Review Summary

**Verdict**: REQUEST_CHANGES

## 1. Observation
- **Prerequisite Process Cleanup**: Executed `fuser -k 3000/tcp 54321/tcp 54322/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true`. Completed successfully.
- **E2E Test Runner Execution (`task-22`)**: Executed `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`.
- **Test Results**: The command failed with exit code 1.
  - Verbatim error from `task-22.log`:
    ```
    Starting database...
    Stopping containers...
    error running container: exit 1
    Try rerunning the command with --debug to troubleshoot the error.
    WARN: config section [inbucket] is deprecated. Please use [local_smtp] instead.
    [+] Pulling 4/4
     ✔ api Skipped - Image is already present locally     0.0s 
     ✔ auth Skipped - Image is already present locally    0.0s 
     ✔ db Skipped - Image is already present locally      0.0s 
     ✔ gateway Skipped - Image is already present locally 0.0s 
    Starting database...
    Stopping containers...
    failed to create docker container: Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use by container "c69c72e8702099581014c683ae146a34d282efc1e696707105469075565b4eca". You have to remove (or rename) that container to be able to reuse that name.
    Try rerunning the command with --debug to troubleshoot the error.
    WARN: config section [inbucket] is deprecated. Please use [local_smtp] instead.
    supabase start is already running.
    WARN: config section [inbucket] is deprecated. Please use [local_smtp] instead.
    Stopped services: [supabase_inbucket_expense-dashboard supabase_realtime_expense-dashboard supabase_storage_expense-dashboard supabase_imgproxy_expense-dashboard supabase_pg_meta_expense-dashboard supabase_studio_expense-dashboard supabase_edge_runtime_expense-dashboard supabase_analytics_expense-dashboard supabase_vector_expense-dashboard supabase_pooler_expense-dashboard]
    supabase local development setup is running.
    ```
  - Subsequently, `e2e/seed.ts` failed with:
    ```
    TypeError: fetch failed
    ...
      [cause]: Error: connect ECONNREFUSED 127.0.0.1:54321
    ...
    Failed to list users: fetch failed
    E2E Tests execution failed! Error: Command failed: sleep 15 && npx tsx --env-file=.env.test e2e/seed.ts
    ```
- **Code Inspection Observations**:
  - `e2e/run_e2e.ts:36-37`: Decouples `npx supabase stop && docker rm -f` from `npx supabase start` with `sleep 10`. However, the retry loop is implemented as `execSync('npx supabase start --ignore-health-check || (sleep 10 && npx supabase start --ignore-health-check) || (sleep 10 && npx supabase start --ignore-health-check)', { stdio: 'inherit' });`.
  - `e2e/run_e2e.ts:179-180`: Includes a 10-second warmup delay before Playwright tests (`execSync('sleep 10', ...)`).
  - `e2e/run_e2e.ts:133-156`: Includes a resilient Next.js server keep-alive/respawn mechanism (`startNextServer()`, `isShuttingDown` flag, `on('exit')` listener).
  - `src/lib/planner/types.ts`, `taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`, and `supabase/migrations/20260624000000_retirement_planner.sql`: Genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check trigger (`tr_simulation_configs_premium_guard`). No hardcoded test results or dummy implementations found.
  - `e2e/run_e2e.ts`: `fuser -k 3000/tcp` remains in place; no `pkill -9 -f next` is used.
  - `e2e/run_e2e.ts`: `execSync('npx tsx e2e/init_db.ts', ...)` and `execSync('npx playwright test ...')` remain without `try...catch` blocks.

## 2. Logic Chain
1. **Flawed Supabase Start Retry Loop**: The Worker's implementation of the retry loop in `e2e/run_e2e.ts:37` attempts to chain `npx supabase start --ignore-health-check` using `||`. When the initial `npx supabase start` fails after creating the database container (`/supabase_db_expense-dashboard`), the subsequent retry fails because the container name is already in use (`Conflict. The container name "/supabase_db_expense-dashboard" is already in use`).
2. **False Positive Start State**: The third retry in the chain detects the running database container and incorrectly concludes `supabase start is already running.`, despite the fact that essential API gateway (`supabase_kong`) and Auth (`supabase_auth`) services are stopped (`Stopped services: [supabase_inbucket_expense-dashboard supabase_realtime_expense-dashboard ...]`).
3. **Cascading Failure in Seed Phase**: Because `supabase_kong` and `supabase_auth` were not running, `e2e/seed.ts` failed to connect to `http://127.0.0.1:54321` to list and create users, throwing `ECONNREFUSED` and causing the entire E2E test runner to fail with exit code 1.
4. **Verification of Worker's Claims**: The Worker claimed in their handoff report that `npx tsx e2e/run_e2e.ts` completed successfully with exit code 0 and all 55 Playwright tests passed. Our independent verification falsified this claim, proving that the retry mechanism is not robust against container conflicts.

## 3. Caveats
- **Playwright Tests Unverified**: Due to the failure during `e2e/seed.ts`, the Playwright E2E test suite (`npx playwright test`) was never reached during the test run.
- **No Integrity Violations**: While the Worker's retry loop implementation is flawed and their success claim could not be replicated, the underlying domain logic engines, Zod schemas, and Supabase migrations are genuinely implemented without hardcoded mocks or shortcuts.

## 4. Conclusion
The Worker's implementation fails the robustness and correctness requirements for `e2e/run_e2e.ts`. Specifically, the retry loop for `npx supabase start` must be refactored to properly stop and clean up conflicting containers (`npx supabase stop --no-backup 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true`) before attempting each retry of `npx supabase start`.

**Verdict**: REQUEST_CHANGES

### Major Finding 1: Flawed Supabase Start Retry Loop
- **What**: `npx supabase start` retry loop fails due to Docker container conflicts when a previous start attempt fails partially.
- **Where**: `e2e/run_e2e.ts:37`
- **Why**: Chaining `npx supabase start` with `||` without cleaning up orphaned containers between attempts causes Docker daemon naming conflicts (`/supabase_db_expense-dashboard is already in use`), leading to a false positive `supabase start is already running` state while leaving API/Auth services stopped.
- **Suggestion**: Modify the retry loop in `e2e/run_e2e.ts` to ensure `npx supabase stop --no-backup 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && sleep 10` is executed before each retry of `npx supabase start`. For example:
  ```javascript
  execSync('npx supabase start --ignore-health-check || (npx supabase stop --no-backup 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && sleep 10 && npx supabase start --ignore-health-check) || (npx supabase stop --no-backup 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && sleep 10 && npx supabase start --ignore-health-check)', { stdio: 'inherit' });
  ```

## 5. Verification Method
### 5.1 Automated Verification Commands
```bash
fuser -k 3000/tcp 54321/tcp 54322/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
npx tsx e2e/run_e2e.ts
npx tsx e2e/verify_accumulation.ts
npx tsx e2e/verify_monte_carlo.ts
```

### 5.2 Files to Inspect
- `e2e/run_e2e.ts`

### 5.3 Invalidation Conditions
- Any failure during `npx supabase start` or `e2e/seed.ts`.
- Any E2E test failure during `npx tsx e2e/run_e2e.ts`.
