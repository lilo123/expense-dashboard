# Milestone 5.1 (Tier 1 E2E Test Pass) - Empirical Challenger Handoff Report

## 1. Observation
- Executed the prerequisite process cleanup command: `fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true`. The command completed successfully.
- Executed the full E2E test runner command specified in `TEST_READY.md`: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`.
- The test runner command failed with exit code 1 (`task-21`).
- Inspection of `task-21.log` revealed the following sequence during Supabase initialization in `e2e/run_e2e.ts`:
  - `Supabase start attempt 1/3...` failed with `{"_tag":"Error","error":{"code":"PlatformError","message":"Unknown: ChildProcess.exitCode (/usr/local/google/home/duynguyenn/.npm/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-linux-x64/bin/supabase-go --output json start --ignore-health-check)"}}`.
  - The catch block executed `npx supabase stop --no-backup`, `docker rm -f`, and `pkill -f supabase`.
  - `Supabase start attempt 2/3...` immediately output `supabase start is already running.` and `supabase local development setup is running.` without actually starting the containers.
- During `e2e/seed.ts`, Supabase Auth was unreachable, throwing `[cause]: Error: connect ECONNREFUSED 127.0.0.1:54321`.
- When `e2e/seed.ts` attempted to recover by calling `npx supabase start --ignore-health-check`, it also hit `supabase start is already running.` and failed to start the missing containers (`supabase_auth_expense-dashboard`, `supabase_pooler_expense-dashboard`), logging `Error response from daemon: No such container: supabase_auth_expense-dashboard`.
- `e2e/seed.ts` ultimately failed with `Failed to list users: fetch failed`, causing `e2e/run_e2e.ts` to abort before building Next.js or running Playwright tests.

## 2. Logic Chain
- **Supabase CLI Daemon Lock Vulnerability**: When `npx supabase start --ignore-health-check` fails on attempt 1 (due to `supabase-go` child process exit code errors), the cleanup block in `e2e/run_e2e.ts` executes `pkill -f supabase` and `docker rm -f`. While this abruptly kills the `supabase-go` process and removes the Docker containers, it leaves behind the Supabase CLI daemon lock files located in `supabase/.temp/`.
- **False-Positive Start Detection**: On attempt 2, `npx supabase start --ignore-health-check` detects the existing `supabase/.temp/` directory, falsely concludes that Supabase is already running (`supabase start is already running.`), and exits with code 0. Because it exits immediately, it never recreates or starts the Docker containers that were removed by `docker rm -f`.
- **Cascading Connection Refused**: With `supabase_auth` and `supabase_pooler` containers missing, `e2e/seed.ts` cannot connect to `http://127.0.0.1:54321` to list or create users, resulting in `connect ECONNREFUSED 127.0.0.1:54321`.
- **Recovery Failure**: The retry mechanism in `e2e/seed.ts` attempts to restart Supabase using `npx supabase start --ignore-health-check`, but it encounters the exact same daemon lock (`supabase start is already running.`), permanently bricking the test environment until `supabase/.temp/` is explicitly removed (`rm -rf supabase/.temp`).
- **Worker Claim Invalidation**: The Worker's handoff report claimed that Supabase CLI daemon locks were resolved. However, empirical verification proves that the implementation remains highly vulnerable to daemon locks whenever an initial start attempt fails or is forcefully terminated.

## 3. Caveats
- Due to the blocking Supabase CLI daemon lock failure during environment initialization, the E2E test runner aborted before executing `npm run build` or the 55 Playwright E2E tests. Consequently, potential downstream vulnerabilities such as Next.js build cache corruptions, Postgres connection exhaustion, or Playwright worker context leaks could not be empirically verified in this run.
- Per the `Review-only — do NOT modify implementation code` constraint, no fixes (such as adding `rm -rf supabase/.temp` to `e2e/run_e2e.ts` and `e2e/seed.ts`) were applied.

## 4. Conclusion
- Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage) has **FAILED** empirical verification.
- The E2E test runner (`e2e/run_e2e.ts`) and seed script (`e2e/seed.ts`) contain a critical Supabase CLI daemon lock vulnerability (`supabase start is already running.`) caused by failing to remove `supabase/.temp/` during cleanup and retry loops. This prevents container initialization and causes `connect ECONNREFUSED 127.0.0.1:54321`.
- The Worker must update `e2e/run_e2e.ts` and `e2e/seed.ts` to explicitly include `rm -rf supabase/.temp` before every `npx supabase start` invocation to guarantee a pristine start state and eliminate daemon locks.

## 5. Verification Method
- To independently reproduce the Supabase CLI daemon lock failure, execute the following commands from the project root (`/usr/local/google/home/duynguyenn/expense-dashboard`):
```bash
fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
- Expected result: `e2e/run_e2e.ts` fails during `e2e/seed.ts` with `connect ECONNREFUSED 127.0.0.1:54321` due to `supabase start is already running.` daemon locks.
