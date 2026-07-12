## 2026-07-07T05:34:28Z

You are the Worker (`teamwork_preview_worker_m5_2_1_gen2`). Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_2_1_gen2`.
Your task is to implement the synthesized fix strategy for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) in Iteration 3 for the Next.js retirement calculator expansion at `/usr/local/google/home/duynguyenn/expense-dashboard`.

Load the Jetski skill at:
  /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

Read the following files to understand the project state, scope, and synthesized findings:
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- TEST_READY.md: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/SCOPE.md`
- Handoff Synthesis: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/handoff_synthesis.md`

You must implement the following concrete fix strategy in `e2e/run_e2e.ts`:
1. **Remove `--ignore-health-check`**: Modify all 5 instances of `npx supabase start --debug --ignore-health-check` (lines 65, 178, 235, 253, 285) to `npx supabase start --debug`. This ensures Supabase CLI waits for the database container to be healthy before starting Supabase Realtime, preventing `nxdomain` crashes.
2. **Restore `sleep 20`**: Modify the teardown buffer at line 47 from `try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}` to `try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}`. This satisfies the `PROJECT.md` contract and prevents Docker daemon lock errors (`a prune operation is already running`).
3. **Restore `sleep 20` (Retry Loop)**: Modify the teardown buffer at line 63 from `try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}` to `try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}`.
4. **Verify Execution**: Run `npm test` and the full master test runner command defined in `TEST_READY.md` (`export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts`) to verify 100% of Tier 2 tests pass with exit code 0.

[!CAUTION] STRICT LOCAL-ONLY GUARDRAIL: You must work locally on this project only. Do NOT push anything to GitHub or execute any `git push` commands.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Produce a structured handoff report (`handoff.md`) in your working directory following the Handoff Protocol and use `send_message` to report back to me (`sub_orch_m5_1_2`).
