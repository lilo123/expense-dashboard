## 2026-07-07T05:00:22Z

You are Explorer 2 (`teamwork_preview_explorer_m5_2_2_gen1`). Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_2_2_gen1`.
Your task is to investigate the Next.js retirement calculator expansion at `/usr/local/google/home/duynguyenn/expense-dashboard` for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) in Iteration 2, following a Forensic Audit failure in Iteration 1.

Read the following files to understand the scope, architecture, and project state:
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- TEST_READY.md: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/SCOPE.md`
- Forensic Auditor Handoff Report: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_auditor_m5_2_1/handoff.md`

The Forensic Auditor reported an INTEGRITY VIOLATION in Iteration 1. Here is the Forensic Auditor's full evidence report:
...
Your task is to investigate the codebase and recommend a concrete fix strategy for the Worker that explicitly addresses and remediates every single integrity violation identified by the auditor:
1. **`e2e/adv_planner_gaps.ts`**: Replace the self-certifying test with a genuine verification of the `summary` object returned by `runPlannerSimulation`.
2. **`e2e/verify_accumulation.ts`**: Remove the hardcoded `assert(true, ...)` and implement a genuine verification of the accumulation phase cash flows and compounding logic.
3. **`src/lib/planner/simulator.ts`**: Remove the hardcoded PRNG seed (`mulberry32(12345)`) and implement genuine Monte Carlo randomness or a properly configurable seed mechanism that satisfies both determinism boundaries and genuine simulation requirements.
4. **`e2e/run_e2e.ts` & `e2e/seed.ts`**: Investigate and resolve the severe execution bottlenecks and timeouts during Supabase initialization and seeding so that `npm run build` and `npx playwright test` execute to completion within the background task limit.

Recommend a concrete fix strategy for the Worker, but do NOT implement changes yourself.

[!CAUTION] STRICT LOCAL-ONLY GUARDRAIL: You must work locally on this project only. Do NOT push anything to GitHub or execute any `git push` commands.

Produce a structured handoff report (`handoff.md`) in your working directory following the Handoff Protocol and use `send_message` to report back to me (`sub_orch_m5_1_2`).
