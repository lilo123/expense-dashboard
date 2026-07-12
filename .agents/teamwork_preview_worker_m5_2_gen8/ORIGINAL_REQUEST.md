## 2026-07-07T09:05:05Z
You are Worker Gen 8 for Milestone 5.2 (Tier 2 E2E Test Pass - Boundary & Corner Cases), Iteration 8.
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_2_gen8`.

Load the Jetski skill at:
  `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

This skill provides a software engineering methodology for modifying existing code, performing refactors, and ensuring correctness.

Read the following files to understand the project and scope:
- `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_2_tier2/SCOPE.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/ORIGINAL_REQUEST.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_2_iter8_2/handoff.md`

## Synthesized Explorer Findings (Iteration 8)

### Consensus
- **Flawed Migration Lifecycle Logic (`__tests__/db/recurring_db.test.ts`)**: `__tests__/db/recurring_db.test.ts` conflates database reachability (`client.connect()`) with database readiness/schema integrity. When port 25432 is reachable via lingering `supabase-go` daemon processes after `npx supabase stop`, `await client.connect()` succeeds and completely bypasses the `catch (e)` block where migrations (`npx supabase start`, `npx supabase migration up --include-all`, `npx tsx e2e/init_db.ts`) are located. Because it fails to verify whether tables like `public.profiles` exist, subsequent queries fail with `error: relation "public.profiles" does not exist`, causing `npm test` to fail with exit code 1 (INTEGRITY VIOLATION). (Sources: Explorer 2 and Explorer 3 Iteration 8)

## Your Task
1. **Update `__tests__/db/recurring_db.test.ts`**: Modify `beforeAll` (lines 15-45) to explicitly verify table existence (`SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles'`) and apply migrations if needed. Specifically:
   ```typescript
  beforeAll(async () => {
    client = new Client({
      connectionString: 'postgresql://postgres:postgres@127.0.0.1:25432/postgres'
    });
    const { execSync } = require('child_process');
    try {
      await client.connect();
      isDbReachable = true;
      console.log('Connected to Supabase Postgres at port 25432. Checking if public.profiles exists...');
      const tableCheck = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles'");
      if (tableCheck.rows.length === 0) {
        console.log('Database reachable but public.profiles does not exist. Running migrations and init_db...');
        execSync('npx --no-install supabase migration up --include-all', { stdio: 'inherit' });
        execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
      } else {
        console.log('public.profiles exists. Database is ready.');
      }
    } catch (e) {
      console.log('Supabase Postgres not reachable at port 25432. Attempting to start Supabase genuinely...');
      try {
        execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' });
        execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' });
        execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' });
        execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' });
        execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' });
        execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' });
        execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' });
        execSync('npx supabase start', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
        console.log('Supabase started successfully from unit test beforeAll. Running migrations and init_db...');
        execSync('npx --no-install supabase migration up --include-all', { stdio: 'inherit' });
        execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
        await client.connect();
        isDbReachable = true;
      } catch (startErr) {
        console.error('Failed to start Supabase genuinely in beforeAll:', startErr);
        throw startErr;
      }
    }

    // Existing live DB setup logic continues...
   ```
2. **Verify**: Execute `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx supabase stop --no-backup 2>/dev/null || true && docker ps -aq | xargs -r docker rm -f 2>/dev/null || true && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts` to verify 100% passing tests with exit code 0.
3. **Handoff**: Produce a structured handoff report (`handoff.md`) in your working directory documenting your changes, verification commands, and test results.
4. **Report**: Send a completion message to your parent with the summary of your changes and the path to your `handoff.md`.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
