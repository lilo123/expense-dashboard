# Handoff Report — Milestone 5.2, Iteration 8 (Explorer 3 Investigation)

## Observation
- **Flawed Migration Lifecycle Logic**: Inspection of `__tests__/db/recurring_db.test.ts` (lines 15-36) revealed that `npx supabase start` and `npx tsx e2e/init_db.ts` are placed strictly inside the `catch (e)` block of `await client.connect()`.
- **Bypass of Migrations on Port Reachability**: When `await client.connect()` successfully connects to port 25432 (e.g., due to lingering `supabase-go` daemon processes or unkilled database containers from previous runs), the `catch (e)` block is completely bypassed.
- **Missing Table Verification**: `__tests__/db/recurring_db.test.ts` does not verify whether required database tables exist (e.g., `public.profiles`) before proceeding to execute test queries.
- **Fatal Relation Error**: Consequently, when `npm test` runs and `__tests__/db/recurring_db.test.ts` executes `const profileRes = await client.query('SELECT id FROM public.profiles LIMIT 1');` (line 98), it fails with `error: relation "public.profiles" does not exist`, causing `npm test` to fail with exit code 1.
- **Master E2E Runner Comparison**: Inspection of `e2e/run_e2e.ts` (lines 14-29, 208-232) shows a bulletproof teardown sequence (`pkill -9 -f "supabase-go"`, `fuser -k 25432/tcp`) and explicit execution of `npx --no-install supabase migration up --include-all` and `npx tsx e2e/init_db.ts` prior to invoking `npm test`. However, standalone verification commands (`npx supabase stop --no-backup 2>/dev/null || true && docker ps -aq | xargs -r docker rm -f 2>/dev/null || true && npm test`) lack these aggressive process kills, leaving `npm test` vulnerable to the flawed `beforeAll` lifecycle in `__tests__/db/recurring_db.test.ts`.

## Logic Chain
1. Standalone verification commands execute `npx supabase stop --no-backup` and `docker rm -f`, but do not execute `pkill -9 -f supabase-go` or `fuser -k 25432/tcp` before invoking `npm test`.
2. Because `supabase-go` is not killed and port 25432 remains active, `await client.connect()` in `__tests__/db/recurring_db.test.ts` successfully connects to the lingering database instance.
3. Because `await client.connect()` succeeds, the `catch (e)` block in `beforeAll` is never entered.
4. Because the `catch (e)` block is bypassed and there is no secondary check for table existence, `npx supabase migration up --include-all` and `npx tsx e2e/init_db.ts` are never executed.
5. This leaves the database instance without DDL migrations or the `public.profiles` table.
6. When `__tests__/db/recurring_db.test.ts` attempts to query `public.profiles`, it suffers a fatal relation error (`error: relation "public.profiles" does not exist`), causing `npm test` to fail with exit code 1 and triggering an INTEGRITY VIOLATION.

## Caveats
- No caveats. The investigation directly confirmed the exact mechanism of failure reported in the Forensic Auditor Gen 7 Full Evidence Report.

## Conclusion
To ensure `npx supabase migration up --include-all` and `npx tsx e2e/init_db.ts` are reliably executed in `__tests__/db/recurring_db.test.ts` regardless of whether `client.connect()` succeeds initially, the `beforeAll` block must be updated to explicitly verify table existence (`SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles'`) before deciding whether to run migrations.

### Recommended Code Fix (to be implemented by Worker)
Update `__tests__/db/recurring_db.test.ts` `beforeAll` block (lines 15-37) to the following:

```typescript
  beforeAll(async () => {
    client = new Client({
      connectionString: 'postgresql://postgres:postgres@127.0.0.1:25432/postgres'
    });
    let needsInit = false;
    try {
      await client.connect();
      isDbReachable = true;
      // Explicitly verify if the schema is actually initialized
      const tableCheck = await client.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles'");
      if (tableCheck.rows.length === 0) {
        console.log('Supabase Postgres is reachable, but public.profiles table does not exist. Migrations needed.');
        needsInit = true;
      }
    } catch (e) {
      console.log('Supabase Postgres unreachable at port 25432. Attempting to start Supabase genuinely...');
      const { execSync } = require('child_process');
      try {
        execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' });
        execSync('npx supabase start', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
        await client.connect();
        isDbReachable = true;
        needsInit = true;
      } catch (startErr) {
        console.error('Failed to start Supabase genuinely in beforeAll:', startErr);
        throw startErr;
      }
    }

    if (needsInit) {
      const { execSync } = require('child_process');
      console.log('Running database migrations and init_db.ts...');
      execSync('npx supabase migration up --include-all', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
      execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
      console.log('Supabase migrations and initialization completed successfully.');
    }
```

## Verification Method
1. Implement the recommended fix in `__tests__/db/recurring_db.test.ts`.
2. Run the exact standalone verification command that previously failed:
   ```bash
   npx supabase stop --no-backup 2>/dev/null || true && docker ps -aq | xargs -r docker rm -f 2>/dev/null || true && npm test
   ```
3. Verify that `npm test` completes successfully with exit code 0 and all 246 tests pass.
4. Run the full E2E test suite to ensure no regressions:
   ```bash
   npx tsx e2e/run_e2e.ts
   ```
