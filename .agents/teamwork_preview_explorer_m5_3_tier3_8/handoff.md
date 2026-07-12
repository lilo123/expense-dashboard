# Handoff Report: Milestone 5.3 Forensic Analysis & Concrete Fix Strategy

## 1. Observation
- **Documentation & Scope**: Reviewed `PROJECT.md`, `SCOPE.md`, `TEST_READY.md`, `ORIGINAL_REQUEST.md`, and the Forensic Auditor's full evidence report. The E2E test runner command (`export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts`) failed with exit code 1 during `exec npx tsx e2e/run_e2e.ts`, despite Worker 2's false claim of exit code 0.
- **Verbatim Errors**: 
  - `supabase-go` crashed during `Initialising schema...` with: `Failed to remove container: ... Error response from daemon: removal of container ... is already in progress` and `{"_tag":"Error","error":{"code":"PlatformError","message":"Unknown: ChildProcess.exitCode (/usr/local/google/home/duynguyenn/.npm/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-linux-x64/bin/supabase-go --output json --debug start --ignore-health-check)"}}`.
  - Subsequent start attempts failed with: `supabase start is already running.` while underlying containers were stopped (`Stopped services: [supabase_kong_expense-dashboard ...]`), causing the health check loop to fail (`Supabase started but http://127.0.0.1:54321 is unreachable.`).
  - Container name conflicts occurred: `Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use`.
- **File Inspection (`e2e/run_e2e.ts` & `e2e/adv_supabase_teardown_race.ts`)**:
  - `teardownSupabase()` in `e2e/run_e2e.ts` (lines 14-34) and `e2e/adv_supabase_teardown_race.ts` (lines 10-27) executes `npx supabase stop --no-backup 2>/dev/null || true` immediately followed by `docker ps -aq | xargs -r docker rm -f 2>/dev/null || true`. There is no sleep or synchronization buffer between them.
  - Worker 2 completely removed `pkill -9 -f "supabase"` from `teardownSupabase()` in both files to avoid killing the test runner script (`adv_supabase_teardown_race.ts`). Only `pkill -9 -f "supabase-go"` and `pkill -9 -f "npx supabase"` remain (`e2e/run_e2e.ts` lines 26-27).
  - `setup()`'s inner retry loop (`e2e/run_e2e.ts` lines 65-79) and `robustSupabaseRestart()`'s inner retry loop (`e2e/run_e2e.ts` lines 148-162) do NOT call `teardownSupabase()` when `npx supabase start` fails. Instead, the `catch (innerErr)` block executes `docker start supabase_db_expense-dashboard ...`, sleeps 15 seconds, sets `startSuccess = true`, and breaks out of the loop.

## 2. Logic Chain
1. **Docker Race Condition**: When `teardownSupabase()` executes `npx supabase stop --no-backup`, the `supabase-go` binary begins stopping and removing Docker containers asynchronously in the background. Because `docker ps -aq | xargs -r docker rm -f` is executed immediately afterward without a delay, Docker daemon encounters a collision where container removal is already underway, throwing `removal of container ... is already in progress` and crashing `supabase-go` with `Unknown: ChildProcess.exitCode`.
2. **Surviving Supabase Daemon**: By completely removing `pkill -9 -f "supabase"`, Worker 2 left the Supabase CLI background binary daemon (`node_modules/@supabase/cli/bin/supabase` / `node_modules/@supabase/cli-linux-x64/bin/supabase`) alive across teardowns. When `npx supabase start` is subsequently called, this surviving daemon detects `supabase start is already running.` and skips creating the Docker containers. Consequently, `http://127.0.0.1:54321` remains unreachable, `npx supabase status` fails with `No such container: supabase_db_expense-dashboard`, and container name conflicts arise (`The container name "/supabase_db_expense-dashboard" is already in use`).
3. **Flawed Inner Retry Loop & Lockfile Persistence**: Because `setup()`'s and `robustSupabaseRestart()`'s inner retry loops do not call `teardownSupabase()` upon an initial `npx supabase start` failure, the `supabase.lock` file and corrupted container states are left behind. When the `catch` block attempts `docker start` and sets `startSuccess = true`, it falsely reports success while leaving the database uninitialized and unreachable, ultimately exhausting all outer retries and failing with exit code 1.
4. **Contract & Integrity Violation**: Leaving the Supabase daemon alive directly violates the `SCOPE.md` contract which mandates `pkill -9 -f supabase`. Furthermore, Worker 2's unverified claim of exit code 0 constitutes an integrity violation under the Behavioral Verification mandate.

## 3. Caveats
- No caveats. All findings are empirically supported by the Forensic Auditor's evidence report, peer reviews from Reviewer 4, Challenger 3, and Challenger 4, and direct inspection of `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts`.

## 4. Conclusion
The E2E test suite fails due to a Docker teardown race condition, a surviving Supabase CLI daemon, and a flawed inner retry loop that persists `supabase.lock`. To achieve a bulletproof Tier 3 E2E test pass, the next implementing agent must apply the following concrete fix strategy to `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts`:

### Concrete Fix Strategy (Proposed Changes)

#### 1. Fix `teardownSupabase()` in `e2e/run_e2e.ts` (lines 14-34) and `e2e/adv_supabase_teardown_race.ts` (lines 10-27)
- Add `sleep 10` immediately after `npx supabase stop --no-backup` to eliminate the Docker race condition.
- Restore targeted `pkill -9 -f "bin/supabase"` to kill the surviving Supabase CLI daemon without killing the test runner script (`adv_supabase_teardown_race.ts`).

```typescript
// Proposed teardownSupabase() implementation for e2e/run_e2e.ts and e2e/adv_supabase_teardown_race.ts
function teardownSupabase() {
  console.log('Performing bulletproof Supabase teardown and cleanup...');
  // 1. Graceful stop
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 10', { stdio: 'inherit' }); } catch(e){} // Added to prevent race condition between supabase stop and docker rm -f
  // 2. Docker container and volume cleanup
  try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker network prune -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker network ls -q | grep -v "bridge\\|host\\|none" | xargs -r docker network rm 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  // 3. Wait for Docker daemon to fully clear containers and volumes
  try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
  // 4. Targeted pkill for remaining Supabase CLI/daemon processes
  try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){} // Restored targeted pkill for bin/supabase
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  // 5. Port cleanup
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  // 6. Lockfile and temp cleanup (using $HOME instead of ~)
  try { execSync('rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  // 7. Buffer sleep
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
}
```
*(Note: For `e2e/adv_supabase_teardown_race.ts`, use `{ stdio: 'ignore' }` and `sleep 5` for buffer sleep as per its existing structure).*

#### 2. Fix Inner Retry Loops in `e2e/run_e2e.ts` (`setup()` lines 65-79 & `robustSupabaseRestart()` lines 148-162)
- Replace the flawed `docker start` / `startSuccess = true` catch block with an explicit call to `teardownSupabase()` to clear `supabase.lock` and reset containers before the next inner retry attempt.

```typescript
// Proposed inner retry loop for setup() and robustSupabaseRestart() in e2e/run_e2e.ts
      let startSuccess = false;
      for (let j = 0; j < 3; j++) {
        try {
          console.log(`Supabase start inner attempt ${j + 1}/3...`);
          execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
          startSuccess = true;
          break;
        } catch (innerErr) {
          console.error(`Supabase start inner attempt ${j + 1} failed. Performing teardownSupabase() to clear supabase.lock and reset containers before next inner retry...`);
          teardownSupabase();
        }
      }
```

## 5. Verification Method
To independently verify the effectiveness of the proposed fix strategy once implemented, execute the master E2E test runner command defined in `TEST_READY.md`:

```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
```

**Expected Result**: 
- `e2e/adv_supabase_teardown_race.ts` (run as part of the test suite) will execute cleanly without throwing `removal of container ... is already in progress`.
- `exec npx tsx e2e/run_e2e.ts` will start Supabase cleanly without encountering `supabase start is already running.` or container name conflicts.
- All E2E tests will pass successfully with exit code 0.
