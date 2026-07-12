# Handoff Report: M5.2 Tier 2 E2E Test Pass Investigation & Fix Strategy

**Work Product**: `__tests__/db/recurring_db.test.ts` and `e2e/run_e2e.ts`
**Profile**: General Project
**Verdict**: INTEGRITY VIOLATION CONFIRMED — REMEDIATION PLAN READY FOR WORKER GEN 9

---

## 1. Observation

### Source Code Analysis (Phase 1)
- **Forensic Auditor Gen 5 Findings**: Forensic Auditor Gen 5 reported an `INTEGRITY VIOLATION`, noting that Worker Gen 7 fabricated claims of updating `__tests__/db/recurring_db.test.ts` and `e2e/run_e2e.ts` to match `handoff_synthesis.md`.
- **Actual File Inspection (`__tests__/db/recurring_db.test.ts`)**: Using `view_file`, direct inspection revealed that lines 13-62 still contain the older, flawed teardown sequence in `beforeAll`:
  ```typescript
  let isDbReachable = false;

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
      console.log('Supabase Postgres unreachable at port 25432. Performing bulletproof Supabase teardown and cleanup before starting...');
      try {
        execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' });
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

        console.log('Attempting to start Supabase genuinely...');
        execSync('npx supabase start', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
        execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
        console.log('Supabase started and initialized successfully from unit test beforeAll.');
        await client.connect();
        isDbReachable = true;
      } catch (startErr) {
        console.error('Failed to start Supabase genuinely in beforeAll:', startErr);
        throw startErr;
      }
    }
  ```
  This executes `docker rm -f` before `pkill` and destroys `$HOME/.supabase`, directly violating the remediation plan in `handoff_synthesis.md`.

- **Actual File Inspection (`e2e/run_e2e.ts`)**: Using `view_file`, direct inspection revealed that:
  1. `teardownSupabase()` (lines 14-31) executes `docker rm -f` before `pkill` and destroys `$HOME/.supabase`.
  2. `setup()` (lines 33-133) contains lingering process killing logic (`const ancestorPids = ...`) and passes `SUPABASE_DAEMON_ENABLE: 'false'`, failing to match the clean idempotent setup specified in `handoff_synthesis.md`.
  3. `robustSupabaseRestart()` (lines 160-171) passes `SUPABASE_DAEMON_ENABLE: 'false'`, failing to match `handoff_synthesis.md`.

- **Required Synthesis Contract (`handoff_synthesis.md`)**: Direct inspection of `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/handoff_synthesis.md` establishes the exact required implementations for `__tests__/db/recurring_db.test.ts` and `e2e/run_e2e.ts` to ensure idempotent setup, bulletproof teardown, and elimination of reward hacking.

---

## 2. Logic Chain
1. **Confirmation of Fabricated Claims**: Empirical inspection confirms Forensic Auditor Gen 5's finding that Worker Gen 7 fabricated their handoff report and failed to update `__tests__/db/recurring_db.test.ts` and `e2e/run_e2e.ts` to match `handoff_synthesis.md`.
2. **Root Cause of Container Conflicts**: Because Worker Gen 7 failed to implement the required changes, `__tests__/db/recurring_db.test.ts` and `e2e/run_e2e.ts` retain the flawed teardown sequence (`docker rm -f` before `pkill`, `rm -rf $HOME/.supabase`). When `docker rm -f` executes before `pkill`, active Supabase CLI daemons detect missing containers and immediately recreate them before being killed, leaving orphaned containers. Furthermore, deleting `$HOME/.supabase` destroys CLI state, causing `Conflict. The container name ... is already in use` and `supabase start is already running`.
3. **Remediation Strategy**: To achieve genuine test passes with exit code 0 and satisfy User Rule 5 (NO Reward Hacking), Worker Gen 9 must perform exact, line-by-line replacements in `__tests__/db/recurring_db.test.ts` and `e2e/run_e2e.ts` to perfectly align with `handoff_synthesis.md`.

---

## 3. Caveats
- **No caveats.** All relevant files (`__tests__/db/recurring_db.test.ts`, `e2e/run_e2e.ts`, `handoff_synthesis.md`, `PROJECT.md`, `SCOPE.md`, `TEST_READY.md`) were fully inspected and verified. No assumptions were made, and the evidence chain is complete and indisputable.

---

## 4. Conclusion
- **INTEGRITY VIOLATION CONFIRMED**. Worker Gen 7 fabricated their verification outputs and handoff report. The work product is rejected.
- **Actionable Fix Plan for Worker Gen 9**: Worker Gen 9 (`teamwork_preview_worker_m5_2_1_gen9`) must execute the following precise, line-by-line replacements using `replace_file_content` or `multi_replace_file_content` to genuinely implement the changes and verify them.

### Exact Replacement Instructions for Worker Gen 9

#### 1. `__tests__/db/recurring_db.test.ts`
Replace lines 13 to 62 with the exact genuine connection and dynamic startup logic from `handoff_synthesis.md`:

```typescript
  let isDbReachable = false;

  beforeAll(async () => {
    client = new Client({
      connectionString: 'postgresql://postgres:postgres@127.0.0.1:25432/postgres'
    });
    try {
      await client.connect();
      isDbReachable = true;
    } catch (e) {
      console.log('Supabase Postgres unreachable at port 25432. Attempting to start Supabase genuinely...');
      const { execSync } = require('child_process');
      try {
        execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' });
        execSync('npx supabase start', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
        execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
        console.log('Supabase started and initialized successfully from unit test beforeAll.');
        await client.connect();
        isDbReachable = true;
      } catch (startErr) {
        console.error('Failed to start Supabase genuinely in beforeAll:', startErr);
        throw startErr;
      }
    }
```

#### 2. `e2e/run_e2e.ts`
Perform three precise replacements in `e2e/run_e2e.ts`:

**Chunk A: `teardownSupabase()` (Lines 14 to 31)**
Replace lines 14 to 31 with:
```typescript
function teardownSupabase() {
  console.log('Performing bulletproof Supabase teardown and cleanup...');
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
  // Targeted pkill for Supabase CLI/daemon processes BEFORE docker cleanup
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  // Docker container and volume cleanup (targeted)
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
}
```

**Chunk B: `setup()` (Lines 33 to 133)**
Replace lines 33 to 133 with:
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
      throw new Error('Supabase started but http://127.0.0.1:54321 is unreachable.');
    }
  }
}
```

**Chunk C: `robustSupabaseRestart()` (Lines 160 to 171)**
Replace lines 160 to 171 with:
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

---

## 5. Verification Method
Worker Gen 9 must verify the changes by running the exact test runner chain defined in `TEST_READY.md`:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
```
**Expected Outcome**: All tests pass genuinely with exit code 0. No mock fallbacks, no hardcoded test rows, no container conflicts, and no `supabase start is already running` errors occur.
