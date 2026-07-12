# Task Description: Forensic Auditor 3 (Milestone 5.4 Iteration 3)

## Objective
Perform forensic integrity verification of Worker 3's work product in `e2e/run_e2e.ts` and `TEST_READY.md` for Milestone 5.4 (Tier 4 E2E Test Pass - Real-World Application Scenarios).

## Scope & Constraints
- **Role**: Forensic integrity auditor (`teamwork_preview_auditor`).
- **Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_auditor_m5_4_tier4_3`
- **PROJECT.md Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- **SCOPE.md Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_4_tier4/SCOPE.md`
- **Worker 3 Handoff**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_4_tier4_3/handoff.md`
- **Output**: When complete, write `handoff.md` in your working directory and send a completion message to your parent (`7e0044de-32e4-4663-b0f1-61f2fcd039b1`).

---

## Integrity Forensics Instructions
You MUST run every check from the Integrity Forensics section, matched to the project type:
1. **Hardcoded output detection**: Verify that no test results, expected outputs, or verification strings are hardcoded in source code or test files.
2. **Facade detection**: Verify that no dummy or facade implementations were created to circumvent the intended task.
3. **Pre-populated artifact detection**: Verify via `git status` that no verification outputs, logs, or attestation artifacts were pre-populated or fabricated.
4. **Build and run**: Execute the master verification command from `TEST_READY.md`:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
5. **Output verification**: Verify that the E2E test suite completes successfully with exit code 0. Verify that `etimes > 7200`, `etimes > 1800`, and `try/catch` around `init_db.ts` in `robustSupabaseRestart()` are genuinely implemented in `e2e/run_e2e.ts`. Verify `TEST_READY.md` uses `exec node node_modules/.bin/tsx e2e/run_e2e.ts`.
6. **Dependency audit**: Verify that no core logic is delegated to prohibited third-party packages.

Document your findings, evidence, and verdict (CLEAN / INTEGRITY VIOLATION) in `handoff.md`.
