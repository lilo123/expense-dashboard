# Task: M5.2 Tier 2 E2E Test Pass (Worker Gen 11)

## Objectives
1. Take over from Worker Gen 10 to successfully pass 100% of Tier 2 E2E tests (Boundary & Corner Cases) defined in `TEST_READY.md`.
2. Ensure `supabase/config.toml` and `e2e/run_e2e.ts` perfectly match the precise replacement instructions in `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/handoff_synthesis.md`.
3. Use `replace_file_content` to add `health_timeout = "10m"` under `[db]` in `supabase/config.toml`.
4. Use `replace_file_content` on `e2e/run_e2e.ts` to implement the fair FIFO queue mutex lock (`/tmp/run_e2e.queue`), extend the timeout to 2 hours (`1440` attempts), implement dynamic `protectedPids` tree filtering, and add `ps auxww` / `ps -ww` to prevent premature process termination.
5. Execute the full verification chain command-by-command to ensure 100% of tests pass genuinely with exit code 0 and `npm run lint` completes with 0 errors.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Verification Chain
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm run lint && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
```

## Deliverables
- Maintain `plan.md` and `progress.md` in `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/worker_m5_2_1_gen11`.
- Provide `handoff.md` upon successful verification and send a completion message to the sub-orchestrator via `send_message`.
