# M5.1 Tier 1 E2E Test Pass - Challenger 1 (Iteration 13) Handoff Report

## Executive Summary
As Challenger 1 (Iteration 13) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage), we conducted an empirical verification and stress test of Worker 1's implementation. While the prerequisite process cleanup, TypeScript compilation (`tsc --noEmit`), and unit tests (`npm run test __tests__/planner`) completed successfully with 100% passing tests, the full E2E test runner (`npx tsx e2e/run_e2e.ts`) failed empirically with exit code 1. 

We uncovered a critical architectural flaw in Worker 1's pre-seed Supabase stabilization health check within `e2e/run_e2e.ts`. When `preSeedRetries` reaches 15, 10, or 5, the script attempts to restart Supabase using `npx supabase start --ignore-health-check` without first stopping existing containers or purging the database volume. This causes Supabase CLI to attempt re-applying initial migrations against an already-migrated database volume, triggering a fatal `duplicate key value violates unique constraint "schema_migrations_pkey"` error, which automatically shuts down all Supabase containers and permanently renders `http://127.0.0.1:54321` unreachable.

---

## 1. Observation

### 1.1 Prerequisite Cleanup, TypeScript Compilation, & Unit Tests
- **Prerequisite Process Cleanup**: Executed successfully, terminating orphaned test runners, pruning containers, and purging volumes.
- **TypeScript Compilation**: `npx tsc --noEmit` completed successfully with zero errors.
- **Unit Tests**: `npm run test __tests__/planner` completed successfully with 100% passing unit tests (9/9 passed across Zod schemas, taxEngine, pensionEngine, spendingEngine, drawdownEngine, and simulator).

### 1.2 E2E Test Runner Failure (`e2e/run_e2e.ts`)
- `npx tsx e2e/run_e2e.ts` failed with exit code 1 during the pre-seed Supabase health check phase.
- **Verbatim Error Logs** (from `task-26.log`):
  ```
  Verifying Supabase health pre-seed at http://127.0.0.1:54321...
  Waiting for Supabase to be reachable pre-seed... (20 retries left)
  Waiting for Supabase to be reachable pre-seed... (19 retries left)
  Waiting for Supabase to be reachable pre-seed... (18 retries left)
  Waiting for Supabase to be reachable pre-seed... (17 retries left)
  Waiting for Supabase to be reachable pre-seed... (16 retries left)
  Waiting for Supabase to be reachable pre-seed... (15 retries left)
  Supabase seems unresponsive pre-seed. Attempting to restart Supabase...
  [+] Pulling 5/5
   ✔ auth Skipped - Image is already present locally    0.0s 
   ✔ pooler Skipped - Image is already present locally  0.0s 
   ✔ db Skipped - Image is already present locally      0.0s 
   ✔ gateway Skipped - Image is already present locally 0.0s 
   ✔ api Skipped - Image is already present locally     0.0s 
  Starting database...
  Initialising schema...
  Seeding globals from roles.sql...
  Applying migration 20260510000000_init.sql...
  NOTICE (00000): policy "Users can manage their own categories" for relation "categories" does not exist, skipping
  ...
  NOTICE (42P07): relation "categories" already exists, skipping
  NOTICE (42P07): relation "expenses" already exists, skipping
  NOTICE (42P07): relation "budgets" already exists, skipping
  Stopping containers...
  ERROR: duplicate key value violates unique constraint "schema_migrations_pkey" (SQLSTATE 23505)
  Key (version)=(20260510000000) already exists.                                                 
  At statement: 12                                                                               
  INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES($1, $2, $3)
  Try rerunning the command with --debug to troubleshoot the error.
  Waiting for Supabase to be reachable pre-seed... (9 retries left)
  ...
  E2E Tests execution failed! Error: Supabase pre-seed health check failed: http://127.0.0.1:54321 is unreachable.
      at run (/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts:180:13)
  ```

### 1.3 Verification of Specific File Requirements
- **`e2e/run_e2e.ts`**: Correctly includes `npx supabase migration up --include-all` (non-interactive) and the pre-seed Supabase stabilization health check.
- **`e2e/seed.ts`**: Correctly includes `schemaRetries = 50` (line 89) and the robust schema cache reload mechanism `execSync('npx tsx e2e/init_db.ts')` (line 203) inside the category fetching loop.
- **`e2e/init_db.ts`**: Correctly includes the 10s post-notification delay `setTimeout(resolve, 10000)` (line 86).
- **`next.config.js` & `e2e/run_e2e.ts` Sanitization**: `next.config.js` retains `outputFileTracing: false`. `e2e/run_e2e.ts` retains `NODE_OPTIONS: ''` sanitization, lingering `run_e2e` process cleanup (`pgrep`/`kill`), removal of `suppress_crashes.js`, `fuser -k 3000/tcp`, `docker volume ls -q | xargs -r docker volume rm -f`, and no `try...catch` around `init_db.ts` or Playwright test execution.
- **`src/lib/planner/*.ts` & `supabase/migrations/20260624000000_retirement_planner.sql`**: Remain genuinely implemented with pure TypeScript business logic engines, strict RLS (`auth.uid() = user_id`), and Premium tier check triggers (`check_premium_simulation_range()`).

---

## 2. Logic Chain

1. **Root Cause of E2E Test Runner Failure (`e2e/run_e2e.ts`)**:
   - Following `init_db.ts` execution, `run_e2e.ts` enters the pre-seed Supabase health check loop, polling `http://127.0.0.1:54321`.
   - If Supabase takes longer than 10 seconds (5 retries * 2000ms) to respond, `preSeedRetries` reaches `15`.
   - At `preSeedRetries === 15`, `run_e2e.ts` executes `rm -rf supabase/.temp` and `npx supabase start --ignore-health-check`.
   - Because the existing Supabase containers and database volume were not stopped or removed prior to this command, `npx supabase start` attempts to initialize the database schema and apply migrations (`20260510000000_init.sql`) against an already existing database volume.
   - This triggers a fatal SQL error: `ERROR: duplicate key value violates unique constraint "schema_migrations_pkey" (SQLSTATE 23505) Key (version)=(20260510000000) already exists.`
   - Upon encountering this migration failure, Supabase CLI automatically executes `Stopping containers...`, shutting down all Supabase services (`supabase_kong_expense-dashboard`, `supabase_auth_expense-dashboard`, `supabase_db_expense-dashboard`, etc.).
   - Consequently, all subsequent health check retries fail, exhausting `preSeedRetries` and throwing the fatal error `Supabase pre-seed health check failed: http://127.0.0.1:54321 is unreachable.`

2. **Assessment of Worker 1's Implementation**:
   - While Worker 1 successfully added the requested mechanisms (`schemaRetries = 50`, `migration up --include-all`, 10s post-notification delay, strict RLS, genuine engines), the pre-seed health check logic is structurally flawed. Invoking `npx supabase start` without a prior `npx supabase stop --no-backup` and volume cleanup guarantees container termination if a retry is triggered.

---

## 3. Caveats
- **No caveats.** All verification steps were executed empirically in a clean environment. The failure mode is fully reproducible and directly traceable to the restart logic in `e2e/run_e2e.ts`.

---

## 4. Conclusion
Worker 1's implementation fails empirical verification. While unit tests and TypeScript compilation succeed, `e2e/run_e2e.ts` fails due to a flawed pre-seed Supabase health check retry mechanism that attempts `npx supabase start` without stopping existing containers or cleaning volumes, leading to a fatal `schema_migrations_pkey` duplicate key constraint violation and complete container shutdown.

**Actionable Recommendation**: Worker 1 must update `e2e/run_e2e.ts` so that when `preSeedRetries` (and `postBuildRetries`) trigger a Supabase restart, the script explicitly stops Supabase and cleans up containers/volumes before calling `npx supabase start`, OR uses `npx supabase stop --no-backup` followed by `npx supabase start --ignore-health-check`, ensuring a clean startup without migration conflicts.

---

## 5. Verification Method

### Automated Verification Commands
To independently verify these findings, execute the following commands in sequence:

1. **Prerequisite Cleanup**:
   ```bash
   fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true
   ```
2. **TypeScript Compilation**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsc --noEmit
   ```
   *Expected: Completes successfully with zero errors.*
3. **Unit Tests**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm run test __tests__/planner
   ```
   *Expected: Completes successfully with 100% passing unit tests (9/9 passed).*
4. **E2E Test Runner**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts
   ```
   *Expected: Fails with exit code 1, displaying `ERROR: duplicate key value violates unique constraint "schema_migrations_pkey"` and `Supabase pre-seed health check failed: http://127.0.0.1:54321 is unreachable.`*

### Inspection Verification
- Inspect `e2e/run_e2e.ts` lines 170-175 to observe the flawed restart logic:
  ```typescript
  if (preSeedRetries === 15 || preSeedRetries === 10 || preSeedRetries === 5) {
    console.log('Supabase seems unresponsive pre-seed. Attempting to restart Supabase...');
    try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('npx supabase start --ignore-health-check', { stdio: 'inherit' }); } catch(err){}
  }
  ```
