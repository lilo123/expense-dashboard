# Task Description: Worker gen8 (`teamwork_preview_worker_m5_1_3_gen8`)

## Objective
Execute the full E2E verification test runner to verify that the accessibility fixes (`color-contrast` and `opacity-60`), `config.toml` corrections, and process elimination trap defenses confirmed by the Explorers in Iteration 8 achieve 100% passing tests with exit code 0 and a flawless CLEAN audit verdict.

## Scope Boundaries
- STRICT LOCAL-ONLY GUARDRAIL: Work locally on this project only. Do NOT push anything to GitHub or execute any `git push` commands.

## Mandatory Integrity Warning
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Input Information
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_3/SCOPE.md`
- Explorer Handoff Reports:
  - `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_3_1_gen8/handoff.md`
  - `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_3_2_gen8/handoff.md`
  - `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_3_3_gen8/handoff.md`

## Verification Instructions
1. Inspect `supabase/config.toml`, `package.json`, `e2e/adv_supabase_dns_nxdomain.ts`, `e2e/run_e2e.ts`, `__tests__/db/recurring_db.test.ts`, `src/components/QuickCheckWidget.tsx`, and all calculator views (`CalculatorParams.tsx`, `SummaryView.tsx`, `PortfolioValueView.tsx`, `AvailableSpendingView.tsx`, `SimulationsListView.tsx`, `DataAssumptionsView.tsx`) to ensure all fixes are in place.
2. Run the exact E2E test runner command specified in `SCOPE.md` (with prior cleanup of stale locks and lingering processes):
   `rm -f /tmp/run_e2e.lock /tmp/run_e2e.queue && export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
3. Ensure all tests pass with exit code 0 and zero TypeScript errors.

## Output Requirements
- Maintain `progress.md` in your working directory with `Last visited: [timestamp]` header.
- Produce a structured `handoff.md` report in your working directory containing: Observation (evidence chains with file paths), Logic Chain (step-by-step technical reasoning), Caveats (unknowns/assumptions), Conclusion (structured data/summary of changes), and Verification Method (exact commands run and passing results).

## Completion Criteria
- You are done when `handoff.md` is fully populated with verified passing test results and you have sent a completion message to your parent (`sub_orch_m5_1_3`) via `send_message`.
