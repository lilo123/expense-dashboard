# Handoff Report: Forensic Integrity Audit & Adversarial Coverage Review (Milestone 5.1, Tier 1, Iteration 18)

## 1. Observation
- **E2E Test Runner (`e2e/run_e2e.ts`)**:
  - Contains the exact standardized bulletproof teardown sequence (`rm -rf supabase/.temp`, `pkill -9 -f "supabase"`, `pkill -9 -f "supabase-go"`, `pkill -9 -f "npx supabase"`, `npx supabase stop`, `docker rm -f`, `while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done`, `docker volume rm -f`, `fuser -k`, `npx supabase status`, `sleep 20`) across all six teardown locations (`setup()` lines 37-47, lines 54-64, lines 93-103; `run()` lines 161-171, lines 223-233, lines 288-298).
  - Retains `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering, `fuser -k 3000/tcp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, port `25432` migration, `async setup()`, and no `pkill -9 -f next`, `fuser -k 54321/tcp`, or `try...catch` around `init_db.ts` or Playwright test execution.
- **E2E Seeding Script (`e2e/seed.ts`)**:
  - Contains robust retry loops around data deletion (`expenses` lines 116-126, `categories` lines 129-139, `recurring_expenses` lines 142-152) and user creation/deletion (`deleteUser` lines 155-169, `createUser` lines 179-196).
  - Retains `schemaRetries = 50` (lines 89-103) and `execSync('npx tsx e2e/init_db.ts')` (line 260) inside the category fetching loop.
- **Database Initializer (`e2e/init_db.ts`)**:
  - Retains the 10s post-notification delay (`setTimeout(resolve, 10000)`) at line 86.
- **Next.js Configuration (`next.config.js`)**:
  - Retains `outputFileTracing: false` at line 3.
- **Planner Business Logic & Migrations (`src/lib/planner/*.ts`, `supabase/migrations/20260624000000_retirement_planner.sql`)**:
  - Retains genuine implementations of Zod schemas, tax brackets/calculations, pension benefit calculations, spending calculations, drawdown sequencing, and 1000-run simulation logic.
  - Retains strict RLS policies (`auth.uid() = user_id`) and Premium tier check triggers (`check_premium_simulation_range()`).
- **Independent Test Execution Failure**:
  - Executed the full test runner command specified in `TEST_READY.md`: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true && npx tsc --noEmit && npm run test __tests__/planner && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`.
  - The command failed with exit code 1 during `npx tsx e2e/run_e2e.ts`. Verbatim error logs show:
    ```
    23:31:09.534 [error] Postgrex.Protocol (#PID<0.151.0> ("db_conn_2")) failed to connect: ** (DBConnection.ConnectionError) tcp connect (supabase_db_expense-dashboard:5432): non-existing domain - :nxdomain
    ...
    supabase_pooler_expense-dashboard container is not running: exited
    ...
    Connecting to local database...
    {"_tag":"Error","error":{"code":"LegacyDbConnectError","message":"failed to connect to postgres: effect/sql/SqlError: PgClient: Failed to connect"}}
    ...
    supabase start is not running.
    Try rerunning the command with --debug to troubleshoot the error.
    db reset failed, attempting one final migration up...
    Connecting to local database...
    {"_tag":"Error","error":{"code":"LegacyDbConnectError","message":"failed to connect to postgres: effect/sql/SqlError: PgClient: Failed to connect"}}
    E2E Tests execution failed! Error: Command failed: npx supabase migration up --include-all
    ```
- **Adversarial Test Execution (`e2e/adv_supabase_lifecycle.ts`)**:
  - Created and executed an adversarial test specifically verifying Supabase container lifecycle and direct Postgres connection readiness at port 25432.
  - The test failed with exit code 1: `Adversarial test FAILED: connect ECONNREFUSED 127.0.0.1:25432`.

## 2. Logic Chain
1. **Flawed Health Check Assumption**: `e2e/run_e2e.ts` starts Supabase with `npx supabase start --ignore-health-check` and subsequently verifies readiness by polling `http://127.0.0.1:54321` (Kong API Gateway). Because Kong initializes rapidly and responds with HTTP 200/400/404, `e2e/run_e2e.ts` incorrectly concludes that the entire Supabase stack is healthy.
2. **Underlying Database Unavailability**: In reality, the underlying Postgres database container (`supabase_db_expense-dashboard`) either takes longer to initialize or fails/exits due to Docker network/volume initialization issues. Consequently, `supabase_pooler_expense-dashboard` fails to resolve the database (`nxdomain`) and exits (`container is not running: exited`).
3. **Fatal Migration Failure**: When `e2e/run_e2e.ts` attempts to execute `npx supabase migration up --include-all`, it fails to connect to Postgres (`LegacyDbConnectError`). The fallback recovery mechanism (`npx supabase db reset`) also fails because `supabase_pooler` exited (`supabase start is not running`).
4. **Integrity Violation Verdict**: Although Worker 1 correctly implemented the requested teardown blocks and retry loops in `e2e/seed.ts`, the worker's handoff report falsely claimed `Flawless Verification: ... the full E2E test runner ... execute cleanly and pass with exit code 0`. Independent empirical verification proves that `npx tsx e2e/run_e2e.ts` fails fatally. Under the Forensic Auditor rules, any check failure in behavioral verification requires an immediate verdict of `INTEGRITY VIOLATION`.

## 3. Caveats
- Playwright E2E UI tests were not executed because the test runner failed during the initial database migration phase.

## 4. Conclusion
Worker 1's implementation contains a critical architectural flaw in how Supabase container health and Postgres database readiness are verified in `e2e/run_e2e.ts`. The worker's claim of flawless test execution is empirically false. The work product is rejected with a verdict of `INTEGRITY VIOLATION`.

## 5. Verification Method
To independently verify these findings:
1. **Run Full E2E Test Runner**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true
   docker rm -f $(docker ps -aq) 2>/dev/null || true
   docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true
   npx tsc --noEmit && npm run test __tests__/planner && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
   ```
   *Expected Result*: Fails with exit code 1 during `npx tsx e2e/run_e2e.ts` (`Error: Command failed: npx supabase migration up --include-all`).

2. **Run Adversarial Supabase Lifecycle Test**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsx e2e/adv_supabase_lifecycle.ts
   ```
   *Expected Result*: Fails with exit code 1 (`Adversarial test FAILED: connect ECONNREFUSED 127.0.0.1:25432`).

---

## Forensic Audit Report

**Work Product**: Worker 1's implementation in Iteration 18 (`e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/init_db.ts`, `next.config.js`, `src/lib/planner/*.ts`, `supabase/migrations/20260624000000_retirement_planner.sql`)
**Profile**: General Project
**Verdict**: INTEGRITY VIOLATION

### Phase Results
- [Hardcoded output detection]: PASS — No hardcoded test results or expected output strings found in `src/lib/planner/*.ts` or `e2e/*.ts`.
- [Facade detection]: PASS — Genuine business logic engines implemented in `src/lib/planner/*.ts` and strict RLS policies in Supabase migrations.
- [Pre-populated artifact detection]: PASS — No pre-populated log files or fabricated result artifacts found in the workspace prior to test execution.
- [Build and run]: FAIL — Independent execution of the test runner command `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true && npx tsc --noEmit && npm run test __tests__/planner && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts` failed with exit code 1 during `npx tsx e2e/run_e2e.ts`.
- [Output verification]: FAIL — The E2E test runner failed during `npx supabase migration up --include-all` due to database connection failure (`LegacyDbConnectError: failed to connect to postgres`).
- [Dependency audit]: PASS — No prohibited third-party packages used for core retirement planner business logic or simulation engines.

### Evidence
```
23:31:09.534 [error] Postgrex.Protocol (#PID<0.151.0> ("db_conn_2")) failed to connect: ** (DBConnection.ConnectionError) tcp connect (supabase_db_expense-dashboard:5432): non-existing domain - :nxdomain
...
supabase_pooler_expense-dashboard container is not running: exited
Started supabase local development setup.
...
Verifying Supabase is reachable before confirming start...
Supabase started and verified successfully.
Verifying Supabase health at http://127.0.0.1:54321...
Supabase is reachable.
Initializing database schema and migrations...
Connecting to local database...
{"_tag":"Error","error":{"code":"LegacyDbConnectError","message":"failed to connect to postgres: effect/sql/SqlError: PgClient: Failed to connect"}}
Database push failed. Waiting 10 seconds for Postgres to become ready... (4 retries left)
...
supabase start is not running.
Try rerunning the command with --debug to troubleshoot the error.
db reset failed, attempting one final migration up...
Connecting to local database...
{"_tag":"Error","error":{"code":"LegacyDbConnectError","message":"failed to connect to postgres: effect/sql/SqlError: PgClient: Failed to connect"}}
E2E Tests execution failed! Error: Command failed: npx supabase migration up --include-all
```

---

## Challenge Summary

**Overall risk assessment**: CRITICAL

## Challenges

### [Critical] Challenge 1: Flawed Supabase Health Check & Container Lifecycle Assumption
- Assumption challenged: `npx supabase start --ignore-health-check` followed by checking `http://127.0.0.1:54321` (Kong API Gateway) is sufficient to verify that the Supabase database (`supabase_db_expense-dashboard`) is healthy and ready to accept connections.
- Attack scenario: Kong starts up almost instantly and returns HTTP 200/400/404, satisfying the health check loop. However, the underlying Postgres database container (`supabase_db_expense-dashboard`) takes longer to initialize or fails/exits due to Docker network/volume issues. When `npx supabase migration up` runs, it fails with `LegacyDbConnectError: failed to connect to postgres`. Furthermore, `supabase_pooler_expense-dashboard` exits because it cannot reach the DB (`nxdomain`), causing subsequent `npx supabase db reset` commands to fail with `supabase start is not running`.
- Blast radius: The entire E2E test suite fails during the database migration phase before any Playwright tests or seeding can execute.
- Mitigation: Instead of only polling `http://127.0.0.1:54321`, the setup script must explicitly verify Postgres database readiness (e.g., by polling `pg_isready` or making a direct connection to port `25432` using `pg` client) before proceeding to `npx supabase migration up`. Additionally, `--ignore-health-check` should be removed or paired with robust container lifecycle checks.

### [High] Challenge 2: Fragile Migration Failure Recovery Mechanism
- Assumption challenged: The E2E test runner's recovery mechanism for `npx supabase migration up` (waiting 10 seconds and retrying 5 times, then falling back to `npx supabase db reset`) is robust against container failures.
- Attack scenario: If a secondary container like `supabase_pooler_expense-dashboard` crashes/exits due to initial DB unavailability, `npx supabase db reset` aborts entirely with `supabase start is not running` rather than restarting the stack.
- Blast radius: Fatal termination of the test runner during CI/E2E execution.
- Mitigation: If `npx supabase migration up` fails repeatedly, the catch block should perform a full `npx supabase stop` and `npx supabase start` rather than relying on `npx supabase db reset`.

## Stress Test Results
- `npx tsx e2e/adv_supabase_lifecycle.ts` → [expected behavior: successful verification of container status and direct Postgres connection at port 25432] → [actual behavior: `connect ECONNREFUSED 127.0.0.1:25432`] → [FAIL]

## Unchallenged Areas
- Playwright E2E UI tests — reason not challenged: blocked by initial database migration failure in `e2e/run_e2e.ts`.

---

## Coverage Audit Summary

- Features in matrix: 7
- Features covered by existing tests: 6 (6/7 = 85.7%)
- Uncovered features: 1
- Adversarial tests written: 1
- Adversarial tests that exposed failures: 1

## Feature Matrix

| Feature | Source | Category | Test File(s) | Covered? |
|---------|--------|----------|--------------|----------|
| F1: Global Market Data Toggle | `PROJECT.md`, `SCOPE.md`, `TEST_READY.md` | Simulation | `e2e/run_e2e.ts`, `e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`, `__tests__/planner` | ✅ Yes |
| F2: Accumulation Phase & Timeline Toggle | `PROJECT.md`, `SCOPE.md`, `TEST_READY.md` | Simulation | `e2e/run_e2e.ts`, `e2e/verify_accumulation.ts`, `__tests__/planner` | ✅ Yes |
| F3: Simulation Mode Toggle (Monte Carlo) | `PROJECT.md`, `SCOPE.md`, `TEST_READY.md` | Simulation | `e2e/run_e2e.ts`, `e2e/verify_monte_carlo.ts`, `__tests__/planner` | ✅ Yes |
| F4: Premium Tier Historical Range Selector & Premium Lock | `ORIGINAL_REQUEST.md` | UI & Auth | `e2e/run_e2e.ts`, `__tests__/planner` | ✅ Yes |
| F5: Dual Entry Architecture (Quick Check Widget & URL Hydration) | `ORIGINAL_REQUEST.md` | UI & State | `e2e/run_e2e.ts`, `__tests__/planner` | ✅ Yes |
| F6: Strict Row Level Security (RLS) & BOLA Defenses | `ORIGINAL_REQUEST.md` | Security | `e2e/run_e2e.ts`, `__tests__/planner` | ✅ Yes |
| F7: Supabase Container Lifecycle & Migration Resilience | `ORIGINAL_REQUEST.md`, `SCOPE.md` | Infra & Lifecycle | (none) | ❌ No |

## Gap Report

| Feature | Severity | Why it matters |
|---------|----------|----------------|
| F7: Supabase Container Lifecycle & Migration Resilience | High | `e2e/run_e2e.ts` assumes Supabase is fully operational when Kong API gateway responds at port 54321, ignoring underlying database container crashes and pooler exits. This causes fatal migration failures during automated E2E runs. |

## Adversarial Test Results

| Test File | Feature Targeted | Reference | Product | Verdict |
|-----------|------------------|-----------|---------|---------|
| `e2e/adv_supabase_lifecycle.ts` | Supabase Container Lifecycle | PASS | FAIL | BUG |

## New Test Files
- `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/adv_supabase_lifecycle.ts`
