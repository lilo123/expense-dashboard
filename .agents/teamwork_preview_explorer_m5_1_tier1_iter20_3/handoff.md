# Handoff Report: E2E Test Runner Deadlock Analysis & Fix Strategy

## 1. Observation
During independent verification in Iteration 19, the E2E test runner (`npx tsx e2e/run_e2e.ts`) failed with exit code 1 due to a critical deadlock uncovered by Challenger 1 (`c430e51a-0922-4477-b8ac-220bd55eba46`).

### Direct Observations in `e2e/run_e2e.ts`
Using `view_file`, we inspected `e2e/run_e2e.ts` and observed the exact teardown sequence replicated across 9 distinct code blocks (representing the 8 logical teardown locations: `setup()` initial cleanup, `setup()` loop start, `setup()` loop catch block, `cleanup()`, `run()` health check recovery, `run()` db push recovery [while loop + fallback block], `run()` pre-seed health check recovery, `run()` post-build health check recovery).

In every instance, the sequence is currently structured as follows:
```typescript
try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
```
The exact line ranges for these 9 occurrences in `e2e/run_e2e.ts` are:
1. Lines 38–47 (`setup()` initial cleanup)
2. Lines 54–63 (`setup()` loop start)
3. Lines 93–102 (`setup()` loop catch block)
4. Lines 119–128 (`cleanup()`)
5. Lines 168–177 (`run()` health check recovery)
6. Lines 225–234 (`run()` db push recovery - while loop)
7. Lines 243–252 (`run()` db push recovery - `if (!dbPushSuccess)` fallback block)
8. Lines 275–284 (`run()` pre-seed health check recovery)
9. Lines 340–349 (`run()` post-build health check recovery)

### Direct Observations of Retention Requirements
- **`e2e/run_e2e.ts`**: Retains `5000` ms polling intervals (lines 79, 181, 205, 288, 353, 405), `sleep 20` post-start stabilization delays (lines 66, 179, 236, 254, 286, 351), explicit `pg.Client` Postgres database readiness verification at port `25432` (lines 190–212), full stop/start recovery on migration failure (lines 216–256), `npx supabase migration up --include-all` (lines 220, 255), `NODE_OPTIONS: ''` sanitization (line 321), precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering (lines 301–318), `fuser -k 3000/tcp` (lines 35, 115, 319, 362, 384), asynchronous `child_process.spawn` for Playwright tests (lines 420–429), `sleep 10` decoupling warmup delays (lines 414–418), Next.js keep-alive/respawn mechanism (lines 365–391), port `25432` migration, and `async setup()`. `pkill -9 -f next` and `fuser -k 54321/tcp` remain removed. `execSync('npx tsx e2e/init_db.ts')` (line 257) and Playwright test execution remain without `try...catch` blocks.
- **`e2e/seed.ts`**: Retains robust retry loops around data deletion (lines 115–152), user deletion (lines 154–174), user creation (lines 178–201), `schemaRetries = 50` (lines 88–109), and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop (lines 250–263).
- **`e2e/init_db.ts`**: Retains the 10s post-notification delay (`setTimeout(resolve, 10000)`) at lines 85–87.
- **`next.config.js`**: Retains `outputFileTracing: false` at line 3.
- **`src/lib/planner/*.ts` & `supabase/migrations/20260624000000_retirement_planner.sql`**: Remain genuinely implemented with strict RLS (`auth.uid() = user_id`) at lines 93–130 and Premium tier check triggers at lines 140–161.

## 2. Logic Chain
1. **Root Cause of Deadlock**: In all 9 teardown blocks in `e2e/run_e2e.ts`, the script executes `while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done` BEFORE `docker volume ls -q | xargs -r docker volume rm -f`.
2. **Infinite Loop Mechanism**: When a Supabase Docker volume exists (e.g., `expense-dashboard_supabase_db_expense-dashboard`), `docker volume ls -q | grep -q "supabase"` evaluates to true (`0`). Because the volume removal command (`docker volume rm -f`) is placed AFTER the `while` loop, the volume is never removed while the loop is running. Consequently, the `while` loop hangs infinitely (`while true; do sleep 2; done`), permanently deadlocking the E2E test runner.
3. **Corrected Ordering**: To eliminate the deadlock while preserving the robustness of the Docker prune lock wait loop, the volume removal command (`docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true`) MUST execute BEFORE the `while` loop. This ensures all Supabase volumes are forcefully removed first, allowing the `while` loop to correctly verify that no containers or volumes remain before proceeding.
4. **Comprehensive Scope**: Because this teardown sequence is replicated across 9 distinct blocks (covering all 8 logical locations in `setup()`, `cleanup()`, and `run()`), the exact reordering must be applied identically to all 9 blocks to ensure bulletproof execution under all possible failure and recovery paths.

## 3. Caveats
- **No caveats.** The investigation was comprehensive, examining the exact E2E test runner execution flow, all teardown blocks, and all related configuration and database seeding files. All observations are directly backed by file inspections.

## 4. Conclusion
The E2E test runner deadlock is caused by an incorrect ordering of the Docker volume removal command and the Docker prune lock wait loop in `e2e/run_e2e.ts`. Reordering these two lines across all 9 teardown blocks will completely resolve the infinite hang while maintaining full teardown robustness.

### Recommended Concrete Fix Strategy
The implementer MUST update `e2e/run_e2e.ts` across all 9 teardown blocks (lines 38–47, 54–63, 93–102, 119–128, 168–177, 225–234, 243–252, 275–284, and 340–349) to the following corrected sequence:

```typescript
// Corrected Teardown Sequence (apply to lines 38-47, 54-63, 93-102, 119-128, 168-177, 275-284, 340-349):
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

// Corrected Teardown Sequence for blocks using 'err' in catch (apply to lines 225-234 and 243-252):
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

All other files (`e2e/seed.ts`, `e2e/init_db.ts`, `next.config.js`, `src/lib/planner/*.ts`, `supabase/migrations/20260624000000_retirement_planner.sql`) are already perfectly compliant with all retention requirements and require zero modifications.

## 5. Verification Method
To independently verify the fix once implemented:
1. **Inspect `e2e/run_e2e.ts`**: Ensure `docker volume ls -q | xargs -r docker volume rm -f` appears BEFORE `while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done` across all 9 teardown blocks.
2. **Execute E2E Test Runner**: Run the following command from the project root:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
   ```
   - **Expected Result**: All tests complete successfully with exit code 0, with zero hangs or deadlocks during Supabase teardown/restart sequences.
3. **Invalidation Conditions**: Any hang during Supabase stop/restart, or any failure in Playwright E2E tests, would invalidate this verification.
