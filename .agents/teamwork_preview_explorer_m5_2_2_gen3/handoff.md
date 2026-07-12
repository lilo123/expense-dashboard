# Handoff Report: Investigation and Fix Strategy for M5.2 `e2e/run_e2e.ts`

**Work Product**: Concrete Fix Strategy for Worker Gen 3 (`e2e/run_e2e.ts` Supabase Cleanup & Startup Refactoring)
**Profile**: Next.js Retirement Calculator Expansion (Milestone 5.2)
**Verdict**: ACTIONABLE REMEDIATION STRATEGY DEFINED

---

## 1. Observation
- **Forensic Auditor Gen 2 Findings**: Observed that `e2e/run_e2e.ts` failed during `setup()` with `failed to create docker container: Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use by container "0c1a313c8b41e151a5e67c999b56e5eae41abdfdcc616f44a6fb645daeab0f8a"`. Attempt 2 failed with `failed to inspect container health: Error response from daemon: No such container: supabase_db_expense-dashboard`. Attempt 3 failed with `supabase_db_expense-dashboard container is not ready: starting`. The script terminated with `Failed to start Supabase after 3 attempts` and exit code 1.
- **Challenger 1 Gen 2 Findings**: Observed that `e2e/run_e2e.ts` failed with `supabase start is already running.` and `supabase_db_expense-dashboard container is not ready: starting` in Attempts 1 & 2. Attempt 3 failed with `Failed to remove container: 8441ade7c2513a19b99e16ef66495d36bd39808714333691737dd59f00efea97 Error response from daemon: removal of container ... is already in progress`.
- **Challenger 2 Gen 2 Findings**: Observed via system message that `pkill -9 -f "supabase"` forcefully terminates `supabase-go`, leaving behind orphaned lock files (`~/.supabase/supabase.lock` or `/tmp/supabase.lock`). Because `run_e2e.ts` only removes `supabase/.temp`, subsequent retries fail instantly with `supabase start is already running.`.
- **`e2e/run_e2e.ts` Code Structure**: Observed via `view_file` that `e2e/run_e2e.ts` contains redundant, copy-pasted cleanup blocks in multiple locations:
  - Lines 37-47: Pre-loop cleanup in `setup()`.
  - Lines 54-63: Unconditional cleanup at the start of the `for (let i = 0; i < 3; i++)` loop (`i=0`).
  - Lines 92-102: Cleanup in the `catch (err)` block of the retry loop.
  - Lines 119-128: Cleanup in `cleanup()`.
  - Lines 168-179, 225-236, 243-254, 275-286: Inline cleanup blocks during health check retries in `run()`.
- **`PROJECT.md` Teardown Contract**: Observed in `PROJECT.md` and `SCOPE.md` that the teardown contract requires `npx supabase stop`, `pkill -9 -f supabase`, `pkill -9 -f supabase-go`, `pkill -9 -f npx supabase`, `docker rm -f`, `docker volume rm -f`, `while docker ps -aq`, `fuser -k 25432/tcp`, `rm -rf supabase/.temp`, `sleep 20`.

## 2. Logic Chain
1. **Docker Daemon Race Condition Mechanism**: In `setup()`, `docker ps -aq | xargs -r docker rm -f` and `npx supabase stop` are invoked immediately before the `for` loop (lines 38-40) and again at the start of the loop (`i=0`, lines 54-56). This redundant invocation sends conflicting force-remove requests to the Docker daemon. Because container removal is asynchronous, `sleep 20` is insufficient when the daemon is locked in an active removal operation. When `npx supabase start --debug` is executed, Supabase attempts to create or remove containers, colliding with the daemon's active removal process and triggering the fatal errors `removal of container ... is already in progress` and `Conflict. The container name "/supabase_db_expense-dashboard" is already in use`.
2. **Supabase CLI Lock Contention Mechanism**: When an attempt fails or during pre-loop cleanup, `pkill -9 -f "supabase"` forcefully terminates `supabase`, `supabase-go`, and `npx supabase` processes with `SIGKILL`. This prevents `supabase-go` from performing graceful cleanup, leaving behind orphaned lock files (`~/.supabase/supabase.lock` and `/tmp/supabase.lock`). Because `e2e/run_e2e.ts` only removes `supabase/.temp`, the Supabase CLI detects the orphaned lock files on the next `npx supabase start` attempt and aborts instantly with `supabase start is already running.`.
3. **Desynchronized State & Starvation**: Because `npx supabase start` aborts instantly due to lock contention or container naming conflicts, the Supabase containers never boot successfully (`supabase_db_expense-dashboard container is not ready: starting`). Consequently, `setup()` fails after 3 attempts, aborting `run_e2e.ts` before building the Next.js production bundle or launching Playwright.
4. **Remediation Strategy**: To achieve bulletproof standalone reliability, `e2e/run_e2e.ts` must be refactored to:
   - Deduplicate all cleanup logic into a single `async function cleanSupabase()` helper function.
   - Include `rm -rf supabase/.temp ~/.supabase/supabase.lock /tmp/supabase.lock 2>/dev/null || true` in `cleanSupabase()` to eliminate Supabase CLI lock contention.
   - Enforce a strict sequence in `cleanSupabase()`: graceful stop (`npx supabase stop`), process kill (`pkill -9`), port release (`fuser -k`), lock removal (`rm -rf`), container/volume removal (`docker rm -f`), daemon wait loop (`while docker ps -aq`), and a mandatory settling delay (`sleep 20`).
   - Call `await cleanSupabase()` exactly once before the `for` loop in `setup()`, remove the redundant cleanup at the start of the loop (`i=0`), and only call `await cleanSupabase()` in the `catch (err)` block if an attempt fails.

## 3. Caveats
- **Read-Only Constraint**: As an Explorer agent, we operated under a strict read-only investigation constraint and did not modify `e2e/run_e2e.ts` directly. The recommended fix strategy must be implemented by Worker Gen 3.
- **Local-Only Guardrail**: All investigations were performed locally within the project workspace. No external services were accessed, and no code was pushed to GitHub.

## 4. Conclusion
- **Verdict**: ACTIONABLE REMEDIATION STRATEGY DEFINED.
- **Summary**: `e2e/run_e2e.ts` fails in standalone execution due to redundant cleanup blocks causing Docker daemon race conditions (`removal of container ... is already in progress`, `Conflict. The container name ... is already in use`) and `pkill -9` leaving orphaned lock files causing Supabase CLI lock contention (`supabase start is already running`). 
- **Actionable Fix Strategy for Worker Gen 3**:
  1. **Create `cleanSupabase()` Helper**: Add the following helper function at the top of `e2e/run_e2e.ts`:
     ```typescript
     async function cleanSupabase() {
       console.log('Stopping Supabase containers and cleaning up Docker/locks...');
       try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('rm -rf supabase/.temp ~/.supabase/supabase.lock /tmp/supabase.lock 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
       try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
     }
     ```
  2. **Refactor `setup()`**:
     - Replace lines 37-47 with `await cleanSupabase();`.
     - Remove lines 54-63 entirely (do not clean at the start of the `for` loop).
     - Replace lines 92-102 in the `catch (err)` block with:
       ```typescript
       console.error(`Supabase start attempt ${i + 1} failed. Checking status and cleaning up before retry...`);
       try { execSync('npx supabase status', { stdio: 'inherit' }); } catch (statusErr) { console.error('Supabase status check failed.'); }
       await cleanSupabase();
       ```
  3. **Refactor `run()` and `cleanup()`**:
     - Replace the inline cleanup blocks in `run()` (lines 168-179, 225-236, 243-254, 275-286) with `await cleanSupabase();`.
     - Replace lines 119-128 in `cleanup()` with `try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}` followed by the necessary synchronous cleanup commands (since `cleanup()` is called in `finally` and may need to be synchronous). Alternatively, ensure `cleanup()` performs the exact same synchronous `execSync` sequence as `cleanSupabase()`.

## 5. Verification Method
To independently verify the success of Worker Gen 3's remediation, execute the master E2E test runner command from the project root `/usr/local/google/home/duynguyenn/expense-dashboard`:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
```
- **Expected Result**: All 6 standalone verification scripts will pass successfully with exit code 0. `npx tsx e2e/run_e2e.ts` will execute `cleanSupabase()` exactly once during setup, successfully start Supabase on Attempt 1 without encountering `Conflict. The container name ... is already in use`, `removal of container ... is already in progress`, or `supabase start is already running`, build the Next.js bundle, execute the Playwright E2E test suite successfully, and terminate with exit code 0.
- **Files to Inspect**: `e2e/run_e2e.ts`.
