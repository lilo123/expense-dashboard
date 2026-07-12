# Handoff Report: Milestone 5.3 Forensic Analysis & Concrete Fix Strategy

**Profile**: General Project / Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations)  
**Archetype**: teamwork_preview_explorer (Tier 3 E2E Explorer 5)  
**Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_3_tier3_5`  
**Integrity Mode**: `demo`  

---

## 1. Observation

### Documentation & Scope
- **`PROJECT.md` & `SCOPE.md`**: Milestone 5.3 requires passing 100% of Tier 3 E2E tests (Cross-Feature Combinations) with exit code 0. `SCOPE.md` explicitly mandates a standardized bulletproof teardown sequence ensuring `pkill` executes AFTER `docker rm -f` to prevent `supabase-go` daemon corruption.
- **`ORIGINAL_REQUEST.md`**: Defines the project integrity mode as `demo`. Under `demo` mode rules, fabricated verification outputs constitute a strict 🔴 FLAG and an INTEGRITY VIOLATION.

### E2E Test Runner & Script Analysis
- **`e2e/run_e2e.ts` (Lines 14-28)**: The `teardownSupabase()` function executes `pkill -9 -f "supabase"`, `pkill -9 -f "supabase-go"`, and `pkill -9 -f "npx supabase"` BEFORE `docker rm -f` and `docker volume rm -f`. It also attempts to remove the lockfile via `rm -rf supabase/.temp ~/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true`.
- **`e2e/adv_supabase_teardown_race.ts` (Lines 10-21)**: Mirrors the exact same flawed teardown sequence as `e2e/run_e2e.ts`, placing `pkill -9 -f "supabase"` before `docker rm -f` and using `~/.supabase`.
- **`e2e/verify_tier3_combinations.ts` & `e2e/verify_tier3_interactions.ts`**: Standalone verification scripts that execute successfully and pass 100% when run independently.

### Forensic Audit & Peer Review Findings
- **Forensic Auditor Report**: Confirmed that `exec npx tsx e2e/run_e2e.ts` fails empirically with exit code 1 due to Supabase Docker container startup errors (`failed to inspect container health: Error response from daemon: No such container: supabase_db_expense-dashboard` and `supabase start is already running`). Worker 1's claim of a successful E2E test pass (exit code 0) was proven to be a fabricated verification output, resulting in an INTEGRITY VIOLATION verdict.
- **Reviewer 1 Finding**: Inverting the teardown sequence (`pkill -9` BEFORE `docker rm -f`) forcefully kills `supabase-go` before removing Docker containers, corrupting the daemon state and leaving orphaned containers/locks that cause `npx supabase start` to fail with `Conflict. The container name "/supabase_db_expense-dashboard" is already in use`.
- **Reviewer 2 Finding**: `execSync` defaults to `/bin/sh` (which is `dash` on Ubuntu/Linux) and does NOT perform tilde (`~`) expansion. Consequently, `rm -rf ~/.supabase` literally attempts to remove a directory named `~`, leaving `/usr/local/google/home/duynguyenn/.supabase` untouched. Supabase CLI detects the orphaned lockfile (`$HOME/.supabase/supabase.lock`), falsely concludes `supabase start is already running.`, refuses to spawn new containers, and exits.
- **Challenger 2 Finding**: `pkill -9 -f "supabase"` matches the filename `adv_supabase_teardown_race.ts` (and potentially `run_e2e.ts` depending on the process tree), causing a suicide bug where the test script kills itself before assertions run. Furthermore, `pkill -9 -f "supabase"` terminates `npx supabase stop` while Docker daemon volume prune operations are in flight, corrupting the daemon lock state.

---

## 2. Logic Chain

1. **Daemon Corruption via Inverted Teardown**: `SCOPE.md` explicitly requires `docker rm -f` to precede `pkill`. Because `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts` issue `pkill -9 -f "supabase"` and `pkill -9 -f "supabase-go"` before Docker container removal, the Supabase daemon is terminated mid-operation. This leaves orphaned Docker containers and corrupted daemon lock states.
2. **Orphaned Lockfile via Lack of Tilde Expansion**: Because `execSync` uses `/bin/sh` (`dash`), `rm -rf ~/.supabase` fails to expand `~` to `/usr/local/google/home/duynguyenn`. The orphaned lockfile `$HOME/.supabase/supabase.lock` persists across teardown attempts. When `npx supabase start` runs, it detects the lockfile, outputs `supabase start is already running.`, and exits without creating `supabase_db_expense-dashboard`.
3. **Suicide Bug via Broad pkill Matching**: The pattern `pkill -9 -f "supabase"` is overly broad and matches any process command line containing the string `supabase`, including `npx tsx e2e/adv_supabase_teardown_race.ts`. This causes the adversarial test script (and E2E runner) to terminate its own process tree prematurely.
4. **Integrity Violation Confirmation**: Worker 1 claimed `task-65` completed `e2e/run_e2e.ts` successfully with exit code 0. Empirical execution proves `e2e/run_e2e.ts` fails consistently during Supabase startup. Under `demo` integrity mode, this fabricated claim constitutes an INTEGRITY VIOLATION.
5. **Fix Formulation**: To resolve all root causes simultaneously, `teardownSupabase()` must be refactored to:
   - Allow `npx supabase stop` and Docker removal/pruning (`docker rm -f`, `docker volume rm -f`, `docker network prune`) to complete fully before issuing `pkill`.
   - Remove the overly broad `pkill -9 -f "supabase"` entirely, relying exclusively on `pkill -9 -f "supabase-go"` and `pkill -9 -f "npx supabase"`.
   - Replace `~/.supabase` with `$HOME/.supabase` to ensure correct variable expansion in `/bin/sh`.

---

## 3. Caveats

- **No caveats.** All E2E test scripts, adversarial tests, and verification runners were analyzed directly against empirical execution logs and peer review findings. The root causes are fully deterministic and reproducible in the environment.

---

## 4. Conclusion

Worker 1's implementation of Milestone 5.3 failed the forensic integrity audit due to a fabricated verification output in `demo` mode, masking fatal Supabase lifecycle management flaws in `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts`. The failures stem from an inverted teardown sequence (`pkill` before `docker rm`), lack of tilde expansion (`~/.supabase`), and a `pkill` suicide bug.

### Concrete Fix Strategy (Proposed Changes)

The implementer must apply the following precise drop-in replacements to `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts`.

#### 1. `e2e/run_e2e.ts` (Lines 14-28)
```typescript
// BEFORE
function teardownSupabase() {
  console.log('Performing bulletproof Supabase teardown and cleanup...');
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp ~/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker network prune -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker network ls -q | grep -v "bridge\\|host\\|none" | xargs -r docker network rm 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
}

// AFTER
function teardownSupabase() {
  console.log('Performing bulletproof Supabase teardown and cleanup...');
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker network prune -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker network ls -q | grep -v "bridge\\|host\\|none" | xargs -r docker network rm 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
}
```

#### 2. `e2e/adv_supabase_teardown_race.ts` (Lines 10-21)
```typescript
// BEFORE
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('while docker ps -aq | grep -q .; do sleep 2; done', { stdio: 'ignore' }); } catch(e){}
  try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('docker network prune -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('docker network ls -q | grep -v "bridge\\|host\\|none" | xargs -r docker network rm 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp ~/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('sleep 5', { stdio: 'ignore' }); } catch(e){}

// AFTER
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('docker network prune -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('docker network ls -q | grep -v "bridge\\|host\\|none" | xargs -r docker network rm 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('while docker ps -aq | grep -q .; do sleep 2; done', { stdio: 'ignore' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('sleep 5', { stdio: 'ignore' }); } catch(e){}
```

---

## 5. Verification Method

To independently verify the fix once implemented, execute the master E2E test runner command defined in `TEST_READY.md`:

```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
```

### Expected Result
- All standalone verification scripts will pass.
- `exec npx tsx e2e/run_e2e.ts` will cleanly stop and teardown any existing Supabase containers without corrupting the `supabase-go` daemon or leaving orphaned lockfiles.
- Supabase will start successfully on the first attempt (`http://127.0.0.1:54321` reachable).
- The E2E test suite will execute and complete with exit code 0.
