## 2026-07-07T06:52:58Z
You are a teamwork_preview_worker.
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_3_tier3_2`.
Your identity is Tier 3 E2E Worker 2.

Load the Jetski skill at:
  /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

This skill provides methodology for modifying existing code and ensuring correctness.

Your task:
1. Read `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`, `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_3_tier3/SCOPE.md`, `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`, and `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_3_tier3_4/handoff.md`.
2. Implement the concrete fix strategy recommended by Explorer 4:
   - Eliminate the Suicide Bug: Remove `pkill -9 -f "supabase"` entirely from `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts`. Rely exclusively on the targeted patterns `pkill -9 -f "supabase-go"` and `pkill -9 -f "npx supabase"`.
   - Reorder Teardown Sequence: Restructure `teardownSupabase()` in `e2e/run_e2e.ts` (8 locations) and `e2e/adv_supabase_teardown_race.ts` (1 location) to strictly adhere to `SCOPE.md`, ensuring `pkill` executes AFTER `docker rm -f` and Docker wait loops:
     ```typescript
     // 1. Graceful stop
     try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     // 2. Docker container and volume cleanup
     try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('docker network prune -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('docker network ls -q | grep -v "bridge\\|host\\|none" | xargs -r docker network rm 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     // 3. Wait for Docker daemon to fully clear containers and volumes
     try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
     // 4. Targeted pkill for remaining Supabase CLI/daemon processes
     try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     // 5. Port cleanup
     try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     // 6. Lockfile and temp cleanup (using $HOME instead of ~)
     try { execSync('rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     // 7. Buffer sleep
     try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
     ```
     *(Note: For `e2e/adv_supabase_teardown_race.ts`, use `stdio: 'ignore'` and `sleep 5` as appropriate for that script).*
   - Fix Lockfile Pathing: Ensure `rm -rf` explicitly uses `$HOME/.supabase` instead of `~/.supabase` across all scripts so `/bin/sh` successfully removes `supabase.lock`.
3. Verify your changes by running the full E2E test runner command as defined in `TEST_READY.md`:
   `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts`
   Ensure all tests pass successfully with exit code 0.
4. Verify that the output follows the code layout in `PROJECT.md`.
5. Write your structured handoff report (`handoff.md`) in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_3_tier3_2`) following the Handoff Protocol.
6. Send a completion message to your parent (the Sub-orchestrator) when done.

## 2026-07-07T06:56:22Z
**Context**: Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations) implementation hardening.
**Content**: Challenger 1 has completed its empirical stress-testing and uncovered three distinct Supabase/Docker startup failure modes: Docker container conflicts, stale Docker network DNS (`nxdomain`), and Supabase CLI DB container readiness timeouts.
Challenger 1 successfully hardened `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts` by:
1. Explicitly pruning Docker networks (`docker network prune -f` and `docker network ls -q | grep -v "bridge\|host\|none" | xargs -r docker network rm 2>/dev/null || true`).
2. Adding comprehensive lock file removal (remember to use `$HOME/.supabase` instead of `~/.supabase` for `/bin/sh` compatibility).
3. Implementing an inner retry loop in `setup()` for `npx supabase start --debug --ignore-health-check` without teardown, allowing containers 10 seconds to stabilize before retrying start.
**Action**: Please ensure your implementation in `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts` incorporates this inner retry loop in `setup()` without teardown, along with the Explorer 4 teardown fixes (`docker rm` before `pkill`, `$HOME/.supabase`, removing `pkill -9 -f "supabase"`). Verify all changes with the master E2E test runner command and ensure exit code 0 before writing your handoff report.
