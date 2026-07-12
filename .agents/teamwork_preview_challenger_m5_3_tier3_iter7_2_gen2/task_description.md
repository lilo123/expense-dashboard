# Task Description: Tier 3 E2E Challenger 2 (Iteration 7, Gen 2)

Load the Jetski skill at:
  /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/solution_stress_testing/SKILL.md

## Objective & Scope
Empirically verify Worker 1 Iteration 7 Gen 2's implementation of the 3-part fix strategy for Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations) in `supabase/config.toml` and `e2e/run_e2e.ts`. Stress-test the solution to ensure that `killLingeringProcessesScoped` correctly excludes active test runners/servers (`run_e2e`, `verify_`, `stress_test_`, `adv_`, `playwright`, `next`), `npm run build` completes without OOM crashes (`--max-old-space-size=4096`), and `supabase start` executes cleanly without Viper decoding errors.

## Input Information
Read Worker 1 Iteration 7 Gen 2's handoff report at `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_3_tier3_iter7_1_gen2/handoff.md`.
Also read `PROJECT.md`, `SCOPE.md`, `TEST_READY.md`, `ORIGINAL_REQUEST.md`, `supabase/config.toml`, and `e2e/run_e2e.ts`.

## Verification Requirements
You MUST execute the master E2E test runner command defined in `TEST_READY.md`:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts
```
Verify that all tests pass successfully with exit code 0.
When complete, write `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_m5_3_tier3_iter7_2_gen2`) following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method) documenting your empirical verification and stress-testing results.
When done, send a completion message to your parent (`fbb8e945-2a98-4e23-89f2-f6529a71f015`).
