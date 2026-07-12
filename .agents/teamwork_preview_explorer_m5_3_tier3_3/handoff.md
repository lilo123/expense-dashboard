# Handoff Report: Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations)

## Observation

1. **E2E Test Runner Failure**:
   - **Command Executed**: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts; npx tsx e2e/verify_accumulation.ts; npx tsx e2e/verify_monte_carlo.ts; npx tsx e2e/stress_test_m4.ts; npx tsx e2e/stress_test_m4_edge_cases.ts; npx tsx e2e/adv_planner_gaps.ts; npx tsx e2e/run_e2e.ts`
   - **Result**: All 6 standalone E2E verification scripts (`verify_global_market_data.ts`, `verify_accumulation.ts`, `verify_monte_carlo.ts`, `stress_test_m4.ts`, `stress_test_m4_edge_cases.ts`, `adv_planner_gaps.ts`) passed successfully with exit code 0.
   - **Verbatim Error (`e2e/run_e2e.ts`)**:
     ```
     failed to create docker container: Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use by container "fdd8dba74258a7c9d5167b301f57894ffda2c660ce0776077b339e97a5983093". You have to remove (or rename) that container to be able to reuse that name.
     Supabase start attempt 1 failed. Checking status and cleaning up before retry...
     ...
     Failed to start Supabase after 3 attempts.
     ```

2. **Adversarial Teardown Race Condition Confirmation**:
   - **File**: `e2e/adv_supabase_teardown_race.ts`
   - **Lines 9–17**:
     ```typescript
     console.log('2. Executing Worker 1 teardown sequence (pkill supabase AFTER docker wait loop)...');
     try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
     try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
     try { execSync('while docker ps -aq | grep -q .; do sleep 2; done', { stdio: 'ignore' }); } catch(e){}
     try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
     try { execSync('pkill -f supabase 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
     try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
     try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
     try { execSync('sleep 5', { stdio: 'ignore' }); } catch(e){}
     ```
   - **Verbatim Error Exposed**:
     ```
     [ADVERSARIAL FAILURE EXPOSED] Supabase teardown race condition confirmed!
     ```

3. **Teardown Sequence Locations in `e2e/run_e2e.ts`**:
   - **File**: `e2e/run_e2e.ts`
   - **Locations (8 distinct blocks)**: lines 38-47, 54-63, 93-102, 119-128, 168-177, 225-234, 243-252, 275-284.
   - In all 8 blocks, `pkill -9 -f "supabase"`, `pkill -9 -f "supabase-go"`, and `pkill -9 -f "npx supabase"` are executed AFTER `docker ps -aq | xargs -r docker rm -f` and `while docker ps -aq | ...`.

4. **Scope Definition vs Implementation**:
   - **File**: `.agents/sub_orch_m5_3_tier3/SCOPE.md`
   - **Line 15**:
     ```
     - **Teardown Sequence**: Standardized bulletproof teardown sequence across all 9 locations (`npx supabase stop`, `pkill -9 -f supabase`, `pkill -9 -f supabase-go`, `pkill -9 -f npx supabase`, `docker rm -f`, `docker volume rm -f`, `while docker ps -aq`, `fuser -k 25432/tcp`, `rm -rf supabase/.temp`, `sleep 20`) ensuring `pkill` executes after `docker rm -f` to prevent `supabase-go` daemon corruption.
     ```
   - **Contradiction**: The parenthesized list correctly places `pkill` BEFORE `docker rm -f`, but the text states "ensuring pkill executes after docker rm -f". `e2e/run_e2e.ts` followed the latter, which `e2e/adv_supabase_teardown_race.ts` proved causes the fatal race condition.

## Logic Chain

1. When `npx supabase stop --no-backup` is executed, the `supabase` CLI and its background daemon `supabase-go` actively manage the Docker containers.
2. If `docker ps -aq | xargs -r docker rm -f` is executed while `supabase-go` or `npx supabase` is still active (because `pkill` has not run yet), `supabase-go` detects the unexpected container termination/absence and attempts to restart or recreate `supabase_db_expense-dashboard`.
3. By the time `pkill -9 -f "supabase"` executes, `supabase-go` has already initiated the recreation of `supabase_db_expense-dashboard`, leaving an orphaned container in Docker.
4. When `npx supabase start` subsequently runs, it encounters the orphaned container, resulting in the fatal Docker daemon conflict error: `Conflict. The container name "/supabase_db_expense-dashboard" is already in use by container...`.
5. To eliminate this race condition, the `pkill` commands (`pkill -9 -f "supabase"`, `pkill -9 -f "supabase-go"`, `pkill -9 -f "npx supabase"`) must execute BEFORE `docker ps -aq | xargs -r docker rm -f` across all 9 locations (8 in `e2e/run_e2e.ts` and 1 in `e2e/adv_supabase_teardown_race.ts`). This ensures `supabase-go` is fully terminated before Docker containers are removed, preventing any background recreation.

## Caveats

No caveats. All 6 standalone verification scripts passed successfully with exit code 0, confirming that the core domain logic, Web Worker simulation engine, Zod schemas, and market data toggles are fully functional. The sole E2E blocker is the Supabase teardown race condition in `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts`.

## Conclusion

- The E2E test suite fails during the Supabase startup phase in `e2e/run_e2e.ts` due to a container conflict race condition caused by executing `pkill` after `docker rm -f`.
- The concrete fix strategy is to reorder the teardown sequence across all 8 locations in `e2e/run_e2e.ts` and 1 location in `e2e/adv_supabase_teardown_race.ts` so that `pkill -9 -f "supabase"`, `pkill -9 -f "supabase-go"`, and `pkill -9 -f "npx supabase"` execute immediately after `npx supabase stop` and BEFORE `docker ps -aq | xargs -r docker rm -f`.

## Verification Method

1. After applying the reordering to `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts`, execute the master test runner command:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/adv_supabase_teardown_race.ts && npx tsx e2e/run_e2e.ts
   ```
2. **Expected Result**: All tests pass with exit code 0 and zero container conflict errors.
