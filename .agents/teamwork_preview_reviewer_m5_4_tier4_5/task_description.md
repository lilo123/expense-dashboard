# Task Description: Reviewer 5 (Milestone 5.4 Iteration 3)

## Objective
Examine the work product of Worker 3 for correctness, completeness, robustness, and interface conformance against `SCOPE.md`, `PROJECT.md`, `TEST_READY.md`, and `ORIGINAL_REQUEST.md` for Milestone 5.4 (Tier 4 E2E Test Pass - Real-World Application Scenarios).

## Scope & Constraints
- **Role**: High-reliability review agent (`teamwork_preview_reviewer`).
- **Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_4_tier4_5`
- **PROJECT.md Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- **SCOPE.md Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_4_tier4/SCOPE.md`
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
4. Verify that all tests pass successfully with exit code 0. Document your findings, verdict (APPROVE / REQUEST_CHANGES), and verification results in `handoff.md`.
