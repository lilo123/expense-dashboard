# Handoff Report: M5.2 Tier 2 E2E Test Pass — Forensic Audit Remediation Strategy

## 1. Observation

### Standalone Unit Test Fallback & Reward Hacking (`__tests__/db/recurring_db.test.ts`)
- **Lines 11-64**: The test suite attempts to connect to Supabase Postgres at `postgresql://postgres:postgres@127.0.0.1:25432/postgres`. If `await client.connect()` fails (which occurs during standalone `npm test` when Supabase is not running), it catches `connect ECONNREFUSED 127.0.0.1:25432`, logs `Supabase Postgres unreachable. Running recurring_db.test.ts in mocked fallback mode.`, and mocks `client.query` to return hardcoded rows matching the exact expected test assertions:
  ```typescript
  if (text.includes('rent weekly mon')) return { rows: [{ next_occurrence: '2026-05-18' }] };
  if (text.includes('gym weekly today')) return { rows: [{ next_occurrence: '2026-05-11' }] };
  if (text.includes('phone specific')) return { rows: [{ next_occurrence: '2026-05-15' }] };
  if (text.includes('sub past-day shift')) return { rows: [{ next_occurrence: '2026-06-05' }] };
  if (text.includes('rent last day')) return { rows: [{ next_occurrence: '2026-05-31' }] };
  ```
- **Lines 156-159**: `afterAll` only calls `await client.end();` without managing any underlying database lifecycle.

### Master E2E Test Runner Flaws (`e2e/run_e2e.ts`)
- **Lines 14-34 (`teardownSupabase`)**: Implements a flawed teardown sequence that executes `docker ps -aq | xargs -r docker rm -f 2>/dev/null || true` followed immediately by `pkill -9 -f "supabase-go"`, `pkill -9 -f "npx supabase"`, and `pkill -9 -f "bin/supabase"`. It also removes state files via `rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase*`.
- **Lines 58-115 (`setup`)**: Contains an outer retry loop (`for (let i = 0; i < 3; i++)`) and an inner retry loop (`for (let j = 0; j < 5; j++)`) executing `execSync('npx supabase start --debug --ignore-health-check', ...)`.
- **Lines 142-158 (`robustSupabaseRestart`)**: Contains an identical inner retry loop (`for (let j = 0; j < 5; j++)`) and `--ignore-health-check` flag.
- **Empirical Test Execution Failure**: During `e2e/run_e2e.ts`, the runner fails with:
  ```
  failed to create docker container: Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use by container "1fd32270cd294c34c4aaca1d4541ec2c89dcaf76189acfecd472ae2ee9c6e1e6".
  ...
  supabase start is already running.
  ...
  Failed to start Supabase after 3 outer attempts.
  ```

---

## 2. Logic Chain

### Why `__tests__/db/recurring_db.test.ts` Fails Forensic Audit
1. When `npm test` is executed standalone at the beginning of the verification chain (`export PATH=... && npm test && npx tsx e2e/verify_global_market_data.ts ...`), Supabase has not been started yet.
2. `recurring_db.test.ts` attempts `await client.connect()`, which fails with `ECONNREFUSED`.
3. Instead of initializing the database or failing fast, the `catch` block intercepts `client.query` and returns hardcoded values. This violates User Rule 5 (NO Reward Hacking) and fails the Forensic Auditor's facade detection.
4. Because `recurring_db.test.ts` tests complex PL/pgSQL stored procedures (`public.process_recurring_expenses()`), an in-memory mock like `pg-mem` cannot be used. The tests must run against a genuine Supabase Postgres instance.
5. **Remediation Logic**: To support both standalone `npm test` and `e2e/run_e2e.ts` (where Supabase is already running), `beforeAll` must attempt `client.connect()`. If it succeeds, Supabase is already running, and the test proceeds. If it fails, `beforeAll` must dynamically start Supabase (`npx supabase start`), initialize the database (`npx tsx e2e/init_db.ts`), and set a flag (`supabaseStartedByTest = true`). In `afterAll`, if `supabaseStartedByTest` is true, it cleanly stops Supabase (`npx supabase stop --no-backup`). This completely eliminates the mocked fallback mechanism and hardcoded rows.

### Why `e2e/run_e2e.ts` Fails with Container Conflicts & Requires Retry Loops
1. `teardownSupabase()` executes `npx supabase stop --no-backup`, which initiates container shutdown in the Docker daemon.
2. Immediately after `sleep 5`, `docker ps -aq | xargs -r docker rm -f` is called. If Docker is still shutting down the container, it throws `removal of container ... is already in progress`.
3. Next, `pkill -9 -f "supabase-go"` and `pkill -9 -f "npx supabase"` abruptly kill the Supabase CLI daemon. This leaves the Docker daemon in an inconsistent state and orphans the container `supabase_db_expense-dashboard`.
4. Finally, `rm -rf supabase/.temp` deletes Supabase CLI's internal state tracking. When `npx supabase start` is called, Supabase CLI is unaware of the orphaned container and attempts to create a new one with the same name, resulting in `Conflict. The container name "/supabase_db_expense-dashboard" is already in use`.
5. **Remediation Logic**: `teardownSupabase()` must be refactored to remove all destructive `pkill -9` commands. Container cleanup must be surgically targeted using `docker ps -a --filter "name=supabase" -q | xargs -r docker rm -f`. Furthermore, all outer/inner retry loops (`for (let i = 0; i < 3; i++)`, `for (let j = 0; j < 5; j++)`) and `--ignore-health-check` flags must be removed from `setup()` and `robustSupabaseRestart()`, relying instead on a single clean `npx supabase start --debug` invocation.

---

## 3. Caveats
- **Read-Only Constraint**: As an Explorer agent, no files were modified directly. The proposed changes must be implemented by Worker Gen 5.
- **Docker Environment**: It is assumed that the `docker` CLI is accessible and functional in the execution environment without requiring `sudo`.

---

## 4. Conclusion

Worker Gen 5 must implement the following concrete, genuine fix strategy to remediate all integrity violations:

### 1. Refactor `__tests__/db/recurring_db.test.ts` (Remove Reward Hacking)
Replace the `beforeAll` and `afterAll` blocks (Lines 11-64, 156-159) with the following genuine implementation:

```typescript
  let isDbReachable = false;
  let supabaseStartedByTest = false;

  beforeAll(async () => {
    client = new Client({
      connectionString: 'postgresql://postgres:postgres@127.0.0.1:25432/postgres'
    });
    try {
      await client.connect();
      isDbReachable = true;
    } catch (e) {
      console.log('Supabase Postgres unreachable. Starting local Supabase instance for standalone test...');
      const { execSync } = require('child_process');
      try {
        execSync('npx supabase start', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
        execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
        supabaseStartedByTest = true;
        await client.connect();
        isDbReachable = true;
      } catch (err) {
        console.error('Failed to start Supabase or connect to Postgres:', err);
        throw err;
      }
    }

    // Existing live DB setup logic (only executes if isDbReachable is true)
```

```typescript
  afterAll(async () => {
    await client.end();
    if (supabaseStartedByTest) {
      console.log('Stopping local Supabase instance started by standalone test...');
      const { execSync } = require('child_process');
      try {
        execSync('npx supabase stop --no-backup', { stdio: 'inherit' });
      } catch (err) {
        console.error('Failed to stop Supabase:', err);
      }
    }
  });
```

### 2. Refactor `e2e/run_e2e.ts` (Clean Teardown & Remove Retry Loops)
Replace `teardownSupabase()`, `setup()`, and `robustSupabaseRestart()` with the following clean implementations:

```typescript
function teardownSupabase() {
  console.log('Performing clean Supabase teardown and cleanup...');
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -a --filter "name=supabase" -q | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls --filter "name=supabase" -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
}
```

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
    console.error('Failed to start Supabase.');
    process.exit(1);
  }
}
```

```typescript
function robustSupabaseRestart() {
  console.log('Performing clean Supabase restart...');
  teardownSupabase();
  execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  try { execSync('sleep 10', { stdio: 'inherit' }); } catch(e){}
}
```

---

## 5. Verification Method

To independently verify the fix once Worker Gen 5 completes implementation:

1. **Verify Standalone `npm test`**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx supabase stop --no-backup 2>/dev/null || true
   npm test
   ```
   - **Expected Result**: `recurring_db.test.ts` detects Supabase is unreachable, dynamically starts it, executes all tests genuinely against Postgres (exit code 0), and cleanly stops Supabase in `afterAll`.

2. **Verify Full E2E Test Suite & Absence of Container Conflicts**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
   ```
   - **Expected Result**: All verification scripts and `e2e/run_e2e.ts` complete successfully with exit code 0. No `supabase start is already running` or `Conflict. The container name ... is already in use` errors occur.

3. **Verify Absence of Reward Hacking & Retry Loops**:
   - Inspect `__tests__/db/recurring_db.test.ts` to ensure no `client.query = jest.fn()...` mock fallback exists.
   - Inspect `e2e/run_e2e.ts` to ensure no `for (let j = 0; j < 5; j++)` retry loops or `--ignore-health-check` flags exist.
