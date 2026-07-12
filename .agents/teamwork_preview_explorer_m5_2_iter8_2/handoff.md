# Handoff Report — Milestone 5.2 Explorer 2 Investigation (Migration Lifecycle Audit)

## Observation
- **File Inspection (`__tests__/db/recurring_db.test.ts`)**:
  - Lines 15-36 define `beforeAll(async () => { ... })`. It attempts `await client.connect();`.
  - If `client.connect()` throws an error, it enters the `catch (e)` block (lines 22-36), where it executes `npx supabase start` and `npx tsx e2e/init_db.ts`.
  - If `client.connect()` succeeds, the `catch (e)` block is completely bypassed. There is no subsequent check to verify if database migrations have been applied or if tables exist before executing queries.
  - Line 98 executes `const profileRes = await client.query('SELECT id FROM public.profiles LIMIT 1');`.
- **File Inspection (`e2e/run_e2e.ts`)**:
  - Lines 14-29 define `teardownSupabase()`, which performs a robust cleanup including `pkill -9 -f "supabase-go"`, `pkill -9 -f supabase`, `docker rm -f`, and `fuser -k 25432/tcp`.
  - Lines 208-231 in `run()` explicitly execute `npx --no-install supabase migration up --include-all` and `npx tsx e2e/init_db.ts` before invoking `npm test`.
- **Verification Command Flaw & Error Logs (Auditor Report)**:
  - The standalone verification command used by Worker Gen 7 (`npx supabase stop --no-backup 2>/dev/null || true && docker ps -aq | xargs -r docker rm -f 2>/dev/null || true && npm test`) does NOT execute `pkill -9 -f supabase-go` or `fuser -k 25432/tcp`.
  - As a result, port 25432 remains reachable via lingering `supabase-go` daemon processes, but the underlying database lacks the DDL migrations/schema.
  - When `npm test` runs `__tests__/db/recurring_db.test.ts`, `client.connect()` succeeds, skipping the `catch` block. Line 98 then fails with the fatal error: `error: relation "public.profiles" does not exist`.

## Logic Chain
1. When `npm test` is executed via `e2e/run_e2e.ts`, migrations (`npx supabase migration up --include-all`) and initialization (`npx tsx e2e/init_db.ts`) are explicitly run before the test suite starts (observed in `e2e/run_e2e.ts` lines 208-231).
2. However, when `npm test` is executed via standalone verification commands (such as Worker Gen 7's `task-45`), `e2e/run_e2e.ts` is not invoked prior to `npm test`.
3. Because the standalone verification command only runs `npx supabase stop --no-backup` and `docker rm -f` without killing `supabase-go` or port 25432 (observed in Auditor Report), port 25432 remains active and reachable.
4. When `__tests__/db/recurring_db.test.ts` runs its `beforeAll` block (lines 15-36), `await client.connect()` successfully connects to port 25432.
5. Because `await client.connect()` succeeds, the `catch (e)` block is never entered, meaning `npx supabase start` and `npx tsx e2e/init_db.ts` are skipped.
6. Furthermore, because `npx supabase migration up --include-all` is neither in the `try` block nor in `beforeAll` outside the `catch` block, the database remains without DDL migrations or the `public.profiles` table.
7. Consequently, line 98 (`await client.query('SELECT id FROM public.profiles LIMIT 1');`) fails with `error: relation "public.profiles" does not exist`, causing `npm test` to fail with exit code 1, which constitutes an INTEGRITY VIOLATION under `Integrity mode: demo`.

## Caveats
- **Scope Limitation**: The investigation was conducted in read-only mode as per `Key Constraints`. No code changes were directly implemented or executed.
- **Environment Assumptions**: It is assumed that `npx supabase migration up --include-all` and `npx tsx e2e/init_db.ts` are sufficient to fully populate the database schema when executed against a running Supabase instance.

## Conclusion
- **Root Cause**: `__tests__/db/recurring_db.test.ts` suffers from flawed migration lifecycle logic. It conflates database reachability (`client.connect()`) with database readiness/schema integrity. When port 25432 is reachable but unmigrated, `beforeAll` silently skips starting Supabase and applying migrations, leading to fatal relation errors during test execution.
- **Recommended Fix Strategy**:
  Modify `beforeAll` in `__tests__/db/recurring_db.test.ts` to explicitly verify table existence and apply migrations if needed. Specifically:
  1. Attempt `await client.connect()`. If it fails, execute `npx supabase start`, `npx supabase migration up --include-all`, and `npx tsx e2e/init_db.ts`, then reconnect.
  2. If `client.connect()` succeeds, explicitly check if the `profiles` table exists:
     ```typescript
     const tableCheck = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles'");
     if (tableCheck.rows.length === 0) {
       console.log('Database reachable but public.profiles does not exist. Running migrations and init_db...');
       const { execSync } = require('child_process');
       execSync('npx --no-install supabase migration up --include-all', { stdio: 'inherit' });
       execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
     }
     ```
  3. This guarantees that regardless of whether `client.connect()` succeeds initially or whether lingering `supabase-go` daemons keep port 25432 open, the required DDL migrations and seed data are reliably present before any test queries execute.

## Verification Method
- **Commands to Inspect & Verify**:
  1. Inspect `__tests__/db/recurring_db.test.ts` to ensure the `beforeAll` block contains the `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles'` check and corresponding migration execution logic.
  2. Run the standalone verification command that previously failed:
     ```bash
     npx supabase stop --no-backup 2>/dev/null || true && docker ps -aq | xargs -r docker rm -f 2>/dev/null || true && npm test
     ```
  3. Run the full E2E test runner to ensure no regressions in the broader suite:
     ```bash
     npx tsx e2e/run_e2e.ts
     ```
- **Expected Outcome**: Both `npm test` and `npx tsx e2e/run_e2e.ts` must complete successfully with exit code 0, with all 246 tests passing and zero `relation "public.profiles" does not exist` errors.
