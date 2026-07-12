# Task Description: Challenger 6 (Milestone 5.4 Iteration 3)

## Objective
Empirically verify the correctness and robustness of Worker 3's work product in `e2e/run_e2e.ts` and `TEST_READY.md` under multi-agent swarm concurrency for Milestone 5.4 (Tier 4 E2E Test Pass - Real-World Application Scenarios).

## Scope & Constraints
- **Role**: Code-executing adversarial verifier (`teamwork_preview_challenger`).
- **Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_m5_4_tier4_6`
- **PROJECT.md Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- **SCOPE.md Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_4_tier4/SCOPE.md`
- **Domain Skill Path**: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/solution_stress_testing/SKILL.md`
- **Worker 3 Handoff**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_4_tier4_3/handoff.md`
- **Output**: When complete, write `handoff.md` in your working directory and send a completion message to your parent (`7e0044de-32e4-4663-b0f1-61f2fcd039b1`).

---

## Verification Instructions
1. Inspect `TEST_READY.md` to ensure it invokes `node node_modules/.bin/tsx e2e/run_e2e.ts` directly per `PROJECT.md` contract.
2. Inspect `e2e/run_e2e.ts` to verify:
   - `etimes > 7200` is used for queued processes in `acquireLock()` and `killLingeringProcessesScoped()` to prevent swarm assassination.
   - `etimes > 1800` (30 minutes) is used for the active lock owner in `acquireLock()` per `PROJECT.md` contract.
   - `execSync('npx tsx e2e/init_db.ts')` in `robustSupabaseRestart()` is wrapped in a `try/catch` block.
3. Execute the master verification command from `TEST_READY.md`:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
4. Verify that all tests pass successfully with exit code 0 under swarm concurrency conditions. Document your findings, stress test results, and verdict in `handoff.md`.
