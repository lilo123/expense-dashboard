# Milestone 5.3 Explorer Analysis & Handoff Report

## 1. Observation
- **Sequential Execution Failure**: Chaining `npx tsx e2e/adv_supabase_dns_nxdomain.ts` followed by `npx tsx e2e/run_e2e.ts` causes `run_e2e.ts` to fail during database initialization (`npx tsx e2e/init_db.ts`) with the verbatim error:
  ```
  Failed to initialize database: relation "public.expenses" does not exist
  E2E Tests execution failed! Error: Command failed: npx tsx e2e/init_db.ts
  ```
- **`alreadyRunning` Bypass in `e2e/run_e2e.ts`**: Lines 49-63 of `e2e/run_e2e.ts` check if Supabase is already running by fetching `http://127.0.0.1:54321` and executing `SELECT 1` on port 25432. Because `e2e/adv_supabase_dns_nxdomain.ts` starts Supabase just before `run_e2e.ts`, `alreadyRunning` evaluates to `true`, logging `Supabase is already running and healthy. Skipping startup.`
- **Skipped Teardown & Stale Migrations**: When `alreadyRunning` is true, `run_e2e.ts` skips `teardownSupabase()` and `npx supabase start --debug`. Later, at line 216, it runs `npx --no-install supabase migration up --include-all`. Because the database container is reused from `adv_supabase_dns_nxdomain.ts`, `supabase migration up` sees existing migration records in the migration history table and does nothing (`{"applied":[],"message":"Migrations applied"}`), leaving the `public.expenses` table uncreated/missing.
- **`PlatformError` in `e2e/adv_supabase_dns_nxdomain.ts`**: During `adv_supabase_dns_nxdomain.ts`, `execSync('npx --no-install supabase start --debug', ...)` can fail with `PlatformError`:
  ```
  {"_tag":"Error","error":{"code":"PlatformError","message":"Unknown: ChildProcess.exitCode (/usr/local/google/home/duynguyenn/.npm/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-linux-x64/bin/supabase-go --output json --debug start)"}}
  ```
  `adv_supabase_dns_nxdomain.ts` (lines 18-50) catches the `execSync` error but only polls `http://127.0.0.1:54321` without ever retrying `npx supabase start`. If the container failed to start, it exits with code 1.
- **Fragile Restart Logic in `e2e/run_e2e.ts`**: `robustSupabaseRestart()` (lines 140-151) and `setup()` (lines 70-112) in `e2e/run_e2e.ts` perform at most one retry of `npx supabase start --debug`. If the second `execSync` throws `PlatformError`, it results in an uncaught exception, terminating the test runner.

## 2. Logic Chain
- **Step 1 (Stale Container Reuse)**: `adv_supabase_dns_nxdomain.ts` starts Supabase to test DNS resilience but does not guarantee a clean database schema. When `run_e2e.ts` runs immediately after, its `alreadyRunning` check succeeds, bypassing `teardownSupabase()`.
- **Step 2 (Migration No-Op & Crash)**: Because `teardownSupabase()` is bypassed, `run_e2e.ts` operates against the dirty database container. `npx --no-install supabase migration up --include-all` assumes migrations are already applied. When `e2e/init_db.ts` attempts `ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;`, Postgres throws `relation "public.expenses" does not exist`, crashing the E2E suite.
- **Step 3 (Absence of Retry Loops for `PlatformError`)**: The underlying `supabase-go` binary spawned by `npx supabase start` is prone to occasional `PlatformError` (`Unknown: ChildProcess.exitCode`) during container turn-up. Because `adv_supabase_dns_nxdomain.ts` lacks a retry loop and `run_e2e.ts` lacks a robust multi-attempt retry loop with error inspection, any `PlatformError` fatal-exits the E2E verification suite.

## 3. Caveats
- **Read-Only Investigation**: As an explorer agent, no code changes were implemented. The proposed fix strategy must be implemented by a subsequent implementer agent.
- **Supabase CLI Behavior**: The strategy assumes `npx --no-install supabase start --debug` is inherently idempotent when preceded by `teardownSupabase()`.

## 4. Conclusion & Bulletproof Fix Strategy
To achieve a bulletproof Tier 3 E2E test pass, the implementer must apply the following surgical changes to `e2e/run_e2e.ts` and `e2e/adv_supabase_dns_nxdomain.ts`:

### Part 1: Modifications to `e2e/run_e2e.ts`
1. **Remove `alreadyRunning` Bypass**:
   - In `setup()` (lines 49-113), remove the `alreadyRunning` check entirely so that `teardownSupabase()` and Supabase startup run **unconditionally**.
2. **Implement `startSupabaseWithRetry()` Helper**:
   - Create a robust helper function `startSupabaseWithRetry()` that attempts `npx --no-install supabase start --debug` up to 5 times.
   - In the `catch` block, explicitly log and inspect the error for `PlatformError` or `ChildProcess.exitCode`, execute `teardownSupabase()`, and retry.
   - Replace the startup logic in `setup()` and `robustSupabaseRestart()` with `startSupabaseWithRetry()`.
3. **Ensure Clean Database Schema**:
   - Replace `npx --no-install supabase migration up --include-all` (line 216) with `npx --no-install supabase db reset` to guarantee a clean database schema, or keep `migration up` since `teardownSupabase()` will now run unconditionally. (Using `db reset` provides an extra layer of guarantee).

#### Proposed Code Snippet for `e2e/run_e2e.ts`:
```typescript
// Insert helper function above setup()
async function startSupabaseWithRetry() {
  console.log('Attempting to start Supabase with robust retry loop...');
  let attempts = 5;
  while (attempts > 0) {
    try {
      teardownSupabase();
      console.log(`Starting Supabase (Attempts left: ${attempts})...`);
      execSync('npx --no-install supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
      
      // Verify reachability
      let checkRetries = 30;
      let reachable = false;
      while (checkRetries > 0 && !reachable) {
        try {
          const res = await fetch('http://127.0.0.1:54321');
          if (res.ok || res.status === 404 || res.status === 400 || res.status === 200) {
            reachable = true;
            break;
          }
        } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 1000));
        checkRetries--;
      }
      if (reachable) {
        console.log('✔ Supabase started successfully and is reachable.');
        return;
      } else {
        console.warn('Supabase started but http://127.0.0.1:54321 is unreachable.');
      }
    } catch (err: any) {
      console.error('Supabase start execSync threw an error:', err.message || err);
      if (err.message && (err.message.includes('PlatformError') || err.message.includes('ChildProcess.exitCode'))) {
        console.warn('Caught PlatformError / ChildProcess.exitCode. Initiating clean teardown and retry...');
      }
    }
    attempts--;
    if (attempts === 0) {
      throw new Error('Failed to start Supabase after 5 robust attempts.');
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// Update setup() to remove alreadyRunning bypass
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

  console.log('Starting local Supabase Docker containers unconditionally...');
  try { execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('mv supabase/migrations_bak supabase/migrations 2>/dev/null || true && mv supabase/seed.sql.bak supabase/seed.sql 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  
  await startSupabaseWithRetry();
}

// Update robustSupabaseRestart() to use startSupabaseWithRetry()
async function robustSupabaseRestart() {
  console.log('Performing robust Supabase restart...');
  await startSupabaseWithRetry();
  try { execSync('sleep 10', { stdio: 'inherit' }); } catch(e){}
}
```

### Part 2: Modifications to `e2e/adv_supabase_dns_nxdomain.ts`
1. **Import `teardownSupabase()`**:
   - Copy the full `teardownSupabase()` function from `e2e/run_e2e.ts` into `e2e/adv_supabase_dns_nxdomain.ts`.
2. **Add Robust Retry Loop**:
   - Wrap `execSync('npx --no-install supabase start --debug', ...)` in a retry loop (up to 5 attempts) that catches `PlatformError` / `Unknown: ChildProcess.exitCode`, executes `teardownSupabase()`, and retries.

#### Proposed Code Snippet for `e2e/adv_supabase_dns_nxdomain.ts`:
```typescript
import { execSync } from 'child_process';

const supabaseEnv = {
  ...process.env,
  NODE_OPTIONS: '--max-old-space-size=512',
  DB_HOST: '127.0.0.1',
  SUPABASE_DB_HOST: '127.0.0.1',
  SUPABASE_INTERNAL_DB_HOST: '127.0.0.1',
  SUPABASE_INTERNAL_HOST: '127.0.0.1',
  SUPABASE_DAEMON_ENABLE: 'false',
  SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1',
  DOCKER_DEFAULT_PLATFORM: 'linux/amd64'
};

function teardownSupabase() {
  console.log('Performing bulletproof Supabase teardown and cleanup...');
  try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
  try { execSync('npx --no-install supabase stop --no-backup 2>/dev/null || true', { stdio: 'ignore', timeout: 10000 }); } catch(e){}
  try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -aq --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done', { stdio: 'ignore' }); } catch(e){}
  try { execSync('sleep 2', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
}

async function verifySupabaseDnsResolution() {
  console.log('\n=== [ADVERSARIAL TEST] Validating Supabase CLI Docker Network DNS Resolution (DB_HOST: nxdomain) ===');

  let attempts = 5;
  while (attempts > 0) {
    try {
      console.log(`Stopping any existing Supabase instances before clean start (Attempts left: ${attempts})...`);
      teardownSupabase();
      console.log('Attempting npx supabase start --debug...');
      execSync('npx --no-install supabase start --debug', { stdio: 'inherit', env: supabaseEnv });
      console.log('✔ Supabase started successfully without DNS nxdomain errors.');
      process.exit(0);
    } catch (err: any) {
      console.warn('npx supabase start execSync threw an error:', err.message || err);
      if (err.message && (err.message.includes('PlatformError') || err.message.includes('ChildProcess.exitCode'))) {
        console.warn('Caught PlatformError / ChildProcess.exitCode. Initiating clean teardown and retry...');
      }
      console.warn('Checking if containers successfully started in the background...');
      let checkRetries = 30;
      let reachable = false;
      while (checkRetries > 0 && !reachable) {
        try {
          const res = await fetch('http://127.0.0.1:54321');
          if (res.ok || res.status === 404 || res.status === 400 || res.status === 200) {
            reachable = true;
            break;
          }
        } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 1000));
        checkRetries--;
      }
      if (reachable) {
        console.log('✔ Supabase started successfully without DNS nxdomain errors (verified via health check).');
        process.exit(0);
      } else {
        console.error(`\n[FAIL] Supabase start failed on attempt ${6 - attempts}.`);
      }
    }
    attempts--;
    if (attempts === 0) {
      console.error('\n[FATAL] Supabase start failed after 5 robust attempts with DNS resolution error (DB_HOST: nxdomain).');
      process.exit(1);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

verifySupabaseDnsResolution();
```

## 5. Verification Method
Once the implementer applies these changes, verify the fix using the following command suite:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/adv_supabase_dns_nxdomain.ts && export NODE_OPTIONS=--max-old-space-size=256 && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
**Success Criteria**:
1. `e2e/adv_supabase_dns_nxdomain.ts` successfully starts Supabase (retrying cleanly if `PlatformError` occurs) and exits with code 0.
2. `e2e/run_e2e.ts` unconditionally tears down the Supabase instance left by `adv_supabase_dns_nxdomain.ts`, performs a clean start (retrying if needed), successfully applies migrations/resets the database, and completes all E2E Playwright tests with exit code 0.
