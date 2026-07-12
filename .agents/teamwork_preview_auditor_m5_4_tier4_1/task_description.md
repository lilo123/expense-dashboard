# Task Description: Forensic Auditor (Milestone 5.4 - Tier 4 E2E Test Pass)

## Objective
Perform forensic integrity verification to ensure that work products implement functionality authentically using systematic checks (static analysis, runtime tracing, execution validation).

## Integrity Forensics Requirements
1. Verify that no test results, expected outputs, or verification strings are hardcoded in source code or test files.
2. Verify that no dummy or facade implementations were created to circumvent the intended task.
3. Verify that all verification outputs, logs, and attestation artifacts are genuine and unfabricated.
4. Run the master verification command from `TEST_READY.md`: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts`.
5. Write `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_auditor_m5_4_tier4_1`) documenting your forensic audit verdict (CLEAN or INTEGRITY VIOLATION) and evidence, then send a completion message to your parent.
