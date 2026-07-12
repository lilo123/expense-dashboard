# Handoff Report: Explorer 1 (Milestone 4: Tier 4 Real-World Workload Scenarios)

## 1. Observation
- **Task Description (`task_description.md`)**: Instructs Explorer 1 to analyze the codebase and existing E2E test files to design the implementation strategy for `e2e/planner_tier4_workload.spec.ts`, specifically focusing on **Scenario 1 (Full Lifecycle Dual Entry Handoff for Free Tier User: F1, F2, F3, F6, F7)** and **Scenario 2 (Premium Tier Upgrade & 125-Year Historical Simulation: F2, F3, F4, F5, F7)**.
- **E2E Test Infrastructure (`TEST_INFRA.md`)**: Establishes an opaque-box, requirement-driven testing philosophy. It defines the 7 Core Features (F1 to F7), specifies the test runner invocation (`npx tsx e2e/run_e2e.ts`), and defines the pass/fail semantics (process exits with code `0` on 100% success across all assertions and accessibility checks).
- **Existing E2E Test Suite (`e2e/planner_tier1_feature.spec.ts`, `e2e/planner_tier2_boundary.spec.ts`, `e2e/planner_tier3_pairwise.spec.ts`, `e2e/adv_planner_tier2_boundary.spec.ts`)**: Utilizes a highly standardized set of Playwright locators (e.g., `#quick-check-widget`, `#hydrated-marker`, `#tab-simulation`, `#premium-lock-card`, `#run-simulation-btn`, `#simulation-results-summary`), a shared `loginAs(page, email, password)` helper function, `@axe-core/playwright` for accessibility audits, and brand/empathy assertions (verifying zero negative financial jargon like 'Debt', 'Penalty', 'Failing', 'Over-limit', 'Deficit', 'Game Over').
- **Playwright Config (`playwright.config.ts`)**: Configures a 15-second timeout per `expect()` assertion (`expect: { timeout: 15000 }`), local web server booting on port 3000, and fully parallel execution.
- **Database Seed (`e2e/seed.ts`)**: Seeds `STANDARD_USER` (`test-user@example.com`, `tier: 'standard'`) and `PREMIUM_USER` (`premium-user@example.com`, `tier: 'premium'`), alongside a pre-seeded premium plan (`id: 'premium-user-genuine-plan-id'`).

## 2. Logic Chain
1. **Consistency Requirement**: To maintain full test suite integrity and pass/fail semantics, `e2e/planner_tier4_workload.spec.ts` must use the exact same Playwright locators, `loginAs` helper, and `@axe-core/playwright` audit structure established in Tiers 1-3.
2. **Scenario 1 Implementation Strategy (F1, F2, F3, F6, F7)**:
   - **F1 & F6**: The test must begin on the public landing page (`/`), verify the `#quick-check-widget`, input realistic standard values (`#quick-current-age`, `#quick-current-savings`, etc.), click `#save-unlock-btn`, and verify redirection to `(/login|/auth)\?redirect=...` with encoded parameters.
   - **F1 & F2**: After authenticating as `STANDARD_USER`, the test must wait for `#hydrated-marker` on `/plans/new` and assert that the Zustand store hydrated correctly across the Household and Accounts tabs.
   - **F3**: Navigating to `#tab-simulation` must verify the presence of `#premium-lock-card` (asserting frosted glass classes `bg-white/40`, `backdrop-blur-md`), ensure `#range-50yr` and `#range-125yr` are disabled, and run a 20-year simulation (`#range-20yr`).
   - **F7**: The test must execute `AxeBuilder` accessibility audits at each major state change and assert that no forbidden negative financial jargon exists in the DOM.
3. **Scenario 2 Implementation Strategy (F2, F3, F4, F5, F7)**:
   - **F2 & F3**: The test begins as `STANDARD_USER` on `/plans/new`. On `#tab-simulation`, it initially observes `#premium-lock-card`. To realistically simulate an in-session Premium Tier upgrade, the test intercepts `**/supabase/**/profiles*` to return `tier: 'premium'` (simulating an upgrade webhook/action) and reloads/updates state to verify `#premium-lock-card` disappears and `#range-125yr` unlocks dynamically.
   - **F4**: The user configures `#range-125yr`, sets `#input-num-paths` to `1000`, clicks `#run-simulation-btn`, and verifies `#simulation-results-summary` appears within 15 seconds. It asserts screen reader parity by checking `div.sr-only table` for percentile headers.
   - **F5**: After saving the premium plan (`#save-plan-btn`), the test spawns a fresh browser context as a different standard user (`another-standard-user@example.com`) to attempt unauthorized direct URL access (`/plans/[id]`) and direct Server Action fetch injection (`/api/actions/savePlan`), verifying strict BOLA defense rejection ('You do not have permission to view/modify this plan').

## 3. Caveats
- **Read-Only Scope**: In accordance with the Explorer role constraints, no E2E test files or application source code were modified directly. The concrete implementation strategies and code snippets are prepared for the subsequent Worker/Implementer.
- **Simulated Upgrade Webhook**: In Scenario 2, the Premium Tier upgrade is simulated via Playwright network interception (`page.route('**/supabase/**/profiles*')`). This isolates the E2E test from external payment gateways (e.g., Stripe) while verifying the frontend's dynamic unlocking capabilities perfectly.

## 4. Conclusion
The implementation strategy for `e2e/planner_tier4_workload.spec.ts` (Scenarios 1 & 2) is fully designed, documented, and ready for drop-in implementation by the Worker. The comprehensive analysis, locator tables, and copy-pasteable Playwright TypeScript test blocks have been published to `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_tier4_workload_1/analysis.md`.

## 5. Verification Method
Upon implementation by the Worker, the test suite can be independently verified using the following commands and checks:
1. **Execute E2E Test Runner**:
   ```bash
   npx tsx e2e/run_e2e.ts
   ```
   *Pass Condition*: Process exits with code `0`, indicating 100% success across all E2E test files, assertions, and accessibility audits.
2. **Execute Targeted Playwright Test**:
   ```bash
   npx playwright test e2e/planner_tier4_workload.spec.ts
   ```
   *Pass Condition*: Both Scenario 1 and Scenario 2 execute successfully with zero failed expectations.
3. **Inspect Implementation File**: Verify `e2e/planner_tier4_workload.spec.ts` contains the exact code structures, locators, and accessibility checks defined in `analysis.md`.
