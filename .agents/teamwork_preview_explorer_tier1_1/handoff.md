# Handoff Report: E2E Test Infrastructure & Tier 1 Exploration (`TEST_INFRA.md`)

## 1. Observation
- **User & Project Requirements**:
  - `ORIGINAL_REQUEST.md` (lines 5-30) mandates implementing a "robust Financial Retirement Planner feature into `expense-dashboard` modeled after Foresight Planner".
  - Key requirements include:
    - **R1**: Core Domain Types & Pure Business Logic Engines (Zod schemas `Household`, `Account`, `Spending`, `Pension`, `LifeEvent`, `SimulationConfig`, `SimulationResultsSummary`, `QuickCheckParams` in `src/lib/planner/types.ts`; pure TS engines `taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`).
    - **R2**: Web Worker Simulation Engine & Market Data (125 years empirical market returns 1900–2025 in `src/content/historicalMarketData.ts` as `Float64Array`; Web Worker `simulation.worker.ts` running 1,000 Monte Carlo block bootstrap paths in parallel).
    - **R3**: Dual Entry UI & Premium Range Selector (`QuickCheckWidget.tsx` on `src/app/page.tsx`, URL search params handoff `/auth?redirect=/plans/new...`, Zustand store `useRetirementStore.tsx`, authenticated `/plans` dashboard, 7-tab Detailed Plan Builder, Premium Tier Historical Range Selector 20yr/50yr/125yr with An-yen frosted glass Premium Lock card).
    - **R4**: Local Implementation, BOLA Defenses & Zero Git Push (Supabase RLS migrations `20260624000000_retirement_planner.sql`, Server Actions `retirementActions.ts` with BOLA defense and Premium entitlement checks `profiles.tier === 'premium'`).
- **Testing Track Scope**:
  - `.agents/sub_orch_e2e_testing_track_1/SCOPE.md` (lines 1-15) defines the E2E Testing Track architecture as an "opaque-box E2E testing track derived from `ORIGINAL_REQUEST.md`" using Playwright (`npx tsx e2e/run_e2e.ts`).
  - Milestones defined in `SCOPE.md`:
    - Tier 1: `TEST_INFRA.md`, `e2e/planner_tier1_feature.spec.ts`
    - Tier 2: `e2e/planner_tier2_boundary.spec.ts`
    - Tier 3: `e2e/planner_tier3_pairwise.spec.ts`
    - Tier 4: `e2e/planner_tier4_workload.spec.ts`, publish `TEST_READY.md`
- **Existing E2E Test Environment**:
  - `e2e/run_e2e.ts` (lines 1-65) is the primary test execution script. It backs up `.env.local`, copies `.env.test` to `.env.local`, executes `npx playwright test --workers=1`, and restores `.env.local` upon completion.
  - `playwright.config.ts` configures the test runner to target `./e2e` with a `webServer` spinning up `npm run build && npm run start` at `http://localhost:3000`.
- **E2E Test Infra Template**:
  - `google3/third_party/jetski/cortex/customizations/builtin/teamwork/orchestrator_pure_prompt.go` (lines 889-920) specifies the exact canonical template and headings for `TEST_INFRA.md`: `# E2E Test Infra: <project_name>`, `## Test Philosophy`, `## Feature Inventory`, `## Test Architecture`, `## Real-World Application Scenarios (Tier 4)`, and `## Coverage Thresholds`.

## 2. Logic Chain
1. **Deriving the Feature Inventory**:
   - To provide complete test coverage matching `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `SCOPE.md`, the E2E test infrastructure must explicitly itemize the 7 core feature dimensions: Dual Entry Quick Check Widget & URL Hydration (F1), Authenticated Dashboard & 7-Tab Detailed Plan Builder (F2), Premium Tier Historical Range Selector & Premium Lock (F3), 1,000-Path Monte Carlo Web Worker Simulation Execution (F4), Server Actions BOLA Defenses & RLS Enforcement (F5), Core Domain Business Logic Engines & Zod Validation (F6), and Automated Accessibility & WCAG 2.1 AA/AAA Compliance (F7).
2. **Aligning Test Architecture with Project Reality**:
   - `e2e/run_e2e.ts` acts as the authoritative test wrapper. The `TEST_INFRA.md` must record `npx tsx e2e/run_e2e.ts` as the invocation method, document its pass/fail exit code semantics (`0` on success, `1` on failure), and delineate the four progressive tier files (`planner_tier1_feature.spec.ts` through `planner_tier4_workload.spec.ts`) in the directory layout.
3. **Structuring Realistic Tier 4 Application Scenarios**:
   - To satisfy Tier 4 workload testing requirements, 5 realistic end-to-end user journeys are constructed to exercise multiple features concurrently, ensuring robust integration testing across public/authenticated boundaries, free/premium tier entitlement checks, adversarial BOLA attempts, complex drawdown math, and complete accessibility audits.
4. **Strict Template Compliance**:
   - By structuring the proposed `TEST_INFRA.md` exactly to the markdown structure in `orchestrator_pure_prompt.go`, we guarantee full canonical compatibility with downstream E2E Testing Track subagents and orchestrators.

## 3. Caveats
- **Read-Only Scope**: This agent operates strictly in an exploratory read-only capacity as per `task.md`. No modifications were made directly to `TEST_INFRA.md` or any existing test scripts in `e2e/`.
- **Pending Implementation**: The underlying application features (`QuickCheckWidget.tsx`, `simulation.worker.ts`, `retirementActions.ts`) are currently being implemented by other specialized agents across Milestones 1-4. The E2E test infrastructure is designed opaque-box to test against the required behavioral contracts regardless of underlying implementation details.

## 4. Conclusion
The E2E test infrastructure for the Financial Retirement Planner has been fully explored and designed. Below is the exact proposed markdown content for `TEST_INFRA.md`, ready for the E2E Testing Track Orchestrator / Implementer to write to the project root.

```markdown
# E2E Test Infra: Financial Retirement Planner

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Dual Entry Quick Check Widget & URL Hydration | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 2 | Authenticated Dashboard & 7-Tab Detailed Plan Builder | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 3 | Premium Tier Historical Range Selector & Premium Lock | ORIGINAL_REQUEST §R3, §R4 | 5 | 5 | ✓ |
| 4 | 1,000-Path Monte Carlo Web Worker Simulation Execution | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 5 | Server Actions BOLA Defenses & RLS Enforcement | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 6 | Core Domain Business Logic Engines & Zod Validation | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 7 | Automated Accessibility & WCAG 2.1 AA/AAA Compliance | ORIGINAL_REQUEST §Acceptance Criteria | 5 | 5 | ✓ |

## Test Architecture
- **Test runner**:
  - **Location**: `e2e/run_e2e.ts` (wrapper script) and `playwright.config.ts`.
  - **Invocation**: `npx tsx e2e/run_e2e.ts`
  - **Pass/Fail Semantics**: Process exits with code `0` on 100% success across all assertions and accessibility checks. Process exits with code `1` if any test case, setup step, or accessibility audit fails.
- **Test case format**:
  - **Input format**: Opaque-box Playwright page interactions (navigating to URLs, filling form inputs, clicking buttons, passing URL search params).
  - **Expected output format**: Playwright locator assertions (`expect(locator).toBeVisible()`, `expect(page).toHaveURL()`), state reflection in UI, and `@axe-core/playwright` audit results showing zero WCAG 2.1 AA/AAA violations.
- **Directory layout**:
  - `e2e/run_e2e.ts` — E2E test runner wrapper script with environment setup/cleanup.
  - `e2e/planner_tier1_feature.spec.ts` — Tier 1 happy path feature verification.
  - `e2e/planner_tier2_boundary.spec.ts` — Tier 2 boundary value analysis and corner cases.
  - `e2e/planner_tier3_pairwise.spec.ts` — Tier 3 cross-feature combinatorial interactions.
  - `e2e/planner_tier4_workload.spec.ts` — Tier 4 complex real-world application scenarios.
  - `playwright.config.ts` — Playwright test runner configuration.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full Lifecycle Dual Entry Handoff for Free Tier User | F1, F2, F3, F6, F7 | Medium |
| 2 | Premium Tier Upgrade & 125-Year Historical Simulation | F2, F3, F4, F5, F7 | High |
| 3 | Adversarial BOLA Attempt on Premium Plan by Free User | F2, F3, F5, F7 | Medium |
| 4 | High-Net-Worth Multi-Account Drawdown & Tax Optimization | F2, F4, F6, F7 | High |
| 5 | Comprehensive Quick Check to 7-Tab Plan Builder with A11y Audit | F1, F2, F4, F6, F7 | High |

## Coverage Thresholds
- Tier 1: ≥5 per feature
- Tier 2: ≥5 per feature (where boundaries exist)
- Tier 3: pairwise coverage of major feature interactions
- Tier 4: ≥5 realistic application scenarios
```

## 5. Verification Method
- **File Inspection**: Verify that `TEST_INFRA.md` is successfully created at the project root (`/usr/local/google/home/duynguyenn/expense-dashboard/TEST_INFRA.md`) containing the exact markdown structure above.
- **Test Execution**: Once the test files (`e2e/planner_tier1_feature.spec.ts`, etc.) are created by the implementer, run the authoritative test command:
  ```bash
  npx tsx e2e/run_e2e.ts
  ```
- **Invalidation Conditions**: Any failure in `npx tsx e2e/run_e2e.ts` (exit code `1`), missing test files in `e2e/`, or structural deviation from the canonical `TEST_INFRA.md` headings invalidates the verification.
