# Task Description: Tier 3 E2E Worker 1 (Iteration 6, Gen 2)

Load the Jetski skill at:
  /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

This skill provides a software engineering methodology for modifying existing code, performing refactors, and ensuring correctness.

## Objective & Scope
Implement the 4-part concrete fix strategy recommended by Explorer 20 to resolve the Realtime contract violation, `supabase-go` daemon corruption, concurrent process elimination war, and masked failure vulnerability for Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations).

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Input Information & Explorer Findings
Read Explorer 20's handoff report at `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_3_tier3_20_gen2/handoff.md`.
Also read `PROJECT.md`, `SCOPE.md`, `TEST_READY.md`, `ORIGINAL_REQUEST.md`, `supabase/config.toml`, and `e2e/run_e2e.ts`.

### Required Fixes
1. **Fix Realtime Contract Violation (`supabase/config.toml`)**: Modify line 82 under `[realtime]` to change `enabled = false` to `enabled = true`.
2. **Fix `supabase-go` Daemon Corruption (`e2e/run_e2e.ts`)**: Rewrite `teardownSupabase()` (lines 14-25) to strictly adhere to the `SCOPE.md` contract:
   ```typescript
   function teardownSupabase() {
     console.log('Performing bulletproof Supabase teardown and cleanup...');
     try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('pkill -9 -f supabase-go 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('while docker ps -a -q --filter name=supabase | grep -q .; do sleep 1; done 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('rm -rf supabase/.temp /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
   }
   ```
3. **Fix Concurrent Process Elimination War (`e2e/run_e2e.ts`)**: Replace the global `pgrep` and `kill -9` logic in `run_e2e.ts` (lines 205-239 and lines 246-269) with a file-based mutex lock (`/tmp/run_e2e.lock`). At the start of `setup()`, check if `/tmp/run_e2e.lock` exists; if so, wait until it is released before proceeding. Remove the lock in `cleanup()`. Remove the aggressive global `pgrep -f "node.*run_e2e"` / `pgrep -f "node|tsx|jest|webpack"` killing entirely to allow safe multi-tenant co-existence.
4. **Fix Masked Failure & Exit Code 0 Vulnerability (`TEST_READY.md`)**: Modify line 4 to replace `exec npx tsx e2e/run_e2e.ts` with direct node invocation of `tsx`:
   ```markdown
   - Command: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts`
   ```

## Verification & Output Requirements
After implementing the fixes, you MUST execute the master E2E test runner command defined in `TEST_READY.md`:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts
```
Verify that all tests pass successfully with exit code 0.
When complete, write `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_3_tier3_iter6_1_gen2`) following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method) documenting your changes and the passing test results.
When done, send a completion message to your parent (`fbb8e945-2a98-4e23-89f2-f6529a71f015`).
