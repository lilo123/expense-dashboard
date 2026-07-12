# Handoff Report: Explorer Analysis & Implementation Strategy for M4.4 (Simulation Tab & Premium Range Selector)

## Observation
1. **`src/components/PlanBuilder.tsx` (Lines 241–335)**:
   - Contains the inline simulation view under the condition `{store.activeTab === 'simulation' && (...)`.
   - Uses `useRetirementStore()` to bind form inputs for `retirementHorizon` (line 251) and `numPaths` (line 260).
   - Renders a Premium Tier Historical Range Selector with keys `['all_125_years', 'post_ww2_80_years', 'stagflation_1970s']` (line 275).
   - Updates store state using `onClick={() => store.updateSimulationConfig({ historicalRange: range as any })}` (line 279), forcibly casting `range` to `any`.
   - Renders an An-yen frosted glass Premium Lock card when `userTier !== 'premium'` (lines 291–304) with an "Upgrade to Premium" button invoking `router.push('/pricing')`.
   - Renders a "Run Simulation" button invoking `store.runSimulation()` (line 308), displaying `store.error` (line 316) and `store.simulationResults` (line 321).
2. **`src/lib/planner/types.ts` (Lines 99–107)**:
   - `SimulationConfigSchema` strictly defines `historicalRange` as `z.enum(['most_recent_20_years', 'most_recent_50_years', 'all_125_years'])`.
3. **`src/content/historicalMarketData.ts` (Lines 3–25, 65–68)**:
   - `HISTORICAL_RANGES` object contains keys `most_recent_20_years`, `most_recent_50_years`, and `all_125_years`.
   - `getMarketDataCopy(range)` destructures `const { startIndex, endIndex } = HISTORICAL_RANGES[range]`. When passed `post_ww2_80_years` or `stagflation_1970s`, `HISTORICAL_RANGES[range]` is `undefined`, throwing a `TypeError: Cannot destructure property 'startIndex' of 'HISTORICAL_RANGES[range]' as it is undefined`.
4. **`src/lib/planner/simulation.worker.ts` (Lines 72–78)**:
   - Checks `config.historicalRange === 'most_recent_20_years'` and `config.historicalRange === 'most_recent_50_years'` to determine subarray slices.
5. **`__tests__/planner/planBuilder.spec.tsx` (Lines 85–108)**:
   - Demonstrates the testing pattern for `PlanBuilder`, including mocking `next/navigation` (`useRouter`), wrapping components in `<RetirementStoreProvider>`, and verifying `mockPush('/pricing')`.
6. **Task Description (`task_description.md`)**:
   - Requires extracting the simulation tab view into `src/components/SimulationTab.tsx` (`'use client'`), accepting `userTier?: string`, updating `PlanBuilder.tsx` to use `<SimulationTab userTier={userTier} />`, and achieving 100% passing test coverage in `__tests__/planner/simulationTab.spec.tsx`.

## Logic Chain
1. **Component Extraction (`src/components/SimulationTab.tsx`)**:
   - Extracting lines 241–335 from `PlanBuilder.tsx` into a dedicated file creates a cleaner, modular Client Component.
   - It must include `"use client";`, import `React`, `useRouter`, and `useRetirementStore`, and accept `{ userTier = 'free' }: { userTier?: string }`.
2. **Reconciling the Historical Range Mismatch**:
   - The current `PlanBuilder.tsx` implementation uses `range as any` with `post_ww2_80_years` and `stagflation_1970s`. This causes a runtime `TypeError` when `store.runSimulation()` executes because `getMarketDataCopy` expects `most_recent_50_years` and `most_recent_20_years`.
   - To achieve robust execution without modifying underlying engine files (`types.ts`, `historicalMarketData.ts`, `simulation.worker.ts`), the implementer has two viable approaches (surfacing tradeoffs per Rule 1):
     - **Approach A (Recommended for Simplicity & Schema Compliance)**: In `SimulationTab.tsx`, map the UI buttons directly to the valid Zod schema literal values: `['all_125_years', 'most_recent_50_years', 'most_recent_20_years']`. Display labels as `"All 125 Years"`, `"Post WW2 (80 Yrs)"`, and `"Stagflation 1970s"`. This eliminates the need for `as any` and ensures `runSimulation()` executes flawlessly.
     - **Approach B (Literal UI String Preservation)**: Keep `['all_125_years', 'post_ww2_80_years', 'stagflation_1970s']` in `SimulationTab.tsx`. To prevent runtime `TypeError` during simulation, either intercept the range before calling `store.runSimulation()` or extend `HISTORICAL_RANGES` in `historicalMarketData.ts`, `SimulationConfigSchema` in `types.ts`, and `simulation.worker.ts`. (Note: Approach A is significantly cleaner and adheres to Rule 2 "Simplicity First" and Rule 3 "Surgical Changes").
3. **Refactoring `PlanBuilder.tsx`**:
   - Import `SimulationTab` from `@/components/SimulationTab`.
   - Replace lines 241–335 with `<SimulationTab userTier={userTier} />`.
4. **Comprehensive Unit Testing (`__tests__/planner/simulationTab.spec.tsx`)**:
   - To achieve 100% coverage in Jest, the test suite must verify:
     1. Initial render of `SimulationTab` in isolation within `<RetirementStoreProvider>`.
     2. Form input interactions: changing `retirementHorizon` (number input) and `numPaths` (select dropdown) and verifying store updates.
     3. Premium Lock visibility when `userTier="free"`, verifying range selector buttons are disabled.
     4. Clicking "Upgrade to Premium" button and verifying `mockPush('/pricing')`.
     5. Unlocking range selector when `userTier="premium"`, clicking historical range buttons, and verifying store config updates.
     6. Clicking "Run Simulation" button and verifying simulation executes/displays results.

## Caveats
1. **Web Worker in Jest Environment**: During unit testing in Jest, `window.Worker` may be unavailable or mocked. `useRetirementStore` already includes a direct execution fallback (`handleSimulationMessage`) when `window.Worker` is not present, which ensures `runSimulation()` works seamlessly in tests as long as valid `historicalRange` values are used.
2. **UI String Mapping Assumption**: We assume that mapping `most_recent_50_years` to the label `"Post WW2 (80 Yrs)"` and `most_recent_20_years` to `"Stagflation 1970s"` satisfies the prompt requirement `(20 yr / stagflation_1970s, 50 yr / post_ww2_80_years, 125 yr / all_125_years)` while preserving strict type safety and zero architectural bloat.

## Conclusion
The implementation of Milestone 4.4 is fully feasible and should proceed with the following surgical steps:
1. Create `src/components/SimulationTab.tsx` as a Client Component, extracting the Monte Carlo simulation view from `PlanBuilder.tsx`. Implement Approach A for the historical range selector (`all_125_years`, `most_recent_50_years`, `most_recent_20_years`) to maintain strict Zod schema compliance and prevent runtime simulation failures.
2. Update `src/components/PlanBuilder.tsx` to import and render `<SimulationTab userTier={userTier} />`.
3. Create `__tests__/planner/simulationTab.spec.tsx` with comprehensive test cases covering all 6 core requirements (isolation render, horizon/paths updates, Premium Lock view, upgrade button routing, premium range selection, and simulation triggering) to guarantee 100% test coverage.

## Verification Method
1. **Static Analysis & Type Check**:
   - Run `npx tsc --noEmit` to ensure TypeScript compilation succeeds without errors.
2. **Unit Test Verification**:
   - Run `npm run test __tests__/planner/simulationTab.spec.tsx` to verify 100% passing test coverage for the new component.
   - Run `npm run test __tests__/planner` to ensure no regressions occur in `planBuilder.spec.tsx` or `useRetirementStore.spec.ts`.
3. **Linter & Code Quality**:
   - Run `npm run lint` to confirm adherence to Next.js and project linting standards.
