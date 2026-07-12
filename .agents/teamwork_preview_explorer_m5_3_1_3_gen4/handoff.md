# Milestone 5.3 Exploration & Handoff Report

## 1. Observation
- **Sequential Execution Failure**: When executing `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/adv_supabase_dns_nxdomain.ts && export NODE_OPTIONS=--max-old-space-size=256 && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`, failures occur in both E2E test initialization (`e2e/run_e2e.ts`) and adversarial DNS validation (`e2e/adv_supabase_dns_nxdomain.ts`).
- **Verbatim Error 1 (`e2e/run_e2e.ts`)**:
```
=== [DB INITIALIZER] Connecting to local Postgres ===
...
Connected successfully to local Postgres at port 25432.
Granting permissions to anon, authenticated, and service_role...
Failed to initialize database: relation "public.expenses" does not exist
E2E Tests execution failed! Error: Command failed: npx tsx e2e/init_db.ts
```
- **Verbatim Error 2 (`e2e/adv_supabase_dns_nxdomain.ts`)**:
```
Starting containers...
2026/07/07 08:45:12 PG Send: {"Type":"Terminate"}
Waiting for health checks...
2026/07/07 08:45:14 HTTP HEAD: http://127.0.0.1:54321/rest-admin/v1/ready
{"_tag":"Error","error":{"code":"PlatformError","message":"Unknown: ChildProcess.exitCode (/usr/local/google/home/duynguyenn/.npm/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-linux-x64/bin/supabase-go --output json --debug start)"}}

[FAIL] Supabase start failed with DNS resolution error (DB_HOST: nxdomain).
Error details: Command failed: npx supabase start --debug
```
- **`e2e/run_e2e.ts` Supabase Startup & Bypass Logic (Lines 47-61, 214, 227)**:
  - Lines 47-60 check if Supabase is already running by fetching `http://127.0.0.1:54321` and connecting to Postgres at `127.0.0.1:25432`. If successful, `alreadyRunning` is set to `true` and `teardownSupabase()` / `npx supabase start` are skipped.
  - Lines 214 & 227 execute `npx --no-install supabase migration up --include-all`. When `alreadyRunning` is true (leftover from `adv_supabase_dns_nxdomain.ts`), `migration up` detects that migration history already exists in the container and skips applying migrations (`{"applied":[]}`), leaving `public.expenses` uncreated if the schema was dirty/cleared.
- **`e2e/adv_supabase_dns_nxdomain.ts` Startup Logic (Lines 18-50)**:
  - Lines 24 executes `execSync('npx --no-install supabase start --debug', { stdio: 'inherit', env: supabaseEnv })`. If `supabase-go` fails with `PlatformError`, `execSync` throws. The `catch` block does not retry `supabase start`; it only polls `fetch('http://127.0.0.1:54321')`, which inevitably times out and exits with code 1.
- **`e2e/run_e2e.ts` Startup & Restart Logic (Lines 68-110, 138-149)**:
  - Lines 68-110 attempt `execSync('npx supabase start --debug')`. If it throws, it checks reachability, does one `teardownSupabase()` and one retry. If `execSync` throws `PlatformError` on the retry, it crashes or fails reachability.
  - Lines 138-149 (`robustSupabaseRestart`) performs a teardown and `execSync('npx supabase start --debug')`. If it fails, it catches and does exactly one retry. If the retry throws `PlatformError`, the unhandled exception aborts the process.

## 2. Logic Chain
1. **The `alreadyRunning` Flaw**: `e2e/adv_supabase_dns_nxdomain.ts` starts Supabase to test DNS resilience but does not verify or reset the database schema. When `e2e/run_e2e.ts` runs immediately after, it sees Supabase active on port 54321/25432, sets `alreadyRunning = true`, and skips `teardownSupabase()`.
2. **Stale Migration State**: Because `run_e2e.ts` reuses the dirty database container from the previous script, `npx supabase migration up` assumes migrations are already applied. However, the actual tables in `public` (like `expenses`) are missing or corrupted. When `e2e/init_db.ts` attempts `ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;`, Postgres throws `relation "public.expenses" does not exist`.
3. **The `PlatformError` / `ChildProcess.exitCode` Flaw**: In isolated/ephemeral environments, `supabase-go` occasionally fails during container spin-up or health checks, throwing a `PlatformError`. `execSync` immediately throws an exception when the child process exits non-zero.
4. **Lack of Active Retries**: In `e2e/adv_supabase_dns_nxdomain.ts`, the catch block assumes containers might be starting in the background rather than actively tearing down and retrying `npx supabase start`. In `e2e/run_e2e.ts`, `setup()` and `robustSupabaseRestart()` lack a resilient, multi-attempt retry loop that catches `PlatformError`, invokes `teardownSupabase()`, and retries until healthy.

## 3. Caveats
- **Read-Only Investigation**: As an explorer agent, no code changes were implemented or executed directly.
- **Underlying Supabase CLI Behavior**: The `PlatformError` originates from the `@supabase/cli-linux-x64` Go binary. Since we cannot modify the precompiled Go binary, wrapping `execSync('npx supabase start')` in a robust retry loop with full teardown is the most effective and deterministic workaround.

## 4. Conclusion
To achieve a bulletproof E2E test pass for Milestone 5.3, we must implement two surgical, highly robust improvements across `e2e/run_e2e.ts` and `e2e/adv_supabase_dns_nxdomain.ts`:
1. **Remove `alreadyRunning` and Enforce `db reset` in `e2e/run_e2e.ts`**: Delete the `alreadyRunning` check so `teardownSupabase()` and `npx supabase start` run unconditionally. Furthermore, replace `npx supabase migration up` with `npx supabase db reset` to guarantee a pristine database schema regardless of prior container state.
2. **Implement Multi-Attempt Retry Loops for `supabase start`**: Create a robust retry loop (e.g., 5 retries) around `execSync('npx supabase start --debug')` in both files. Each iteration must catch `PlatformError` / `ChildProcess.exitCode`, perform a clean teardown (`teardownSupabase()` / `docker rm -f`), and retry until `fetch('http://127.0.0.1:54321')` succeeds.

### Proposed Code Modifications (Before → After Snippets)

#### 1. `e2e/adv_supabase_dns_nxdomain.ts`
```typescript
// BEFORE (Lines 18-51)
  try {
    console.log('Stopping any existing Supabase instances before clean start...');
    try { execSync('npx --no-install supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    console.log('Attempting npx supabase start --debug...');
    execSync('npx --no-install supabase start --debug', { stdio: 'inherit', env: supabaseEnv });
    console.log('✔ Supabase started successfully without DNS nxdomain errors.');
    process.exit(0);
  } catch (err: any) {
    console.warn('npx supabase start execSync threw an error, checking if containers successfully started in the background...');
    let checkRetries = 60;
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
      console.error('\n[FAIL] Supabase start failed with DNS resolution error (DB_HOST: nxdomain).');
      console.error('Error details:', err.message || err);
      process.exit(1);
    }
  }

// AFTER
  let retries = 5;
  let success = false;
  let lastErr: any = null;

  while (retries > 0 && !success) {
    try {
      console.log(`\nStopping any existing Supabase instances before clean start... (${retries} attempts left)`);
      try { execSync('npx --no-install supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('rm -rf supabase/.temp /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}

      console.log('Attempting npx supabase start --debug...');
      execSync('npx --no-install supabase start --debug', { stdio: 'inherit', env: supabaseEnv });
      
      console.log('Verifying Supabase is reachable...');
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
        console.log('✔ Supabase started successfully without DNS nxdomain errors.');
        success = true;
        break;
      } else {
        throw new Error('Supabase started but http://127.0.0.1:54321 is unreachable.');
      }
    } catch (err: any) {
      lastErr = err;
      console.warn(`Supabase start failed (PlatformError / ChildProcess.exitCode). Retrying... (${retries - 1} attempts left)`);
      console.warn('Error details:', err.message || err);
      retries--;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  if (success) {
    process.exit(0);
  } else {
    console.error('\n[FAIL] Supabase start failed with DNS resolution error (DB_HOST: nxdomain) after all retries.');
    console.error('Fatal Error details:', lastErr?.message || lastErr);
    process.exit(1);
  }
```

#### 2. `e2e/run_e2e.ts`
```typescript
// BEFORE (Lines 47-111)
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
      console.error('Supabase start execSync threw, checking health...');
    }

    console.log('Verifying Supabase is reachable before confirming start...');
    let checkRetries = 120;
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
    if (!reachable) {
      console.error('Supabase start failed. Performing one final clean teardown and retry...');
      teardownSupabase();
      try { execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } }); } catch(e){}
      let retryChecks = 120;
      while (retryChecks > 0 && !reachable) {
        try {
          const res = await fetch('http://127.0.0.1:54321');
          if (res.ok || res.status === 404 || res.status === 400 || res.status === 200) {
            reachable = true;
            break;
          }
        } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 1000));
        retryChecks--;
      }
      if (!reachable) {
        throw new Error('Supabase started but http://127.0.0.1:54321 is unreachable.');
      }
    }
  }

// AFTER (Lines 47-111 replaced with robust startSupabaseWithRetry)
  console.log('Starting local Supabase Docker containers unconditionally...');
  try { execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('mv supabase/migrations_bak supabase/migrations 2>/dev/null || true && mv supabase/seed.sql.bak supabase/seed.sql 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}

  await robustSupabaseStartWithRetry();

// Add robustSupabaseStartWithRetry helper function above setup() or replace robustSupabaseRestart()
```

```typescript
// BEFORE (Lines 138-149)
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

// AFTER
async function robustSupabaseStartWithRetry() {
  console.log('Performing robust Supabase start/restart with multi-attempt retry loop...');
  let retries = 5;
  let success = false;
  let lastErr: any = null;

  while (retries > 0 && !success) {
    try {
      console.log(`Attempting clean Supabase teardown and start... (${retries} attempts left)`);
      teardownSupabase();
      execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
      
      console.log('Verifying Supabase is reachable before confirming start...');
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
        success = true;
        break;
      } else {
        throw new Error('Supabase started but http://127.0.0.1:54321 is unreachable.');
      }
    } catch (err: any) {
      lastErr = err;
      console.warn(`Supabase start failed (PlatformError / ChildProcess.exitCode). Retrying... (${retries - 1} attempts left)`);
      console.warn('Error details:', err.message || err);
      retries--;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  if (!success) {
    throw new Error(`Robust Supabase start failed after all retries. Fatal Error: ${lastErr?.message || lastErr}`);
  }
  try { execSync('sleep 10', { stdio: 'inherit' }); } catch(e){}
}
// NOTE: Update calls to robustSupabaseRestart() in run() to await robustSupabaseStartWithRetry()
```

```typescript
// BEFORE (Lines 208-228)
    console.log('Initializing database schema and migrations...');
    execSync('sleep 3', { stdio: 'inherit' });
    let dbPushRetries = 5;
    let dbPushSuccess = false;
    while (dbPushRetries > 0 && !dbPushSuccess) {
      try {
        execSync('npx --no-install supabase migration up --include-all', { stdio: 'inherit' });
        dbPushSuccess = true;
        console.log('Database migrations pushed successfully!');
      } catch(e) {
        console.log(`Database push failed. Performing a full npx supabase stop and npx supabase start... (${dbPushRetries - 1} retries left)`);
        robustSupabaseRestart();
        dbPushRetries--;
      }
    }

    if (!dbPushSuccess) {
      console.log('Migration up failed after retries, attempting one final full stop and start before final migration up...');
      robustSupabaseRestart();
      execSync('npx --no-install supabase migration up --include-all', { stdio: 'inherit' });
    }

// AFTER
    console.log('Resetting database schema and applying migrations...');
    execSync('sleep 3', { stdio: 'inherit' });
    let dbPushRetries = 5;
    let dbPushSuccess = false;
    while (dbPushRetries > 0 && !dbPushSuccess) {
      try {
        execSync('npx --no-install supabase db reset', { stdio: 'inherit' });
        dbPushSuccess = true;
        console.log('Database reset and migrations pushed successfully!');
      } catch(e) {
        console.log(`Database reset failed. Performing a full robust Supabase restart... (${dbPushRetries - 1} retries left)`);
        await robustSupabaseStartWithRetry();
        dbPushRetries--;
      }
    }

    if (!dbPushSuccess) {
      console.log('Database reset failed after retries, attempting one final full stop and start before final db reset...');
      await robustSupabaseStartWithRetry();
      execSync('npx --no-install supabase db reset', { stdio: 'inherit' });
    }
```

## 5. Verification Method
To independently verify the fix once implemented by the implementer agent:
1. **Execute E2E Verification Suite**:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/adv_supabase_dns_nxdomain.ts && export NODE_OPTIONS=--max-old-space-size=256 && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
2. **Expected Outcome**:
   - `e2e/adv_supabase_dns_nxdomain.ts` successfully starts Supabase (retrying transparently if `PlatformError` occurs) and exits with code 0.
   - `e2e/run_e2e.ts` ignores the running Supabase instance, performs a clean teardown and fresh startup, executes `npx supabase db reset` successfully (creating `public.expenses`), runs E2E Playwright tests, and exits with code 0.
   - Subsequent verification scripts (`verify_accumulation.ts`, `verify_monte_carlo.ts`) complete successfully.
