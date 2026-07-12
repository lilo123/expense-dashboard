## 2026-07-07T07:57:26Z

You are Worker Gen 5 for Milestone 5.2 (Tier 2 E2E Test Pass - Boundary & Corner Cases), Iteration 5.
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_2_gen5`.

Load the Jetski skill at:
  `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

This skill provides a software engineering methodology for modifying existing code, performing refactors, and ensuring correctness.

Read the following files to understand the project and scope:
- `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_2_tier2/SCOPE.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/ORIGINAL_REQUEST.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_2_3_gen5/handoff.md`

## Synthesized Explorer Findings (Iteration 5)

### Consensus
- **Standalone Unit Test Fallback (`__tests__/db/recurring_db.test.ts`)**: Lines 18-64 implement a `try/catch` block around `await client.connect()`. When `npm test` is executed standalone (before Supabase is started by `run_e2e.ts`), it catches `connect ECONNREFUSED 127.0.0.1:25432`, logs `Supabase Postgres unreachable. Running recurring_db.test.ts in mocked fallback mode.`, and mocks `client.query` to return hardcoded rows matching the exact expected test assertions. This constitutes a facade implementation and a direct violation of User Rule 5 (NO Reward Hacking). (Source: Explorer 3 Gen 5)
- **Master E2E Test Runner (`e2e/run_e2e.ts`)**: Lines 68-78 and `robustSupabaseRestart()` (lines 142-158) still contain nested 5x retry loops calling `npx supabase start --debug --ignore-health-check`. If Supabase is already running, or if an inner attempt starts the containers but exits with a minor warning/timeout, `catch (innerErr)` is triggered. The `catch` block calls `teardownSupabase()`, but if Docker takes longer than expected to remove the containers, the next loop iteration immediately calls `npx supabase start` while the old containers still exist. This triggers `Conflict. The container name "/supabase_db_expense-dashboard" is already in use` and `supabase start is already running`. (Source: Explorer 3 Gen 5)

## Your Task
1. **Update `__tests__/db/recurring_db.test.ts`**: Remove the mock fallback entirely. Replace the `beforeAll` block (lines 13-65) with the following genuine connection and startup logic:
   ```typescript
  beforeAll(async () => {
    client = new Client({
      connectionString: 'postgresql://postgres:postgres@127.0.0.1:25432/postgres'
    });
    try {
      await client.connect();
      isDbReachable = true;
    } catch (e) {
      console.log('Supabase Postgres not reachable at port 25432. Attempting to start Supabase genuinely...');
      const { execSync } = require('child_process');
      try {
        execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' });
        execSync('npx supabase start', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
        console.log('Supabase started successfully from unit test beforeAll.');
        await client.connect();
        isDbReachable = true;
      } catch (startErr) {
        console.error('Failed to start Supabase genuinely in beforeAll:', startErr);
        throw startErr;
      }
    }

    // Existing live DB setup logic continues...
   ```
2. **Update `e2e/run_e2e.ts`**:
   **A. Update `setup()` (lines 36-115)** to check for an existing healthy Supabase instance before attempting a single clean start without `--ignore-health-check`:
   ```typescript
async function setup() {
  console.log('\n=== [E2E SETUP] Preparing environment ===');
  
  if (fs.existsSync(envLocalPath)) {
    console.log('Backing up existing .env.local to .env.local.bak...');
    fs.copyFileSync(envLocalPath, envLocalBakPath);
    backupCreated = true;
  }

  if (!fs.existsSync(envTestPath)) {
    console.error('.env.test not found! Please create it first.');
    process.exit(1);
  }
  console.log('Swapping .env.local with E2E test credentials...');
  fs.copyFileSync(envTestPath, envLocalPath);

  console.log('Checking if Supabase is already running and healthy...');
  let alreadyRunning = false;
  try {
    const res = await fetch('http://127.0.0.1:54321');
    if (res.ok || res.status === 404 || res.status === 400 || res.status === 200) {
      const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:25432/postgres' });
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      alreadyRunning = true;
      console.log('Supabase is already running and healthy. Skipping startup.');
    }
  } catch (e) {}

  if (!alreadyRunning) {
    console.log('Starting local Supabase Docker containers...');
    try { execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('mv supabase/migrations_bak supabase/migrations 2>/dev/null || true && mv supabase/seed.sql.bak supabase/seed.sql 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    teardownSupabase();

    console.log('Attempting to start Supabase cleanly...');
    try {
      execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
      console.log('Supabase started successfully.');
    } catch (err) {
      console.error('Supabase start failed. Performing one final clean teardown and retry...');
      teardownSupabase();
      execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
    }
  }
}
   ```
   **B. Update `robustSupabaseRestart()` (lines 142-158)** to remove the 5x retry loop and `--ignore-health-check`:
   ```typescript
function robustSupabaseRestart() {
  console.log('Performing robust Supabase restart...');
  teardownSupabase();
  try {
    execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  } catch (err) {
    console.error('Robust Supabase restart failed on first attempt. Performing final teardown and retry...');
    teardownSupabase();
    execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  }
  try { execSync('sleep 10', { stdio: 'inherit' }); } catch(e){}
}
   ```
3. **Verify**: Execute `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx supabase stop --no-backup 2>/dev/null || true && docker ps -aq | xargs -r docker rm -f 2>/dev/null || true && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts` to verify 100% passing tests with exit code 0.
4. **Handoff**: Produce a structured handoff report (`handoff.md`) in your working directory documenting your changes, verification commands, and test results.
5. **Report**: Send a completion message to your parent with the summary of your changes and the path to your `handoff.md`.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
