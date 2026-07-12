# Handoff Report — Explorer 1 (Iteration 20)

## 1. Observation
- **E2E Test Runner Deadlock in `e2e/run_e2e.ts`**: Using `view_file` on `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`, we directly observed the exact teardown sequence replicated across nine blocks (representing the 8 logical teardown locations, including the retry fallback in db push recovery):
  - `setup()` initial cleanup: lines 38-47
  - `setup()` loop start: lines 54-63
  - `setup()` loop catch block: lines 93-102
  - `cleanup()`: lines 119-128
  - `run()` health check recovery: lines 168-177
  - `run()` db push recovery (attempt loop): lines 225-234
  - `run()` db push recovery (final fallback): lines 243-252
  - `run()` pre-seed health check recovery: lines 275-284
  - `run()` post-build health check recovery: lines 340-349
- **Verbatim Problematic Code**: In each of these blocks, the commands are ordered as follows:
  ```typescript
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  ...
  ```
- **Codebase Verification Observations**:
  - `e2e/run_e2e.ts`: Retains `5000` ms polling intervals (`await new Promise(resolve => setTimeout(resolve, 5000))`) at lines 79, 181, 205, 288, 353, 405; retains `sleep 20` post-start stabilization delays at lines 66, 179, 236, 254, 286, 351; retains explicit `pg.Client` Postgres database readiness verification at port `25432` (lines 190-212); retains full stop/start recovery on migration failure (lines 224-256); retains `npx supabase migration up --include-all` (lines 220, 255); retains `NODE_OPTIONS: ''` sanitization (line 321); retains lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering (lines 301-318); retains `fuser -k 3000/tcp` (lines 35, 115, 319, 362, 384); retains asynchronous `child_process.spawn` for Playwright tests (lines 420-429); retains `sleep 10` warmup delays (lines 414-418); retains Next.js keep-alive/respawn mechanism (lines 365-391); retains `async setup()` (line 14). `pkill -9 -f next` and `fuser -k 54321/tcp` are confirmed removed. `execSync('npx tsx e2e/init_db.ts', ...)` (line 257) and Playwright test execution remain without `try...catch` blocks.
  - `e2e/seed.ts`: Retains robust retry loops around data deletion and user creation/deletion (lines 115-196), `schemaRetries = 50` (lines 88-108), and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop (lines 250-263).
  - `e2e/init_db.ts`: Retains the 10s post-notification delay (`setTimeout(resolve, 10000)`) at lines 85-86.
  - `next.config.js`: Retains `outputFileTracing: false` at line 3.
  - `src/lib/planner/*.ts` & `supabase/migrations/20260624000000_retirement_planner.sql`: Remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers (`check_premium_simulation_range`).

## 2. Logic Chain
1. **Root Cause of Infinite Loop Deadlock**: During teardown or recovery, `e2e/run_e2e.ts` executes `while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done`. This loop checks if any Docker containers exist OR if any Docker volumes matching "supabase" exist. If either condition is true, it sleeps for 2 seconds and checks again.
2. **Order of Execution Flaw**: Because `docker volume ls -q | xargs -r docker volume rm -f` is placed *after* the `while` loop, any existing Supabase Docker volume (e.g. `expense-dashboard_supabase_db_expense-dashboard`) will never be removed while the loop is running. Consequently, `docker volume ls -q | grep -q "supabase"` perpetually evaluates to true (`0`), locking the script in an infinite `while true; do sleep 2; done` deadlock.
3. **Corrected Execution Order**: To resolve this without losing the robustness of the prune lock wait loop, the volume removal command (`docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true`) must be executed *before* the `while` loop. This ensures that volumes are forcefully removed first, allowing the `while` loop to correctly act as a verification/lock-wait mechanism rather than an infinite hang.
4. **Comprehensive Fix Strategy**: This reordering must be applied identically across all nine teardown/recovery blocks in `e2e/run_e2e.ts` (covering all 8 logical locations plus the migration failure fallback block) while strictly preserving all other polling intervals, stabilization delays, process cleanups, and error propagation mechanisms.

## 3. Caveats
- No caveats. All related files and configurations were fully inspected and verified to be intact and adhering to project requirements.

## 4. Conclusion
The E2E test runner (`npx tsx e2e/run_e2e.ts`) fails with exit code 1 / infinite hang due to an inverted command order between the Docker volume removal and the Docker prune lock wait loop. 

### Recommended Concrete Fix Strategy
Modify `e2e/run_e2e.ts` across all nine teardown/recovery blocks (lines 38-47, 54-63, 93-102, 119-128, 168-177, 225-234, 243-252, 275-284, 340-349) to implement the corrected, bulletproof teardown sequence:

```typescript
// For blocks where catch variable is (e):
try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}

// For blocks where catch variable is (err) (lines 225-234 and 243-252):
try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(err){}
try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
try { execSync('sleep 20', { stdio: 'inherit' }); } catch(err){}
```

## 5. Verification Method
- **Command to Verify Fix**: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
- **Expected Outcome**: All tests pass with exit code 0, and Supabase teardown/recovery successfully removes volumes without hanging in the `while` loop.
- **Files to Inspect**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts` to ensure the volume removal command strictly precedes the `while` loop across all 9 blocks.
