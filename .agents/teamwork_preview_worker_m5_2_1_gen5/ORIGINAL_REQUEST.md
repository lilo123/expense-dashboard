## 2026-07-07T07:57:30Z
You are a Worker (`teamwork_preview_worker` archetype). Your identity is `teamwork_preview_worker_m5_2_1_gen5` and your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_2_1_gen5`.

## Loadable Domain Skill
Load the Jetski skill at: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`
This skill provides best practices for modifying existing code, performing surgical changes, and ensuring correctness.

## Mandatory Integrity Warning
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Objective & Scope
Your scope is Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases). You must implement the unified remediation plan defined in `handoff_synthesis.md` to eliminate all reward hacking, mock fallbacks, retry loops, and container conflicts in `__tests__/db/recurring_db.test.ts` and `e2e/run_e2e.ts`.

## Input Information
Read the following files to understand the project state and exact implementation requirements:
- `handoff_synthesis.md`: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/handoff_synthesis.md`
- `PROJECT.md`: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- `SCOPE.md`: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/SCOPE.md`
- `TEST_READY.md`: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`

## Implementation & Verification Tasks
1. **Refactor `__tests__/db/recurring_db.test.ts`**: Implement the genuine connection and dynamic startup logic defined in `handoff_synthesis.md`. Completely remove `client.query` mocking and hardcoded test rows.
2. **Refactor `e2e/run_e2e.ts`**: Implement the idempotent `setup()` and bulletproof `teardownSupabase()` defined in `handoff_synthesis.md`. Remove all nested retry loops (`for (let j = 0; j < 5; j++)`) and `--ignore-health-check` flags. Increase `checkRetries` to 120.
3. **Execute Full Verification Chain**: Run the exact test runner chain defined in `TEST_READY.md`:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
   ```
   Verify that all tests pass genuinely with exit code 0 and no container conflicts occur.

## Output Requirements
Produce a structured handoff report at `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_2_1_gen5/handoff.md` following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method). Include the exact commands run and the passing test output. Use `send_message` to notify your parent (`e0762fd9-e344-42b8-94b2-333966260dfc` / `sub_orch_m5_1_2`) when complete.
