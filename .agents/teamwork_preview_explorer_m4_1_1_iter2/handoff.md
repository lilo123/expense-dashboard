# Handoff Report: Milestone 4 Playwright E2E Test Failures Investigation

## 1. Observation

### Summary of Investigation
We investigated the root cause of the Playwright E2E test failures (`net::ERR_CONNECTION_REFUSED` on `http://localhost:3000/login`) observed during Milestone 4 verification by Reviewer 1 and Reviewer 2.

### Direct Observations & File Inspections
1. **`playwright.config.ts` (lines 44-50)**:
   ```typescript
   /* Run your local dev server before starting the tests */
   webServer: {
     command: 'npm run build && npm run start',
     url: 'http://localhost:3000',
     reuseExistingServer: true,
     timeout: 240000, // 4 minutes to allow for compilation and boot
   },
   ```
   - The `webServer` configuration builds and starts the Next.js production server on `http://localhost:3000`. It does NOT manage or start the local Supabase database instance.

2. **`e2e/run_e2e.ts` (lines 12-29, 31-45, 47-62)**:
   - `setup()` backs up `.env.local` to `.env.local.bak` and copies `.env.test` to `.env.local`.
   - `run()` calls `setup()`, executes `npx playwright test --workers=1`, and then calls `cleanup()`.
   - `cleanup()` restores `.env.local` from `.env.local.bak`.
   - **Crucial Omission**: `e2e/run_e2e.ts` does NOT execute `npx supabase start`, `npx tsx e2e/init_db.ts`, or `npx tsx --env-file=.env.test e2e/seed.ts`.

3. **`TESTING.md` (lines 48-52, 68-91)**:
   - Section 1.B states that `npx tsx e2e/run_e2e.ts` is a custom script that *"automatically backs up your active cloud `.env.local`, swaps in local test credentials, compiles migrations, seeds the local DB, runs optimized tests strictly on Desktop Chromium in ~10 seconds, and guarantees your original cloud environment is fully restored on completion"*.
   - Section 1.C details the required Local Supabase CLI Docker setup:
     1. `npx supabase init`
     2. `npx supabase start`
     3. `npx tsx e2e/init_db.ts` (connects to port 54322, applies DDL migrations, notifies pgrst to reload schema)
     4. `npx tsx --env-file=.env.test e2e/seed.ts` (seeds `test-user@example.com`, categories, exchange rates, and expenses)
     5. `npx supabase stop`

4. **`.env.test` & `.env.local` (lines 1-6)**:
   ```env
   # Environment Variables for Testing (Local Supabase CLI)
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
   GROQ_API_KEY=gsk_test_mock_key_for_testing_purposes_only
   ```
   - Configures the Next.js application to connect to the local Supabase instance at `http://127.0.0.1:54321`.

5. **Reviewer 1 & 2 Verbatim Error Logs**:
   ```
   [chromium] › e2e/auth.spec.ts:8:7 › Authentication Flows › should redirect unauthenticated users to login 
   Error: expect(locator).toContainText(expected) failed
   ...
   [chromium] › e2e/auth.spec.ts:27:7 › Authentication Flows › should successfully login and persist session 
   Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
   ...
   Serving HTML report at http://localhost:43029. Press Ctrl+C to quit.
   E2E Tests execution failed!
   ```

---

## 2. Logic Chain

1. **Discrepancy Between Specification and Implementation**: `TESTING.md` explicitly documents that `e2e/run_e2e.ts` is responsible for compiling migrations and seeding the local database. However, inspection of `e2e/run_e2e.ts` reveals it only performs environment variable file swapping (`.env.test` -> `.env.local`). It completely omits the Supabase container lifecycle (`npx supabase start` / `stop`) and database initialization/seeding (`init_db.ts` / `seed.ts`).
2. **Next.js Server Boot & Database Dependency**: When `e2e/run_e2e.ts` invokes `npx playwright test`, Playwright launches the `webServer` command (`npm run build && npm run start`). The Next.js production server boots on `http://localhost:3000` using the credentials in `.env.local` (`http://127.0.0.1:54321`).
3. **Connection Refusal & Server Crash**: Because `npx supabase start` was never executed, no database or auth service is running at `http://127.0.0.1:54321`. When Playwright begins executing `e2e/auth.spec.ts` and navigates to `/dashboard` or `/login`, the Next.js server/middleware attempts to communicate with Supabase. The connection to `http://127.0.0.1:54321` fails (`ECONNREFUSED`), causing unhandled server-side exceptions.
4. **Cascading E2E Failure**: The unhandled database connection failures cause the Next.js server process (`npm run start`) to crash. Once the Next.js server terminates, all subsequent Playwright `page.goto` calls fail with `net::ERR_CONNECTION_REFUSED at http://localhost:3000/login`. Playwright aborts, serves the failure HTML report, and `run_e2e.ts` exits with code 1.

---

## 3. Caveats

- **Docker Requirement**: The recommended fix relies on `npx supabase start`, which requires a functioning Docker daemon on the host machine. We assume the underlying environment (e.g., user's Linux workstation or CI runner) has Docker installed and running.
- **Port Availability**: We assume ports `54321` (Supabase API), `54322` (Postgres direct), `54323` (Studio/Kong), and `3000` (Next.js) are free and not occupied by other background services.

---

## 4. Conclusion

### Final Assessment
The Playwright E2E test failures (`net::ERR_CONNECTION_REFUSED`) are caused by the absence of the local Supabase backend during test execution. `e2e/run_e2e.ts` fails to start the Supabase Docker containers, initialize the database schema, and seed the test data. Consequently, the Next.js server crashes when attempting to communicate with an unreachable database at `http://127.0.0.1:54321`.

### Recommended Fix Strategy
Modify `e2e/run_e2e.ts` to fully manage the Supabase lifecycle and database seeding as specified in `TESTING.md`.

#### Proposed Changes to `e2e/run_e2e.ts`
1. **Update `setup()`**:
   ```typescript
   function setup() {
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

     // START LOCAL SUPABASE & SEED DB
     console.log('Starting local Supabase Docker containers...');
     execSync('npx supabase start', { stdio: 'inherit' });

     console.log('Initializing database schema and migrations...');
     execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit' });

     console.log('Seeding E2E test data...');
     execSync('npx tsx --env-file=.env.test e2e/seed.ts', { stdio: 'inherit' });
   }
   ```

2. **Update `cleanup()`**:
   ```typescript
   function cleanup() {
     console.log('\n=== [E2E CLEANUP] Restoring environment ===');
     
     try {
       console.log('Stopping local Supabase Docker containers...');
       execSync('npx supabase stop', { stdio: 'inherit' });
     } catch (err) {
       console.error('Warning: Failed to stop Supabase containers:', err);
     }

     if (backupCreated && fs.existsSync(envLocalBakPath)) {
       console.log('Restoring original .env.local from backup...');
       fs.copyFileSync(envLocalBakPath, envLocalPath);
       fs.unlinkSync(envLocalBakPath);
     } else if (fs.existsSync(envLocalPath)) {
       console.log('Removing temporary .env.local...');
       fs.unlinkSync(envLocalPath);
     }
     console.log('Environment clean.\n');
   }
   ```

---

## 5. Verification Method

To independently verify the fix once implemented by the implementer, execute the following commands from the root working directory (`/usr/local/google/home/duynguyenn/expense-dashboard`):

```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
npx tsx e2e/run_e2e.ts
```

### Expected Outcome
1. `npx supabase start` successfully spins up the local database containers.
2. `e2e/init_db.ts` applies all 18 DDL migrations to port `54322` and reloads PostgREST schema cache.
3. `e2e/seed.ts` creates `test-user@example.com`, verifies the Postgres category trigger, and seeds exchange rates and expenses.
4. Playwright `webServer` builds and starts Next.js on `http://localhost:3000`.
5. Playwright executes all E2E specs (`auth.spec.ts`, `currency.spec.ts`, `recurring.spec.ts`, `yearly_master_toggle.spec.ts`, etc.) successfully with 100% passing tests and exits with code 0.
6. `npx supabase stop` cleanly shuts down the Docker containers, and `.env.local` is restored.
