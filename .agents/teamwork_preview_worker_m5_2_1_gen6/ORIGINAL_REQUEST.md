## 2026-07-07T08:21:40Z

You are a Worker (`teamwork_preview_worker` archetype). Your identity is `teamwork_preview_worker_m5_2_1_gen6` and your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_2_1_gen6`.

## Loadable Domain Skill
Load the Jetski skill at: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`
This skill provides best practices for modifying existing code, performing surgical changes, and ensuring correctness.

## Mandatory Integrity Warning
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Objective & Scope
Your scope is Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases). You are replacing Worker Gen 5 (`ccdcf022-f20e-4ce3-8b60-4fdc669a881e`), which hung while executing the full verification chain in `task-39`. You must verify the changes made by Worker Gen 5 in `__tests__/db/recurring_db.test.ts` and `e2e/run_e2e.ts`, ensure they perfectly match `handoff_synthesis.md`, perform a clean teardown of any stuck Supabase/Docker containers from Worker Gen 5's run, and execute the full verification chain.

## Input Information
Read the following files to understand the project state and exact implementation requirements:
- `handoff_synthesis.md`: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/handoff_synthesis.md`
- Worker Gen 5 progress: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_2_1_gen5/progress.md`
- `PROJECT.md`: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- `SCOPE.md`: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/SCOPE.md`
- `TEST_READY.md`: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`

## Implementation & Verification Tasks
1. **Inspect `__tests__/db/recurring_db.test.ts` & `e2e/run_e2e.ts`**: Check the changes implemented by Worker Gen 5. Ensure `recurring_db.test.ts` contains the genuine connection and dynamic startup logic without any `client.query` mocking or hardcoded test rows. Ensure `e2e/run_e2e.ts` contains the idempotent `setup()` and bulletproof `teardownSupabase()` without any nested retry loops (`for (let j = 0; j < 5; j++)`) or `--ignore-health-check` flags, and `checkRetries` is 120.
2. **Perform Clean Teardown**: Before running tests, execute a clean teardown to purge any stuck containers or daemons left behind by Worker Gen 5:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx supabase stop --no-backup 2>/dev/null || true
   sleep 5
   pkill -9 -f "supabase-go" 2>/dev/null || true
   pkill -9 -f "npx supabase" 2>/dev/null || true
   pkill -9 -f "bin/supabase" 2>/dev/null || true
   pkill -9 -f supabase 2>/dev/null || true
   docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true
   docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true
   fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 3000/tcp 2>/dev/null || true
   rm -rf supabase/.temp /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true
   sleep 5
   ```
3. **Execute Full Verification Chain**: Run the exact test runner chain defined in `TEST_READY.md`:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
   ```
   Verify that all tests pass genuinely with exit code 0 and no container conflicts occur.

## Output Requirements
Produce a structured handoff report at `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_2_1_gen6/handoff.md` following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method). Include the exact commands run and the passing test output. Use `send_message` to notify your parent (`e0762fd9-e344-42b8-94b2-333966260dfc` / `sub_orch_m5_1_2`) when complete.
