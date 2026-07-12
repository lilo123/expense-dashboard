## 2026-07-07T08:46:07Z

You are Worker Gen 7 for Milestone 5.2 (Tier 2 E2E Test Pass - Boundary & Corner Cases), Iteration 7.
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_2_gen7`.

Load the Jetski skill at:
  `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

This skill provides a software engineering methodology for modifying existing code, performing refactors, and ensuring correctness.

Read the following files to understand the project and scope:
- `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_2_tier2/SCOPE.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/ORIGINAL_REQUEST.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_2_iter7_3/handoff.md`

## Synthesized Explorer Findings (Iteration 7)

### Consensus
- **Teardown Sequence Contract Violation (`e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts`)**: `SCOPE.md` explicitly defines the Teardown Sequence contract: `"Standardized bulletproof teardown sequence across all 9 locations... ensuring pkill executes after docker rm -f to prevent supabase-go daemon corruption."` In `e2e/run_e2e.ts` (lines 31-39) and `__tests__/db/recurring_db.test.ts` (lines 30-35), `pkill` executes before `docker rm -f`. This terminates the managing `supabase-go` daemon while Docker containers are still actively running, leaving Docker containers orphaned without their managing daemons, risking state corruption, locked sockets, and race conditions upon subsequent startup attempts. (Source: Explorer 3 Iteration 7)
- **Other Teardown Locations**: `e2e/adv_supabase_teardown_race.ts`, `e2e/test_fuser.ts`, `e2e/test_pkill.ts`, and `e2e/test_supabase_pkill.ts` correctly adhere to the contract by executing `docker rm -f` prior to `pkill`. No essential teardown locations remain unverified. (Source: Explorer 3 Iteration 7)

## Your Task
1. **Update `e2e/run_e2e.ts`**: Invert the teardown sequence order in `teardownSupabase()` (lines 31-39) to ensure `docker rm -f` executes before `pkill`:
   ```typescript
  // Docker container and volume cleanup (targeted) BEFORE pkill
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  // Targeted pkill for Supabase CLI/daemon processes AFTER docker cleanup
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   ```
2. **Update `__tests__/db/recurring_db.test.ts`**: Invert the teardown sequence order in `beforeAll` (lines 30-35) to ensure `docker rm -f` executes before `pkill`:
   ```typescript
        try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   ```
3. **Verify**: Execute `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx supabase stop --no-backup 2>/dev/null || true && docker ps -aq | xargs -r docker rm -f 2>/dev/null || true && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts` to verify 100% passing tests with exit code 0.
4. **Handoff**: Produce a structured handoff report (`handoff.md`) in your working directory documenting your changes, verification commands, and test results.
5. **Report**: Send a completion message to your parent with the summary of your changes and the path to your `handoff.md`.
