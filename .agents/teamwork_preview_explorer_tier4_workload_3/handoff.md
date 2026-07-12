# Handoff Report: Tier 4 Scenario 5 & TEST_READY.md

## 1. Observation
- **Task & Objectives**: Observed in `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_tier4_workload_3/task_description.md` (lines 1-25) that Explorer 3 is assigned to analyze the codebase and existing E2E test files to design the implementation strategy for `e2e/planner_tier4_workload.spec.ts` (focusing specifically on **Scenario 5**: Comprehensive Quick Check to 7-Tab Plan Builder with A11y Audit) and design the exact contents of `TEST_READY.md`.
- **Project Infrastructure & Scope**:
  - `TEST_INFRA.md` (lines 34-42) defines Tier 4 Scenario 5 as: `| 5 | Comprehensive Quick Check to 7-Tab Plan Builder with A11y Audit | F1, F2, F4, F6, F7 | High |`.
  - `SCOPE.md` in `sub_orch_e2e_testing_track_1` (lines 8-15) shows Tiers 1, 2, and 3 are `DONE` and Tier 4 is `IN_PROGRESS` with the requirement to publish `TEST_READY.md` upon completion.
  - `PROJECT.md` (lines 11-18) establishes `TEST_READY.md` as a strict prerequisite for Milestone 5 (Final Milestone - E2E Test Verification & Adversarial Hardening).
- **Existing Test Suite Conventions**:
  - `e2e/planner_tier1_feature.spec.ts` (lines 1-99), `e2e/planner_tier2_boundary.spec.ts` (lines 1-630), and `e2e/planner_tier3_pairwise.spec.ts` (lines 1-767) establish highly consistent Playwright testing conventions:
    - Standardized test user constants (`STANDARD_USER`, `PREMIUM_USER`, `TEST_PASSWORD`) and the `loginAs(page, email, password)` helper.
    - Explicit DOM ID locator contracts for widgets (`#quick-check-widget`), hydration (`#hydrated-marker`), 7 tabs (`#tab-household`, `#tab-accounts`, `#tab-spending`, `#tab-pensions`, `#tab-events`, `#tab-taxes`, `#tab-simulation`), tab panels (`#panel-household`, etc.), form inputs (`#input-current-age`, `#input-account-balance`, `#select-spending-strategy`, `#range-125yr`, `#input-num-paths`, etc.), and action buttons (`#save-unlock-btn`, `#run-simulation-btn`, `#save-plan-btn`).
    - Standardized automated accessibility auditing via `@axe-core/playwright` (`const accessibilityScanResults = await new AxeBuilder({ page }).include('...').analyze(); expect(accessibilityScanResults.violations).toEqual([]);`).
    - Standardized Brand/Empathy assertions verifying zero occurrences of negative financial jargon (`'Debt'`, `'Penalty'`, `'Failing'`, `'Over-limit'`, `'Deficit'`, `'Game Over'`).
    - Standardized Screen Reader parity verification asserting `div.sr-only table` attachment and checking `textContent()` for `"10th Percentile"`, `"50th Percentile"`, and `"90th Percentile"`.
- **Database Seeding State**: Observed in `e2e/seed.ts` (lines 1-384) that the local Supabase environment initializes `test-user@example.com` (`standard` tier) and `premium-user@example.com` (`premium` tier), pre-seeding exchange rates, recurring expenses, historical expenses, and a genuine premium retirement plan (`premium-user-genuine-plan-id`).

## 2. Logic Chain
1. **Deriving Scenario 5 Strategy**:
   - Because Scenario 5 must exercise `F1, F2, F4, F6, F7` in a high-complexity real-world workload, the test case must span the complete user journey from unauthenticated landing to fully configured premium simulation.
   - **F1 (Quick Check & Hydration)** is verified by landing on `/`, performing an initial scoped A11y scan on `#quick-check-widget`, filling out realistic parameters (`38` age, `65` retirement, `750000` savings, `2500` contribution), clicking `#save-unlock-btn`, and logging in.
   - To fully exercise **F4 (1,000-Path Monte Carlo Web Worker Simulation)** without being blocked by the Premium Lock card, the user must authenticate as `PREMIUM_USER` (`premium-user@example.com`).
   - **F2 (7-Tab Builder)** and **F6 (Core Domain Engines & Zod)** are verified by awaiting `#hydrated-marker`, verifying hydrated inputs, and sequentially navigating through all 7 tabs (`Household`, `Accounts`, `Spending`, `Pensions`, `Events`, `Taxes`, `Simulation`), populating complex valid configurations (e.g. `vanguard_dynamic` strategy, `social_security` pension, US/CA taxes) and verifying no `.validation-error` appears.
   - **F4 (Simulation Execution)** is verified on the Simulation tab by selecting `#range-125yr`, setting `#input-num-paths` to `1000`, clicking `#run-simulation-btn`, and asserting `#simulation-results-summary` and `#wealth-fan-chart` are visible.
   - **F7 (Accessibility & Empathy)** is enforced by running scoped `@axe-core/playwright` scans on every active tab panel, verifying screen reader parity on `div.sr-only table`, saving the plan (`#save-plan-btn`), asserting success toast (`.toast-success`), verifying the plan card appears on `/plans`, and asserting zero negative financial jargon on the page body.
2. **Deriving TEST_READY.md Content**:
   - Since `TEST_READY.md` serves as the official prerequisite and readiness certification for Milestone 5, it must be an exhaustive, self-contained technical document.
   - It must detail the complete E2E test suite inventory (Tiers 1-4), map them to `ORIGINAL_REQUEST.md` requirements (R1-R4, Acceptance Criteria), document the pass/fail exit code semantics (`npx tsx e2e/run_e2e.ts`), specify the database seed state (`e2e/seed.ts`), and list the exact architectural DOM ID contracts and locators to ensure full alignment across all engineering tracks.

## 3. Caveats
- **Execution Environment**: As an Explorer agent operating in read-only investigation mode, the proposed Playwright code snippets and `TEST_READY.md` contents were designed and verified against existing test conventions and specs, but not directly executed. The Worker agent is responsible for creating/appending to `e2e/planner_tier4_workload.spec.ts` and writing `TEST_READY.md` to the project root.
- **Dynamic Timing**: The Web Worker simulation execution relies on Playwright's default/configured timeouts (`15000ms` in `playwright.config.ts`), which is sufficient for 1,000 paths on local development environments.

## 4. Conclusion
- **Scenario 5 Implementation**: The concrete Playwright implementation strategy for Scenario 5 is fully designed and documented in `analysis.md`, successfully linking F1, F2, F4, F6, and F7 into an elegant, comprehensive real-world workload test case using standardized locators and assertions.
- **TEST_READY.md Design**: The complete markdown text for `TEST_READY.md` has been designed in `analysis.md`, providing a rigorous executive summary, test inventory matrix, execution protocol, seeding overview, locator contract, and M5 readiness declaration.
- **Actionable Next Steps**: The Worker agent can directly extract the Playwright test snippet from `analysis.md` to implement Scenario 5 in `e2e/planner_tier4_workload.spec.ts`, and write the proposed `TEST_READY.md` text directly to the project root.

## 5. Verification Method
1. **Inspecting Analysis & Handoff**:
   - Verify that `analysis.md` and `handoff.md` exist in `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_tier4_workload_3`.
2. **Independent Test Execution (Post-Worker Implementation)**:
   - Once the Worker implements `e2e/planner_tier4_workload.spec.ts` and publishes `TEST_READY.md`, verify execution using the established test runner command:
     ```bash
     npx tsx e2e/run_e2e.ts
     ```
   - Expect process exit code `0` confirming 100% passing tests and zero accessibility violations across Tiers 1–4.
   - Inspect the project root to verify `TEST_READY.md` is published and matches the required structural contract.
