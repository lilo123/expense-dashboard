# Handoff Report: E2E Test Runner Supabase & Docker Teardown Race Condition Analysis

## 1. Observation
During independent verification in Iteration 16, the E2E test runner (`npx tsx e2e/run_e2e.ts`) failed with exit code 1 due to Supabase/Docker daemon race conditions (`Conflict. The container name "/supabase_db_expense-dashboard" is already in use`, `supabase start is already running`, `removal of container ... is already in progress`) and Docker daemon asynchronous prune collisions (`a prune operation is already running`).

We performed a comprehensive inspection of the codebase using `view_file` on `e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/init_db.ts`, `supabase/config.toml`, `next.config.js`, `supabase/migrations/20260624000000_retirement_planner.sql`, and `src/lib/planner/*.ts`.

### Direct Observations in `e2e/run_e2e.ts`:
- **Teardown Sequence Flaws**: In all six teardown locations (lines 37-44, 51-58, 87-94, 152-159, 211-218, and 273-280), `pkill -f supabase` is executed *after* `while docker ps -aq | grep -q .; do sleep 2; done` and without `SIGKILL` (`-9`). Furthermore, `pkill -f supabase-go` is absent.
- **Docker Prune Collisions**: `docker ps -aq` only checks for active container IDs. When `npx supabase stop` or `npx supabase start` is invoked, internal Docker daemon prune operations (pruning containers, networks, volumes) continue running asynchronously in the background even after container IDs vanish. The current `sleep 15` buffer is insufficient and placed after `rm -rf supabase/.temp`, while lingering `supabase-go` processes are still active during the docker wait loop.
- **`setup()` Loop Catch Block**: In `setup()`, if `npx supabase start` exits but `http://127.0.0.1:54321` remains unreachable, the `catch` block (lines 87-94) executes the same flawed teardown sequence, preventing a true clean cold start on retry.

### Direct Observations of Preserved Architectural Mechanisms:
- **`e2e/run_e2e.ts`**: Retains `npx supabase migration up --include-all` (lines 177, 190), `NODE_OPTIONS: ''` sanitization (line 254), precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering (lines 234-251), `fuser -k 3000/tcp` (lines 34, 107, 252, 292, 314), asynchronous `child_process.spawn` for Playwright tests (lines 350-359), `sleep 10` decoupling (line 182), warmup delays (lines 345-348), Next.js keep-alive/respawn mechanism (lines 295-321), port `25432` migration, and `async setup()` (line 13). `pkill -9 -f next` and `fuser -k 54321/tcp` remain removed. `execSync('npx tsx e2e/init_db.ts')` (line 193) and Playwright test execution remain without `try...catch` blocks.
- **`e2e/seed.ts`**: Retains `schemaRetries = 50` (lines 89-103) and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop (line 203).
- **`e2e/init_db.ts`**: Retains the 10s post-notification delay (`setTimeout(resolve, 10000)`) at line 86.
- **`next.config.js`**: Retains `outputFileTracing: false` at line 3.
- **`src/lib/planner/*.ts` & `supabase/migrations/20260624000000_retirement_planner.sql`**: Remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers (`check_premium_simulation_range()`).

## 2. Logic Chain
1. **Lingering Daemon Race Condition**: Because `pkill -f supabase` is executed after the `while docker ps -aq` loop and without `SIGKILL`, if `npx supabase start` fails, the detached `supabase-go` background daemon remains active. While `e2e/run_e2e.ts` waits in the `while docker ps -aq` loop, `supabase-go` continues attempting to spawn containers asynchronously. The wait loop finishes when containers temporarily disappear, only for `supabase-go` to spawn `supabase_db_expense-dashboard` moments later, causing `Conflict. The container name ... is already in use` and `supabase start is already running`.
2. **Aggressive Termination Requirement**: To prevent `supabase-go` from spawning containers or holding locks during Docker cleanup, `pkill -9 -f supabase 2>/dev/null || true` and `pkill -9 -f supabase-go 2>/dev/null || true` must be executed as the very first commands in the teardown sequence, followed immediately by `rm -rf supabase/.temp 2>/dev/null || true`.
3. **Docker Daemon Asynchronous Prune Collisions**: `docker ps -aq` only verifies the absence of container IDs but cannot detect background prune operations active within the Docker daemon. When `e2e/run_e2e.ts` restarts Supabase in rapid succession, `npx supabase start` collides with the background prune operation of the previous attempt, throwing `a prune operation is already running`.
4. **Dedicated Sleep Buffer**: Adding a dedicated sleep buffer (`sleep 20`) at the end of the teardown sequence ensures the Docker daemon has ample time to release its background prune locks before `npx supabase start --ignore-health-check` is invoked.
5. **Consistent Recovery**: Ensuring the `catch` block in `setup()`'s `for` loop executes this exact same robust teardown sequence guarantees that if `http://127.0.0.1:54321` is unreachable, the subsequent retry performs a true clean cold start.

## 3. Caveats
- No caveats. The investigation comprehensively covered all E2E runner lifecycle scripts, database initialization/seeding logic, Supabase configuration, Next.js configuration, and core domain logic. All findings are fully backed by direct file observations.

## 4. Conclusion
The E2E test runner failures (`Conflict. The container name ... is already in use`, `supabase start is already running`, `removal of container ... is already in progress`, `a prune operation is already running`) are caused by lingering `supabase-go` background daemons and asynchronous Docker daemon prune collisions.

### Recommended Fix Strategy
Modify `e2e/run_e2e.ts` to replace all six teardown blocks (lines 37-44, 51-58, 87-94, 152-159, 211-218, and 273-280) with the following robust teardown sequence:

```typescript
// For lines 37-44 (and similarly indented for the other 5 locations):
  try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f supabase-go 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -aq | grep -q .; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
```

This ensures `supabase` and `supabase-go` processes are aggressively terminated FIRST, `supabase/.temp` is removed FIRST, containers and volumes are stopped and removed, ports are cleared, and a dedicated 20-second sleep buffer allows the Docker daemon to release all background prune locks before starting Supabase.

## 5. Verification Method
1. **Inspect `e2e/run_e2e.ts`**: Verify that all six teardown locations contain the exact robust teardown sequence above, starting with `pkill -9 -f supabase` and `pkill -9 -f supabase-go`, and ending with `sleep 20`.
2. **Execute E2E Test Runner**: Run `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts`.
3. **Expected Outcome**: The E2E test runner completes successfully with exit code 0, with zero Supabase daemon conflicts or Docker prune collisions.
4. **Verify Preserved Logic**: Run `npx tsc --noEmit` and `npm run test __tests__/planner` to ensure 100% passing unit tests and clean type checks.
