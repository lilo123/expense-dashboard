# Handoff Report — Milestone 5.1 Explorer 3 (Iteration 7)

## Executive Summary
An in-depth forensic investigation was conducted into `e2e/init_db.ts`, `e2e/run_e2e.ts`, `src/lib/planner/*.ts`, and `supabase/migrations/20260624000000_retirement_planner.sql`. The investigation confirmed the root causes of the E2E test runner failures from Iteration 6: a fatal `pg.Client` reuse bug in `e2e/init_db.ts` and Supabase asynchronous cleanup collisions (`Stopping containers...`) caused by naive chained retries in `e2e/run_e2e.ts`. All business logic engines and Supabase migrations were verified to be genuinely implemented with strict RLS policies and Premium tier triggers. Concrete, bulletproof fix strategies have been formulated for the Worker to implement.

---

## 1. Observation

### `e2e/init_db.ts` Inspection
- **File Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/init_db.ts` (lines 5-28)
- **Current Implementation**:
  ```typescript
  const connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const client = new Client({ connectionString });

  // DDL migrations are handled by Supabase CLI

  async function initDb() {
    console.log('\n=== [DB INITIALIZER] Connecting to local Postgres ===');
    let connected = false;
    let retries = 15;
    while (retries > 0 && !connected) {
      try {
        await client.connect();
        connected = true;
        console.log('Connected successfully to local Postgres at port 54322.');
      } catch (e: any) {
        console.log(`Waiting for Postgres to be ready... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries--;
      }
    }
    if (!connected) {
      console.error('Failed to connect to Postgres after 15 retries.');
      process.exit(1);
    }
  ```
- **Observed Defect**: `const client = new Client({ connectionString });` is instantiated globally outside the `while` loop.

### `e2e/run_e2e.ts` Inspection
- **File Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts` (lines 32-38, 95, 133-156, 182)
- **Current Implementation**:
  ```typescript
  // START LOCAL SUPABASE & SEED DB
  console.log('Starting local Supabase Docker containers...');
  try { execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 54321/tcp 54322/tcp 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('mv supabase/migrations_bak supabase/migrations 2>/dev/null || true && mv supabase/seed.sql.bak supabase/seed.sql 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  execSync('npx supabase stop --no-backup 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && sleep 10', { stdio: 'inherit' });
  execSync('npx supabase start --ignore-health-check || (sleep 10 && npx supabase start --ignore-health-check) || (sleep 10 && npx supabase start --ignore-health-check)', { stdio: 'inherit' });
  ```
- **Observed Defect**: Naive chained retry (`npx supabase start --ignore-health-check || (sleep 10 && npx supabase start ...)`) executes without explicitly stopping Supabase or waiting for the asynchronous cleanup routine (`Stopping containers...`) to complete.
- **Architectural Guardrails Verified**:
  - `pkill -9 -f next` is absent; `fuser -k 3000/tcp` is correctly used to prevent process suicide.
  - `e2e/init_db.ts` is executed directly without a `try...catch` block (line 95).
  - Playwright test execution is executed directly without a `try...catch` block (line 182).
  - `sleep 10` decoupling, warmup delays, and resilient Next.js server keep-alive/respawn mechanism (`startNextServer()`, `isShuttingDown` flag, `on('exit')` listener) are fully intact.

### Business Logic & Supabase Migrations Inspection
- **File Paths**: `src/lib/planner/*.ts`, `supabase/migrations/20260624000000_retirement_planner.sql`
- **Verification Results**: All business logic engines (`taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`) and Supabase migrations are genuinely implemented with real equations, sorting, strict RLS policies (`auth.uid() = user_id`), and Premium tier check triggers (`check_premium_simulation_range()`). No mocks, hardcoded outputs, or facades exist.

---

## 2. Logic Chain

1. **`pg.Client` Reuse Failure Mechanism**:
   - In `node-postgres` (`pg`), a `Client` instance cannot be reused once `client.connect()` fails. When `e2e/run_e2e.ts` starts Supabase, the Postgres container takes several seconds to initialize and accept connections on port 54322.
   - When `e2e/init_db.ts` calls `client.connect()` on the first attempt while Postgres is still starting, the connection fails and the `client` object permanently enters an ended/error state. Subsequent loop iterations wait 2 seconds and call `client.connect()` on the SAME `client` instance, which immediately rejects with `Error: Client has already been connected. You cannot reuse a client.` without ever attempting a new network socket connection to Postgres.
   - **Resolution**: Instantiating `new Client({ connectionString })` inside the `while` loop ensures a fresh client and socket connection attempt on every retry. Calling `client.end().catch(() => {})` on failure prevents socket leaks.

2. **Supabase Start & Asynchronous Cleanup Collision Mechanism**:
   - `e2e/run_e2e.ts` uses `npx supabase start --ignore-health-check || (sleep 10 && npx supabase start ...)`. When `npx supabase start` fails due to container conflicts or timeout, the Supabase CLI triggers an asynchronous cleanup routine (`Stopping containers...`).
   - The chained retry `|| (sleep 10 && npx supabase start ...)` executes while this cleanup is still active, causing `supabase start is already running.` errors, container conflicts (`/supabase_db_expense-dashboard is already in use`), and Docker daemon prune collisions (`a prune operation is already running`).
   - Eventually, when a retry succeeds, the delayed cleanup routine from the earlier failed attempt completes and stops all Supabase services, resulting in `connect ECONNREFUSED 127.0.0.1:54321` during database seeding (`e2e/seed.ts`).
   - **Resolution**: Replacing the naive chained retry with an explicit `npx supabase stop --no-backup 2>/dev/null || true && sleep 10` before each retry forces the cleanup to complete and synchronizes container state before attempting a fresh `npx supabase start`.

---

## 3. Caveats

- **Read-Only Mandate**: As an Explorer agent, no code changes were directly applied to the codebase. The recommended changes must be implemented by the subsequent Worker agent.
- **Local Execution**: All analysis assumes a local Linux environment with Docker and Supabase CLI installed, adhering to the strict zero-git-push requirement.

---

## 4. Conclusion

The E2E test runner failures in Iteration 6 were caused by two distinct but compounding flaws:
1. A `pg.Client` reuse bug in `e2e/init_db.ts` that prevents successful database connection retries.
2. Supabase asynchronous cleanup collisions in `e2e/run_e2e.ts` caused by naive chained retries without explicit stopping and synchronization.

### Recommended Fix Strategy (For Worker Agent)

#### 1. Proposed Changes to `e2e/init_db.ts`
Modify `e2e/init_db.ts` lines 5-28 to instantiate `pg.Client` inside the retry loop:

```typescript
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

// DDL migrations are handled by Supabase CLI

async function initDb() {
  console.log('\n=== [DB INITIALIZER] Connecting to local Postgres ===');
  let connected = false;
  let retries = 15;
  let client: Client | null = null;
  while (retries > 0 && !connected) {
    const c = new Client({ connectionString });
    try {
      await c.connect();
      client = c;
      connected = true;
      console.log('Connected successfully to local Postgres at port 54322.');
    } catch (e: any) {
      console.log(`Waiting for Postgres to be ready... (${retries} retries left)`);
      await c.end().catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 2000));
      retries--;
    }
  }
  if (!connected || !client) {
    console.error('Failed to connect to Postgres after 15 retries.');
    process.exit(1);
  }

  try {
    // (Existing code using `client.query` remains exactly the same)
```

#### 2. Proposed Changes to `e2e/run_e2e.ts`
Modify `e2e/run_e2e.ts` line 37 in `setup()` to explicitly call `npx supabase stop --no-backup 2>/dev/null || true && sleep 10` before each retry:

```typescript
  // START LOCAL SUPABASE & SEED DB
  console.log('Starting local Supabase Docker containers...');
  try { execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 54321/tcp 54322/tcp 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('mv supabase/migrations_bak supabase/migrations 2>/dev/null || true && mv supabase/seed.sql.bak supabase/seed.sql 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  execSync('npx supabase stop --no-backup 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && sleep 10', { stdio: 'inherit' });
  execSync('npx supabase start --ignore-health-check || (npx supabase stop --no-backup 2>/dev/null || true && sleep 10 && npx supabase start --ignore-health-check) || (npx supabase stop --no-backup 2>/dev/null || true && sleep 10 && npx supabase start --ignore-health-check)', { stdio: 'inherit' });
```

#### 3. Preservation of Architectural Guardrails
The Worker must ensure the following remain strictly unchanged:
- `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`).
- `try...catch` blocks around `e2e/init_db.ts` and Playwright test execution remain removed in `e2e/run_e2e.ts`.
- `e2e/run_e2e.ts` retains `sleep 10` decoupling, warmup delays, and resilient Next.js server keep-alive/respawn mechanism (`startNextServer()`, `isShuttingDown`, `on('exit')`).
- `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.

---

## 5. Verification Method

Once the Worker implements the recommended changes, the following verification steps must be executed:

1. **TypeScript Compilation Check**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected*: Zero compilation errors.

2. **Production Build Check**:
   ```bash
   npm run build
   ```
   *Expected*: Successful optimized production build.

3. **E2E Test Runner Execution**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
   ```
   *Expected*: `e2e/init_db.ts` connects successfully to Postgres (utilizing retries cleanly if needed), Supabase starts without container/prune/cleanup collisions, Next.js server spawns successfully, all 55 Playwright E2E tests pass, accumulation/monte carlo verification scripts pass, and the command exits with code 0.

4. **Git Status Check**:
   ```bash
   git status
   ```
   *Expected*: All changes exist strictly in the local working directory with zero commits pushed to remote git repositories.
