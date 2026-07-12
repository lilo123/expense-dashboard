# Handoff Report — Milestone 5.1 Reviewer 2 (Iteration 5)

## Review Summary

**Verdict**: REQUEST_CHANGES

## 1. Observation
- **Git Diff & Integrity Check**: Inspection of `git diff` across `e2e/run_e2e.ts`, `src/app/(auth)/login/page.tsx`, `e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`, and `src/workers/simulation.worker.ts` confirmed that the Worker implemented genuine fixes without any integrity violations (no hardcoded test results, no dummy/facade implementations, no error swallowing).
- **E2E Test Runner Execution (`task-19` & `task-31`)**: Executing the required test runner command (`export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsc --noEmit && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`) failed with exit code 1 during `e2e/run_e2e.ts` setup.
- **Verbatim Error**:
  ```
  Starting database...
  Initialising schema...
  Stopping containers...
  failed to prune containers: Error response from daemon: a prune operation is already running
  error running container: exit 1
  Try rerunning the command with --debug to troubleshoot the error.
  E2E Tests execution failed! Error: Command failed: npx supabase stop --no-backup 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && npx supabase start --ignore-health-check
  ```
- **Codebase Investigation (`e2e/run_e2e.ts:35`)**: In `e2e/run_e2e.ts`, the Worker combined Supabase stop, docker rm, and Supabase start into a single synchronous execution without any intermediate delay or retry logic:
  ```typescript
  execSync('npx supabase stop --no-backup 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && npx supabase start --ignore-health-check', { stdio: 'inherit' });
  ```

## 2. Logic Chain
1. **Docker Daemon Prune Collision**: When `npx supabase stop --no-backup` and `docker rm -f $(docker ps -aq)` execute, they trigger container removal and background pruning within the Docker daemon.
2. **Race Condition in `npx supabase start`**: Because `npx supabase start --ignore-health-check` is chained immediately after `docker rm -f` without any `sleep` interval or retry loop, the Supabase CLI attempts its own internal container/volume pruning while the Docker daemon is still processing the previous prune/removal.
3. **Fatal Setup Failure**: The Docker daemon rejects the second prune request with `Error response from daemon: a prune operation is already running`. This causes `npx supabase start` to abort with exit code 1, throwing an error in `execSync`, aborting `run_e2e.ts` before Next.js or Playwright can even start, and failing the E2E test suite.
4. **Required Fix**: `e2e/run_e2e.ts` must be updated to decouple `npx supabase stop && docker rm -f` from `npx supabase start`. A mandatory `sleep` interval (e.g., `sleep 10`) and/or a retry loop around `npx supabase start` must be introduced to allow the Docker daemon to complete its background prune before attempting to start Supabase.

## 3. Caveats
- Due to the fatal Supabase startup failure in `e2e/run_e2e.ts`, the underlying Playwright E2E tests (`npx playwright test`) could not be executed during this review turn.

## 4. Conclusion
- Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage) cannot be approved in its current state. While the Worker successfully resolved the TypeScript checkbox validation bug in `src/app/(auth)/login/page.tsx`, the changes to `e2e/run_e2e.ts` introduced a fatal Docker daemon race condition. The Worker must add a sleep delay and/or retry mechanism between stopping/removing containers and starting Supabase in `e2e/run_e2e.ts`.

## 5. Verification Method
To independently verify the fix and E2E test pass, execute the following commands from the project root (`/usr/local/google/home/duynguyenn/expense-dashboard`):

1. **Prerequisite Process Cleanup**:
   ```bash
   fuser -k 3000/tcp 54321/tcp 54322/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true
   ```

2. **Run Full E2E Test Runner & Verification Suite**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsc --noEmit && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
   ```
   *Expected Output*: `55 passed`, `E2E Tests completed successfully!`, `=== [E2E VERIFICATION] Accumulation Verification PASSED ===`, `=== [E2E VERIFICATION] Monte Carlo Verification PASSED ===`. Exit code 0.
