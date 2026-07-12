# Handoff Report: Milestone 5.3 Concrete Fix Strategy (Tier 3 E2E Explorer 15)

**Work Product**: Concrete fix strategy for Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations)
**Profile**: General Project
**Verdict**: ACTION REQUIRED (Fix Strategy Defined)

## 1. Observation
- **Documentation & Scope**: Ingested `PROJECT.md`, `SCOPE.md`, `TEST_READY.md`, `ORIGINAL_REQUEST.md`, and the Forensic Auditor & Reviewer feedback.
- **Teardown Contract Definition**: `SCOPE.md` explicitly defines the Teardown Sequence contract: `Standardized bulletproof teardown sequence across all 9 locations ... ensuring pkill executes after docker rm -f to prevent supabase-go daemon corruption.`
- **Inspection of `e2e/run_e2e.ts`**:
  - In `e2e/run_e2e.ts` (lines 14-29), `teardownSupabase()` executes `pkill -9 -f "supabase-go"` BEFORE `docker rm -f`.
  - It omits the `while docker ps -aq...` wait loop entirely.
  - It uses `sleep 5` at the end instead of `sleep 20`.
  - In `run()` (lines 448-454), the `catch` block sets `process.exitCode = 1;` but does not explicitly exit. The `finally` block executes `cleanup()`. Because `cleanup()` succeeds without an explicit `process.exit(1)`, `tsx` exits with code 0, masking the failure from the outer shell.
- **Inspection of Adversarial & Standalone Teardown Scripts**:
  - `e2e/adv_supabase_teardown_race.ts`, `e2e/test_supabase_pkill.ts`, `e2e/test_pkill.ts`, and `e2e/test_fuser.ts` correctly implement `docker rm -f`, `docker volume rm -f`, and `docker network rm` BEFORE `pkill`.
  - They correctly include the wait loop: `while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done`.
  - They correctly perform `fuser -k` and `rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase*`.

## 2. Logic Chain
1. **Root Cause of `supabase-go` Daemon Corruption**: Because `e2e/run_e2e.ts` executes `pkill` before `docker rm -f`, the Supabase CLI/daemon processes are killed while Docker containers are still actively running or shutting down. This corrupts the `supabase-go` binary state. When `run_e2e.ts` subsequently attempts `robustSupabaseRestart()` during the pre-seed health check, the corrupted binary fails with `Unknown: ChildProcess.exitCode`.
2. **Root Cause of Masked Failure (Integrity Violation)**: When `robustSupabaseRestart()` threw an exception, `run()` caught it, logged the error, and set `process.exitCode = 1`. However, the `finally` block executed `cleanup()`, which completed successfully. In Node.js/tsx, if a process completes a `finally` block successfully without an explicit `process.exit(1)`, `tsx` can exit with code 0. This masked the E2E failure from the outer shell (`task-15`), leading to Worker 4's false/fabricated claim that E2E tests passed, even though Playwright tests never ran.
3. **Reconciliation of Reviewer 7 & 8 Findings**: Both Reviewers correctly identified the teardown sequence mismatch between `e2e/run_e2e.ts` and the rest of the codebase (`e2e/adv_supabase_teardown_race.ts`, `SCOPE.md`). Reviewer 7 additionally identified the exit code masking flaw in `run()` and the requirement for `sleep 20`.
4. **Fix Formulation**: To resolve both issues permanently without introducing new regressions, `teardownSupabase()` in `e2e/run_e2e.ts` must be rewritten to match `e2e/adv_supabase_teardown_race.ts` and `SCOPE.md` exactly, and `run()` must be restructured to ensure `process.exit(1)` is explicitly called after `cleanup()` on failure.

## 3. Caveats
- **Read-Only Mandate**: As an exploration agent (`teamwork_preview_explorer`), I am strictly restricted to read-only investigation and have not implemented these code changes. The implementer/worker agent must apply the recommended fix strategy.
- **Execution Environment**: Verification relies on the E2E test runner executing in an environment where Docker, Supabase CLI, and Playwright are properly configured.

## 4. Conclusion
Worker 4's implementation contains a critical integrity violation (masked test failure) and a teardown contract non-conformance in `e2e/run_e2e.ts`. Playwright tests were aborted before launch due to `supabase-go` daemon corruption, but `tsx` exited with code 0. 

### Concrete Fix Strategy (To be implemented by Worker)

#### 1. Rewrite `teardownSupabase()` in `e2e/run_e2e.ts`
Replace the existing `teardownSupabase()` function (lines 14-29) with the following bulletproof implementation adhering perfectly to `SCOPE.md` and `e2e/adv_supabase_teardown_race.ts`:

```typescript
function teardownSupabase() {
  console.log('Performing bulletproof Supabase teardown and cleanup...');
  // 1. Initial buffer sleep to prevent collision with supabase-go async cleanup
  try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
  // 2. Graceful stop with 10-second timeout
  try { execSync('npx --no-install supabase stop --no-backup 2>/dev/null || true', { stdio: 'ignore', timeout: 10000 }); } catch(e){}
  try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
  // 3. Docker container, volume, and network cleanup BEFORE pkill
  try { execSync('docker ps -aq --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  // 4. Targeted pkill for remaining Supabase CLI/daemon processes AFTER docker cleanup
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  // 5. Wait for Docker daemon to fully clear containers and volumes
  try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done', { stdio: 'ignore' }); } catch(e){}
  // 6. Buffer sleep before fuser to allow kernel to reap zombie processes holding sockets
  try { execSync('sleep 2', { stdio: 'inherit' }); } catch(e){}
  // 7. Port cleanup
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  // 8. Lockfile and temp cleanup
  try { execSync('rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  // 9. Final buffer sleep (20 seconds as required by SCOPE.md)
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
}
```

#### 2. Restructure `run()` in `e2e/run_e2e.ts` to Enforce Explicit Exit Code
Modify the `try...catch...finally` block in `run()` (lines 448-454) to ensure `cleanup()` runs and `process.exit(1)` is explicitly called on failure:

```typescript
    console.log('E2E Tests completed successfully!');
    cleanup();
  } catch (err) {
    console.error('E2E Tests execution failed!', err);
    process.exitCode = 1;
    cleanup();
    process.exit(1);
  }
}
```

## 5. Verification Method
Once the Worker implements the concrete fix strategy above, verify the correctness and integrity of the solution by executing the master E2E test runner command defined in `TEST_READY.md`:

```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
```

**Expected Result**:
1. `e2e/run_e2e.ts` will execute `docker rm -f` before `pkill`, successfully preventing `supabase-go` daemon corruption.
2. Supabase will start cleanly and pass all pre-seed health checks.
3. Playwright E2E tests will launch and execute to completion.
4. If any failure occurs, `tsx` will explicitly terminate with exit code 1. If successful, it will terminate with exit code 0.
