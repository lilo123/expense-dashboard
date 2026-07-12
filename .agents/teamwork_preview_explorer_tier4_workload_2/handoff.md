# Handoff Report: E2E Test Strategy for Tier 4 Workload Scenarios (Scenarios 3 & 4)

## 1. Observation
During our comprehensive read-only investigation of the `expense-dashboard` codebase and E2E test track, we directly observed the following architectural contracts, existing test implementations, and domain logic specifications:
- **E2E Seed Environment (`e2e/seed.ts:23-27, 308-372`)**: Directly sets up two primary users: `test-user@example.com` (Standard/Free tier, `password123`) and `premium-user@example.com` (Premium tier, `password123`). It also pre-seeds a genuine premium retirement plan with `id: 'premium-user-genuine-plan-id'` belonging exclusively to the premium user.
- **UI Elements & Hydration (`e2e/planner_tier1_feature.spec.ts`, `e2e/planner_tier2_boundary.spec.ts`)**: E2E tests maintain strict synchronization with Zustand store hydration by waiting for `#hydrated-marker` (`state: 'attached'`). The Detailed Plan Builder utilizes 7 domain tabs (`#tab-household`, `#tab-accounts`, `#tab-spending`, `#tab-pensions`, `#tab-events`, `#tab-taxes`, `#tab-simulation`) and corresponding panels (`#panel-household`, etc.).
- **Premium Lock Contract (`e2e/planner_tier1_feature.spec.ts:192-203`)**: Standard users viewing the `#tab-simulation` encounter the `#premium-lock-card` (frosted glass classes `bg-white/40 backdrop-blur-md border-white/20`) with disabled historical range selectors `#range-50yr` and `#range-125yr`.
- **Server Action BOLA Defenses (`e2e/planner_tier1_feature.spec.ts:322-334`, `e2e/planner_tier2_boundary.spec.ts:382-405`)**: Unauthorized direct URL navigation to another user's plan (e.g., `/plans/premium-user-genuine-plan-id`) redirects to `/plans` with a `.toast-error` stating `"You do not have permission to view this plan"`. Direct JS `fetch` payload injection to `/api/actions/savePlan` targeting an unauthorized plan ID returns `success: false` and `error` containing `"You do not have permission to modify this plan"`.
- **Screen Reader Parity (`e2e/planner_tier2_boundary.spec.ts:572-586`)**: Screen reader accessibility for the `#wealth-fan-chart` relies on an adjacent `div.sr-only table`, which must be inspected using `textContent()` (to avoid Playwright visibility failures on `sr-only` items) to verify `"10th Percentile"`, `"50th Percentile"`, and `"90th Percentile"`.
- **Brand Empathy Contract (`e2e/planner_tier1_feature.spec.ts:156-166`)**: Across all views and error states, the application strictly forbids negative financial jargon: `Debt`, `Penalty`, `Failing`, `Over-limit`, `Deficit`, `Game Over`.
- **Domain Engines (`src/lib/planner/types.ts`, `src/lib/planner/taxEngine.ts`)**: `AccountSchema` requires `name`, `type`, `balance`, `costBasis`, `owner`. `SpendingSchema` supports `yale_endowment` (requires `yaleWeight`). `SimulationConfigSchema` requires `drawdownStrategy` (`taxable_first`, `proportional`, `tax_deferred_first`), `historicalRange`, `numPaths`, `retirementHorizon`. `taxEngine.ts` calculates progressive tax and capital gains stacking based on `taxJurisdiction` (`US`, `CA`) and `stateProvince`.

## 2. Logic Chain
1. **Architectural & Test Runner Consistency**: To ensure that `e2e/planner_tier4_workload.spec.ts` executes successfully under `npx tsx e2e/run_e2e.ts`, the Worker must adhere exactly to the established helper patterns (`loginAs`), pre-seeded credentials, and DOM locators from Tiers 1-3.
2. **Designing Scenario 3 (Adversarial BOLA Attempt on Premium Plan by Free User)**:
   - We must log in as `test-user@example.com` to establish the Free tier context.
   - Navigating to `/plans/new` and selecting `#tab-simulation` proves that the Free user is correctly restricted by `#premium-lock-card` and disabled range inputs.
   - Attempting direct navigation to `/plans/premium-user-genuine-plan-id` exercises the server-side RLS/BOLA read defense, verified by checking the automatic redirection to `/plans` and the appearance of `.toast-error`.
   - Executing a direct `fetch` POST to `/api/actions/savePlan` with `id: 'premium-user-genuine-plan-id'` and `historicalRange: 'all_125_years'` exercises the server-side BOLA write defense and Premium entitlement check, verified by asserting `success: false` in the JSON response.
   - Running `AxeBuilder` and checking `body` text guarantees compliance with the automated accessibility and brand empathy thresholds.
3. **Designing Scenario 4 (High-Net-Worth Multi-Account Drawdown & Tax Optimization)**:
   - We must log in as `premium-user@example.com` to establish the Premium high-net-worth context.
   - In `#tab-accounts`, we add three distinct accounts (`taxable`, `tax_deferred`, `tax_free`) with multi-million dollar balances and cost bases to accurately represent a complex high-net-worth portfolio, verifying that Zod validation passes without errors.
   - In `#tab-spending`, `#tab-pensions`, `#tab-taxes`, and `#tab-simulation`, we configure `yale_endowment` (`yaleWeight: 0.3`), `social_security` (`startAge: 70`), `US` (`stateProvince: CA`), and `taxable_first` drawdown strategy to fully exercise the underlying business logic engines (`taxEngine.ts`, `drawdownEngine.ts`, `spendingEngine.ts`, `pensionEngine.ts`).
   - Selecting `#range-125yr`, setting `#input-num-paths` to `1000`, and clicking `#run-simulation-btn` invokes the Web Worker simulation engine. Expecting `#simulation-results-summary` within 15 seconds verifies the zero-copy IPC performance and correct Monte Carlo calculation.
   - Verifying `div.sr-only table` via `textContent()`, running `AxeBuilder`, checking brand empathy, and saving the plan to verify dashboard persistence completes the high-net-worth real-world workload lifecycle.

## 3. Caveats
- **Implementation Status**: As confirmed by `PROJECT.md`, the actual UI components, Zustand store, Web Worker, and Server Actions for the retirement planner are currently PLANNED (Milestones 2-4 of the main project). The E2E test suite is being written in advance (Milestone 4 of the E2E Testing Track) to serve as the definitive verification contract for Milestone 5. Therefore, running `npx tsx e2e/run_e2e.ts` will not pass until the underlying application implementation is completed by the development specialists.
- **Scope Division**: This report focuses specifically on Scenarios 3 & 4 of Tier 4. The Worker must integrate these test cases alongside Scenarios 1, 2, and 5 (analyzed by Explorer 1 or peer specialists) within the shared `e2e/planner_tier4_workload.spec.ts` file structure.

## 4. Conclusion
We have established a rigorous, concrete implementation strategy for `e2e/planner_tier4_workload.spec.ts` covering Scenarios 3 & 4. The test case designs provide complete Playwright code blocks with precise DOM locators, seed data bindings, BOLA attack vectors, multi-account drawdown configurations, and accessibility assertions. The Worker can implement these test cases directly into `e2e/planner_tier4_workload.spec.ts` with absolute confidence in their architectural alignment.

## 5. Verification Method
Once the Worker implements `e2e/planner_tier4_workload.spec.ts` and the main project milestones (M1-M4) are completed, the implementation can be independently verified using the following commands:
1. **Verify Playwright E2E Suite Execution**:
   ```bash
   npx tsx e2e/run_e2e.ts
   ```
   *Expected Outcome*: Process exits with code `0`, confirming 100% success across all E2E test tiers (1-4) and zero WCAG 2.1 AA/AAA accessibility violations.
2. **Verify Standalone Tier 4 Workload Execution**:
   ```bash
   npx playwright test e2e/planner_tier4_workload.spec.ts
   ```
   *Expected Outcome*: All test cases pass successfully within the configured timeout thresholds.
3. **Verify Zero Git Push Compliance**:
   ```bash
   git status
   ```
   *Expected Outcome*: Verifies all changes exist strictly in the local working directory with zero commits pushed to remote git repositories.
