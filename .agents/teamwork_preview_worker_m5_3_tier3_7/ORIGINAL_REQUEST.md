## 2026-07-07T14:29:31Z

You are a teamwork_preview_worker (Versatile worker with loadable domain expertise).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_3_tier3_7`.
Your identity is Tier 3 E2E Worker 7.

Load the Jetski skill at:
  /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

This skill provides methodology for modifying existing code, performing surgical changes, and ensuring correctness.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your task:
1. Read `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`, `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_3_tier3/SCOPE.md`, `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`, `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/ORIGINAL_REQUEST.md`, `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_3_tier3_19/handoff.md`, `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_3_tier3_20/handoff.md`, and `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_3_tier3_21/handoff.md`.
2. Implement the concrete fix strategy formulated by the Explorers to address all identified failures, contract violations, daemon corruption, concurrent process elimination wars, and masked failure vulnerabilities in Iteration 6:
   - **`supabase/config.toml`**: Set `[realtime] enabled = true` to satisfy the `SCOPE.md` contract.
   - **`e2e/run_e2e.ts`**: Implement file-based mutex locking (`/tmp/run_e2e.lock`) or TTY-scoped cleanup to prevent concurrent test runners (`pts/3`, `pts/4`, `pts/5`, `task-20`) from killing each other in a process elimination war. Ensure `teardownSupabase()` cleanly resets the `supabase-go` daemon state (`Unknown: ChildProcess.exitCode`) while strictly adhering to `SCOPE.md` contracts (`docker rm -f` before `pkill`, `while docker ps -aq...` wait loop, `sleep 20`, `timeout: 10000`, `docker network rm`, `sleep 2` buffer before `fuser -k`). Ensure explicit `process.exit(1)` in `run()`'s `catch` block.
   - **`TEST_READY.md` & Test Invocation Strings**: Update `TEST_READY.md` and any test invocation strings to invoke `node node_modules/.bin/tsx e2e/run_e2e.ts` directly instead of `exec npx tsx e2e/run_e2e.ts` to prevent `npx` from swallowing SIGKILL/SIGTERM exit codes and masking failures.
   - **`next.config.js`**: Ensure `outputFileTracing: false` remains correctly placed within the `experimental` block to prevent Next.js server OOM crashes.
3. Run `blaze build` / `blaze test` or the appropriate verification commands (e.g., `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec node node_modules/.bin/tsx e2e/run_e2e.ts`) to verify that all tests pass successfully with exit code 0.
4. Verify that the output adheres to the code layout in `PROJECT.md` (`.agents/` contains only metadata).
5. Write your structured handoff report (`handoff.md`) in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_3_tier3_7`) following the Handoff Protocol.
6. Send a completion message to your parent (the Sub-orchestrator) when done.
