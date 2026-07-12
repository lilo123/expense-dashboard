# Handoff Report: Milestone 4.4 - Simulation Tab & Premium Range Selector

## Observation
1. **Existing Inline Implementation (`src/components/PlanBuilder.tsx`)**:
   - Lines 241-335 of `src/components/PlanBuilder.tsx` currently contain the inline Monte Carlo simulation view rendered when `store.activeTab === 'simulation'`.
   - The view includes form inputs for `retirementHorizon` (`<input id="sim-horizon" ... />`) and `numPaths` (`<select id="sim-paths" ... />`).
   - The Premium Tier Historical Range Selector renders buttons for `['all_125_years', 'post_ww2_80_years', 'stagflation_1970s']`. When clicked, it invokes `store.updateSimulationConfig({ historicalRange: range as any })`.
   - If `userTier !== 'premium'`, an An-yen frosted glass Premium Lock card is displayed over the range selector with an "Upgrade to Premium" button invoking `router.push('/pricing')`.
   - The view displays `store.error` and `store.simulationResults` (Success Rate, Median Final Balance) upon executing `store.runSimulation()`.
2. **Domain Schema & Engine Mismatch (`src/lib/planner/types.ts` & `src/content/historicalMarketData.ts`)**:
   - In `src/lib/planner/types.ts`, `SimulationConfigSchema` defines `historicalRange` as `z.enum(['most_recent_20_years', 'most_recent_50_years', 'all_125_years'])`.
   - In `src/content/historicalMarketData.ts`, `HISTORICAL_RANGES` maps `most_recent_20_years`, `most_recent_50_years`, and `all_125_years`.
   - Because `PlanBuilder.tsx` uses `post_ww2_80_years` and `stagflation_1970s`, `updateSimulationConfig` casts `range as any`. If `runSimulation()` is executed while `stagflation_1970s` is selected, `getMarketDataCopy` throws a TypeError (`Cannot destructure property 'startIndex' of 'HISTORICAL_RANGES[range]' as it is undefined`), which is caught by `runSimulation` and correctly sets `store.error`.
3. **Unit Testing Status (`__tests__/planner/`)**:
   - `__tests__/planner/simulationTab.spec.tsx` does not currently exist.
   - `__tests__/planner/planBuilder.spec.tsx` tests `PlanBuilder` tab navigation and verifies the Premium Lock card on the Simulation tab when `userTier="free"`.

## Logic Chain
1. **Extraction of `SimulationTab.tsx`**:
   - To satisfy M4.4 requirements while strictly adhering to the surgical changes principle, the inline simulation code (lines 241-335 of `src/components/PlanBuilder.tsx`) must be extracted verbatim into a new Client Component `src/components/SimulationTab.tsx`.
   - `SimulationTab.tsx` must begin with `"use client";`, accept `userTier?: string` as a prop (defaulting to `'free'`), import `useRouter` from `next/navigation`, and import `useRetirementStore` from `@/store/useRetirementStore`.
2. **Updating `PlanBuilder.tsx`**:
   - `PlanBuilder.tsx` must import `SimulationTab` from `@/components/SimulationTab`.
   - The block `{store.activeTab === 'simulation' && (<div className="flex flex-col gap-6">...</div>)}` must be replaced with `{store.activeTab === 'simulation' && (<SimulationTab userTier={userTier} />)}`.
3. **Implementing `__tests__/planner/simulationTab.spec.tsx`**:
   - A dedicated Jest specification file must be created at `__tests__/planner/simulationTab.spec.tsx` to achieve 100% coverage of `SimulationTab.tsx`.
   - The test file must mock `next/navigation` (`useRouter`) and wrap `SimulationTab` in `<RetirementStoreProvider>`.
   - It must include distinct test cases for:
     1. Rendering in isolation and verifying the Premium Lock card and "Upgrade to Premium" click (`router.push('/pricing')`) when `userTier="free"`.
     2. Updating `retirementHorizon` and `numPaths` when `userTier="premium"`.
     3. Selecting premium historical ranges (`Stagflation 1970s`) when `userTier="premium"`.
     4. Triggering `runSimulation()` with the default `all_125_years` range to verify successful simulation results display (`Success Rate`, `Median Final Balance`).
     5. Triggering `runSimulation()` after selecting `Stagflation 1970s` to verify `store.error` display (`Cannot destructure property 'startIndex'` or `Cannot read properties of undefined`).

## Caveats
- **Domain Schema Discrepancy**: `src/lib/planner/types.ts` and `src/content/historicalMarketData.ts` define `most_recent_20_years` and `most_recent_50_years` rather than `stagflation_1970s` and `post_ww2_80_years`. Per Scope Boundaries in `task_description.md`, we are strictly focusing on `SimulationTab.tsx`, `PlanBuilder.tsx`, and `simulationTab.spec.tsx`. Therefore, we maintain the legacy `PlanBuilder` behavior (`range as any`) rather than altering the underlying domain engines or schemas.
- **Next.js App Router Mocking**: Tests rely on mocking `next/navigation` for `useRouter`. No actual Next.js routing context is instantiated in Jest.

## Conclusion
The implementation of Milestone 4.4 can be executed cleanly and surgically through three specific steps:
1. Create `src/components/SimulationTab.tsx` by extracting lines 241-335 of `src/components/PlanBuilder.tsx`.
2. Update `src/components/PlanBuilder.tsx` to import and render `<SimulationTab userTier={userTier} />`.
3. Create `__tests__/planner/simulationTab.spec.tsx` with comprehensive tests covering free/premium tiers, input changes, range selection, successful simulation, and store error handling.

## Verification Method
To independently verify the success and correctness of the implementation:
1. Run the full Jest unit test suite for the planner module:
   ```bash
   npm run test __tests__/planner
   ```
2. Specifically verify the new simulation tab specification:
   ```bash
   npm run test __tests__/planner/simulationTab.spec.tsx
   ```
3. Inspect `src/components/PlanBuilder.tsx` and `src/components/SimulationTab.tsx` to ensure no lingering dead code or duplicate definitions remain.
