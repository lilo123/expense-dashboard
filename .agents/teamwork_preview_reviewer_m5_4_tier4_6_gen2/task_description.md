# Task Description: Reviewer 6 gen2 (Milestone 5.4 Iteration 3)

## Objective
Resume work from Reviewer 6 (`e7bc273e-8e87-4684-989b-2f01b0bdb9d2`) which was replaced due to the 20-minute liveness hard deadline. Examine Worker 3's work product for correctness, completeness, robustness, and interface conformance against `SCOPE.md`, `PROJECT.md`, `TEST_READY.md`, and `ORIGINAL_REQUEST.md` for Milestone 5.4 (Tier 4 E2E Test Pass - Real-World Application Scenarios).

## Scope & Constraints
- **Role**: High-reliability review agent (`teamwork_preview_reviewer`).
- **Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_4_tier4_6_gen2`
- **PROJECT.md Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- **SCOPE.md Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_4_tier4/SCOPE.md`
- **Worker 3 Handoff**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_4_tier4_3/handoff.md`
- **Output**: When complete, write `handoff.md` in your working directory and send a completion message to your parent (`7e0044de-32e4-4663-b0f1-61f2fcd039b1`).

---

## Last Known State from Reviewer 6 `progress.md`
- Initialized ORIGINAL_REQUEST.md and BRIEFING.md.
- Inspected TEST_READY.md, e2e/run_e2e.ts, e2e/calculator_tier4.spec.ts, e2e/calculator_tier4_strict.spec.ts, BudgetPlanner.tsx, and loading.tsx.
- Confirmed Worker 3's changes adhere to PROJECT.md and SCOPE.md contracts (direct node invocation, etimes > 7200, etimes > 1800, try/catch around init_db.ts).
- Verified no integrity violations (no .disableRules in AxeBuilder, no hardcoded test passes).
- Analyzed task-23 and task-31 exit code 137 (swarm assassination by lingering old processes from previous agent iterations).
- Cleaned up all lingering old processes and lock files.
- Started master verification command cleanly in background (task-41), waiting for completion.

---

## Verification Instructions
1. Execute the master verification command from `TEST_READY.md`:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
2. Verify that all tests pass successfully with exit code 0. Document your findings, verdict (APPROVE / REQUEST_CHANGES), and verification results in `handoff.md`.
