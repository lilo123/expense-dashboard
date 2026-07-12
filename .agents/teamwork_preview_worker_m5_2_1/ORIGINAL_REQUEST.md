## 2026-07-07T04:27:35Z
You are the Worker (`teamwork_preview_worker_m5_2_1`). Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_2_1`.
Your task is to implement the synthesized fix strategy for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) for the Next.js retirement calculator expansion at `/usr/local/google/home/duynguyenn/expense-dashboard`.

Load the Jetski skill at:
  /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

Read the following files to understand the project state, scope, and synthesized findings:
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- TEST_READY.md: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/SCOPE.md`
- Handoff Synthesis: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/handoff_synthesis.md`

You must implement the following concrete fix strategy:
1. **Patch `e2e/run_e2e.ts` (Robust PID Filtering)**: Modify lines 302-318 in `e2e/run_e2e.ts` to iteratively trace `ps -o ppid=` up to PID 1 (or preserve higher-level ancestor PIDs), ensuring `run_e2e.ts` never kills its own process tree.
2. **Create `e2e/verify_global_market_data.ts`**: Implement the 5 Tier 2 boundary & corner case tests for F1 (Global Market Data Toggle) covering Zod validation & defaults, start year boundaries (`1970` vs `1871`), out-of-bounds fallbacks, MSCI/Shiller proxy merging integrity, and simulation execution under global mode.
3. **Fix `e2e/verify_accumulation.ts`**: Update `duration: 50` to `duration: 30` so that `totalDuration` correctly equals `50` (`20` accumulation + `30` retirement). Ensure the 5 Tier 2 tests for F2 are fully asserted.
4. **Enhance `e2e/verify_monte_carlo.ts`**: Ensure the 5 Tier 2 tests for F3 (Zod defaults, PRNG determinism, exact 1,000 run count, 125-year extreme timeline stress, and zero-copy columnar buffer integrity) are fully asserted.
5. **Enforce PRNG Determinism in `src/lib/planner/simulator.ts`**: Replace `Math.random()` in `src/lib/planner/simulator.ts` with a deterministic Mulberry32 PRNG (seeded with `12345`, matching `src/workers/simulation.worker.ts`) to ensure `runPlannerSimulation` is 100% deterministic.
6. **Clean up `next.config.js`**: Remove the unrecognized `outputFileTracing` key to eliminate build warnings.
7. **Update `TEST_READY.md` and `sub_orch_m5_1_2/SCOPE.md`**: Update the master test runner command string in `TEST_READY.md` and `sub_orch_m5_1_2/SCOPE.md` to:
   `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts`
8. **Verify Execution**: Run `npm test` and the full master test runner command to verify 100% of Tier 2 tests pass with exit code 0.

[!CAUTION] STRICT LOCAL-ONLY GUARDRAIL: You must work locally on this project only. Do NOT push anything to GitHub or execute any `git push` commands.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Produce a structured handoff report (`handoff.md`) in your working directory following the Handoff Protocol and use `send_message` to report back to me (`sub_orch_m5_1_2`).

## 2026-07-07T04:29:39Z
**Context**: Implementing Tier 2 E2E fixes for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases)
**Content**: Explorer 1 (`teamwork_preview_explorer_m5_2_1`) has completed its deep dive into Playwright test timeouts (exit code 137) and uncovered three critical issues in the E2E test specs and seed script:
1. **`budget_month_picker.spec.ts` Button Locator Mismatch**: The test attempts `await page.click('button:has-text("Budget")')` to switch to `BudgetView`. In `src/components/DashboardTab.tsx`, the actual button text is `"Budget View"`. Targeting `"Budget"` is imprecise and fails to reliably toggle `isBudgetView`, preventing `#budget-month-select` from mounting and causing a 30s timeout. Update `await page.click('button:has-text("Budget")')` to `await page.click('button:has-text("Budget View")')`.
2. **Missing Email Fallback in `budget_month_picker.spec.ts` & `budget_planner_propagation.spec.ts`**: `e2e/settings.spec.ts` mutates `test-user@example.com` to `katherine-new@example.com`. Specs running after `settings.spec.ts` lack the `try/catch` login fallback to `katherine-new@example.com` (which `yearly_master_toggle.spec.ts` correctly implements), causing login to fail and time out. Update `e2e/budget_month_picker.spec.ts` and `e2e/budget_planner_propagation.spec.ts` to include the `try/catch` login fallback for `katherine-new@example.com` in `beforeEach`, matching the proven pattern in `e2e/yearly_master_toggle.spec.ts`.
3. **Missing Prior Year Seed Data in `e2e/seed.ts`**: `e2e/seed.ts` seeds a mock budget for December 2026 (`2026-12`). However, `e2e/budget_month_picker.spec.ts` Test 3 (`should inherit baselines seamlessly across annual calendar boundaries (Dec 2025 -> Jan 2026)`) navigates to `2026-01` expecting a prior budget in `2025-12` to inherit. Because only `2026-12` exists in DB, `priorMonths` evaluates to `[]`, `totalLimits` becomes `$0.00`, and `await expect(availableBgtCard).not.toContainText('Limits ($0.00)')` fails with a 30s timeout. In `e2e/seed.ts`, add a mock budget record for December 2025 (`2025-12`) alongside the existing `2026-12` record.

I have updated `handoff_synthesis.md` (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/handoff_synthesis.md`).
**Action**: Please implement these three additional fixes (`budget_month_picker.spec.ts`, `budget_planner_propagation.spec.ts`, `seed.ts`) alongside your existing tasks before running the final verification.
