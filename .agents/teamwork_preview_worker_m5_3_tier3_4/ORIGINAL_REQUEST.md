## 2026-07-07T08:24:15Z

You are a teamwork_preview_worker (Versatile worker with loadable domain expertise).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_3_tier3_4`.
Your identity is Tier 3 E2E Worker 4.

Load the Jetski skill at:
  /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

This skill provides methodology for modifying existing code, performing cross-file refactors, and ensuring robust implementation.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your task:
1. Read `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`, `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_3_tier3/SCOPE.md`, `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`, and the Explorer handoff reports (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_3_tier3_10/handoff.md`, `..._11/handoff.md`, `..._12/handoff.md`).
2. Implement the concrete fix strategy formulated by the Explorers across `e2e/run_e2e.ts`, `e2e/adv_supabase_teardown_race.ts`, `e2e/adv_supabase_lifecycle.ts`, `e2e/test_supabase_pkill.ts`, `e2e/test_pkill.ts`, and `e2e/test_fuser.ts`:
   - Replace every instance of `npx supabase` with `npx --no-install supabase` across all 6 files.
   - Standardize `teardownSupabase()` in `e2e/run_e2e.ts` and all inline teardown sequences in `e2e/adv_supabase_teardown_race.ts`, `e2e/test_supabase_pkill.ts`, `e2e/test_pkill.ts`, and `e2e/test_fuser.ts` to include:
     1. `sleep 5` buffer at the very beginning (before calling `npx --no-install supabase stop`).
     2. `timeout: 10000` in the `execSync` options for `npx --no-install supabase stop`.
     3. `docker network rm supabase_network_expense-dashboard 2>/dev/null || true` after `docker volume rm`.
     4. `sleep 2` buffer immediately before `fuser -k`.
3. Verify your changes by executing the full E2E test runner command defined in `TEST_READY.md`:
   `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts`
4. Ensure all tests pass successfully with exit code 0.
5. Write your structured handoff report (`handoff.md`) in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_3_tier3_4`) following the Handoff Protocol.
6. Send a completion message to your parent (the Sub-orchestrator) when done.
