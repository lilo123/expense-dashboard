## 2026-07-07T09:16:53Z

Your identity is teamwork_preview_worker_m5_3_1_1_gen4 and your working directory is /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_3_1_1_gen4.

Load the Jetski skill at:
  /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

This skill provides software engineering best practices for modifying existing code, performing cross-file refactors, changing APIs, and adding features.

Your task is to implement the bulletproof `run_e2e.ts` clean reset and `PlatformError` retry loops required for Milestone 5.3 (M5.3: Tier 3 E2E Test Pass - Cross-Feature Combinations) in Iteration 4.

### Synthesized Explorer Findings & Recommended Fix Strategy
The 3 Explorer subagents in Iteration 4 independently investigated the sequential execution conflict (`relation "public.expenses" does not exist`) and `PlatformError` (`Unknown: ChildProcess.exitCode`) reported by Reviewer 1 gen3 and Challenger 1 gen3, and reached full consensus on the root causes and required fixes:

1. **The `alreadyRunning` Flaw**: `e2e/adv_supabase_dns_nxdomain.ts` starts Supabase to test DNS resilience but does not verify or reset the database schema. When `e2e/run_e2e.ts` runs immediately after, it sees Supabase active on port 54321/25432, sets `alreadyRunning = true`, and skips `teardownSupabase()`.
2. **Stale Migration State**: Because `run_e2e.ts` reuses the dirty database container from the previous script, `npx supabase migration up` assumes migrations are already applied. However, the actual tables in `public` (like `expenses`) are missing or corrupted. When `e2e/init_db.ts` attempts `ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;`, Postgres throws `relation "public.expenses" does not exist`.
3. **The `PlatformError` / `ChildProcess.exitCode` Flaw**: In isolated/ephemeral environments, `supabase-go` occasionally fails during container spin-up or health checks, throwing a `PlatformError`. `execSync` immediately throws an exception when the child process exits non-zero.

### Consensus Fix Strategy (Multi-Attempt Retry Loops & Clean Reset)

#### 1. `e2e/adv_supabase_dns_nxdomain.ts`
- Import/define the full `teardownSupabase()` helper function (matching the one in `run_e2e.ts`).
- Wrap `execSync('npx --no-install supabase start --debug', ...)` in a robust retry loop (5 retries) that catches `PlatformError` / `ChildProcess.exitCode`, executes `teardownSupabase()`, and retries until `fetch('http://127.0.0.1:54321')` succeeds.
```typescript
  let retries = 5;
  let success = false;
  let lastErr: any = null;

  while (retries > 0 && !success) {
    try {
      console.log(`\nStopping any existing Supabase instances before clean start... (${retries} attempts left)`);
      teardownSupabase();

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
- Remove the `alreadyRunning` check entirely so `teardownSupabase()` and Supabase startup run unconditionally in `setup()`.
- Implement `robustSupabaseStartWithRetry()` helper function with a 5-retry loop that catches `PlatformError`, executes `teardownSupabase()`, and retries until healthy.
- Replace `npx --no-install supabase migration up --include-all` with `npx --no-install supabase db reset` to guarantee a pristine database schema regardless of prior container state.
```typescript
async function robustSupabaseStartWithRetry() {
  console.log('Performing robust Supabase start/restart with multi-attempt retry loop...');
  let retries = 5;
  let success = false;
  let lastErr: any = null;

  while (retries > 0 && !success) {
    try {
      console.log(`Attempting clean Supabase teardown and start... (${retries} attempts left)`);
      teardownSupabase();
      execSync('npx --no-install supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
      
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
```
```typescript
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

### Verification Requirement
You must execute the adversarial test case and the E2E test runner to verify your changes:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/adv_supabase_dns_nxdomain.ts && export NODE_OPTIONS=--max-old-space-size=256 && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
Ensure all tests pass with exit code 0 and zero TypeScript errors.
