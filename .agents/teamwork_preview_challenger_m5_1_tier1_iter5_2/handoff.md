# Handoff Report — Milestone 5.1 Challenger 2 (Iteration 5)

## 1. Observation
- **Worker Claims**: The Worker claimed in `.agents/teamwork_preview_worker_m5_1_tier1_iter5_1/handoff.md` that combining Supabase stop/rm/start into a single `execSync` invocation with `--ignore-health-check` in `e2e/run_e2e.ts` prevented container inspection failures and resulted in a 100% E2E test pass (55/55 tests).
- **Empirical Execution 1 (`task-15`)**: Executing the prerequisite cleanup command followed immediately by the test runner (`fuser -k 3000/tcp 54321/tcp 54322/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsc --noEmit && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`) failed with exit code 1 during `e2e/run_e2e.ts`.
  - *Verbatim Error*:
    ```
    failed to prune containers: Error response from daemon: a prune operation is already running
    failed to connect to postgres: failed to connect to `host=127.0.0.1 user=postgres database=postgres`: failed to receive message (read tcp 127.0.0.1:35654->127.0.0.1:54322: read: connection reset by peer)
    Try rerunning the command with --debug to troubleshoot the error.
    E2E Tests execution failed! Error: Command failed: npx supabase stop --no-backup 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && npx supabase start --ignore-health-check
    ```
- **Empirical Execution 2 (`task-19`)**: To eliminate the Docker daemon prune race condition, a 5-second sleep was introduced between the cleanup command and the test runner (`fuser -k ... && docker rm -f ... && sleep 5 && export PATH=... && npx tsx e2e/run_e2e.ts ...`). This execution also failed with exit code 1 during `e2e/run_e2e.ts`.
  - *Verbatim Error*:
    ```
    Starting database...
    Initialising schema...
    Stopping containers...
    unexpected EOF                                                                          
    At statement: 0                                                                         
    alter default privileges for role postgres in schema public                             
      revoke select, insert, update, delete on tables from anon, authenticated, service_role
    Try rerunning the command with --debug to troubleshoot the error.
    E2E Tests execution failed! Error: Command failed: npx supabase stop --no-backup 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && npx supabase start --ignore-health-check
    ```
- **Codebase Inspection (`e2e/run_e2e.ts`)**: Inspection of `e2e/run_e2e.ts` line 35 confirms the Worker's implementation: `execSync('npx supabase stop --no-backup 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && npx supabase start --ignore-health-check', { stdio: 'inherit' });`.

## 2. Logic Chain
1. **Docker Daemon Concurrency Flaw**: In `task-15`, invoking `docker rm -f $(docker ps -aq)` in the prerequisite cleanup followed immediately by `npx supabase stop` and `npx supabase start` in `e2e/run_e2e.ts` triggers a race condition in the Docker daemon (`a prune operation is already running`). This proves that the E2E setup script lacks proper synchronization or settling time between container teardown and startup.
2. **Supabase `--ignore-health-check` Vulnerability**: In `task-19`, after allowing the Docker daemon to settle via `sleep 5`, `npx supabase start --ignore-health-check` successfully starts the database container but fails during `Initialising schema...`. 
3. **Root Cause of `unexpected EOF`**: When `--ignore-health-check` is passed, the Supabase CLI does not wait for the Postgres database container to become fully healthy and ready to accept stable connections before attempting to execute schema initialization scripts (`alter default privileges for role postgres in schema public...`). Because Postgres is still performing startup initialization or crash recovery, the connection is dropped/reset (`connection reset by peer`, `unexpected EOF`).
4. **Premature Test Abort**: Because `npx supabase start` fails, `execSync` throws an error, aborting `setup()` and triggering `cleanup()`. Consequently, the Playwright E2E tests, accumulation verification, and Monte Carlo verification scripts are never executed.
5. **Protocol Compliance**: Per the Empirical Challenger mandate ("Report any failures as findings — do NOT fix them yourself"), these findings are documented here for the upstream Worker/Orchestrator to remediate.

## 3. Caveats
- **Unreached Test Phases**: Due to the fatal error during `setup()` in `e2e/run_e2e.ts`, the actual Playwright E2E test suite (`npx playwright test`), `e2e/verify_accumulation.ts`, and `e2e/verify_monte_carlo.ts` could not be empirically verified during this turn.

## 4. Conclusion
- Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage) is **NOT** empirically verified. The Worker's addition of `--ignore-health-check` to `npx supabase start` in `e2e/run_e2e.ts` introduces a critical race condition where schema initialization is attempted before Postgres is fully ready, causing `unexpected EOF` / `connection reset by peer` and failing the E2E test runner with exit code 1.

---

## Challenge Summary

**Overall risk assessment**: CRITICAL

## Challenges

### [Critical] Challenge 1: Supabase Startup Race Condition via `--ignore-health-check`

- **Assumption challenged**: The Worker assumed that passing `--ignore-health-check` to `npx supabase start` in `e2e/run_e2e.ts` would make Supabase startup robust by bypassing container health check timeouts.
- **Attack scenario**: When `--ignore-health-check` is used, the Supabase CLI does not wait for Postgres to become fully healthy before executing schema initialization scripts (`Initialising schema...`). If Postgres is still initializing, the connection resets (`connection reset by peer`, `unexpected EOF`), causing `npx supabase start` to abort and tear down the containers.
- **Blast radius**: The entire E2E test suite fails during `setup()` before any Playwright tests can run, resulting in a complete failure of `npx tsx e2e/run_e2e.ts` with exit code 1.
- **Mitigation**: In `e2e/run_e2e.ts`, `npx supabase start` should either be run without `--ignore-health-check` (allowing it to properly wait for Postgres health before initializing the schema), or `setup()` must implement a robust retry loop around `npx supabase start` rather than relying on a single synchronous execution.

### [Medium] Challenge 2: Docker Daemon Prune Concurrency

- **Assumption challenged**: The Worker assumed `docker rm -f $(docker ps -aq)` followed immediately by `npx supabase start` would execute cleanly without daemon lockups.
- **Attack scenario**: Rapid sequential execution of container removal and `supabase start` triggers `Error response from daemon: a prune operation is already running`.
- **Blast radius**: `e2e/run_e2e.ts` fails instantly during `setup()`.
- **Mitigation**: Introduce a `sleep 5` or a polling check between container teardown and `npx supabase start` in `e2e/run_e2e.ts`.

## Stress Test Results

- `fuser -k ... && docker rm -f ... && npx tsx e2e/run_e2e.ts` → E2E tests execute and pass → `failed to prune containers: Error response from daemon: a prune operation is already running` → **FAIL**
- `fuser -k ... && docker rm -f ... && sleep 5 && npx tsx e2e/run_e2e.ts` → E2E tests execute and pass → `Initialising schema... unexpected EOF At statement: 0 alter default privileges...` → **FAIL**

## Unchallenged Areas

- `npx playwright test` — reason not challenged (insufficient context / blocked by fatal setup error in `e2e/run_e2e.ts`)
- `e2e/verify_accumulation.ts` — reason not challenged (blocked by `e2e/run_e2e.ts` failure)
- `e2e/verify_monte_carlo.ts` — reason not challenged (blocked by `e2e/run_e2e.ts` failure)

---

## 5. Verification Method
To independently verify these findings, execute the following commands from the project root (`/usr/local/google/home/duynguyenn/expense-dashboard`):

1. **Reproduce Docker Prune Race Condition**:
   ```bash
   fuser -k 3000/tcp 54321/tcp 54322/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts
   ```
   *Expected Output*: `failed to prune containers: Error response from daemon: a prune operation is already running`.

2. **Reproduce Supabase Schema Initialization Failure (`unexpected EOF`)**:
   ```bash
   fuser -k 3000/tcp 54321/tcp 54322/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && sleep 5 && export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts
   ```
   *Expected Output*: `Initialising schema... unexpected EOF At statement: 0 alter default privileges for role postgres in schema public...`. Exit code 1.
