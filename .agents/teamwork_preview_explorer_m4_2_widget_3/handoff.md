# Handoff Report: Milestone 4.2 - Public Quick Check Widget

## 1. Observation
- **Project & Milestone Scope**:
  - `PROJECT.md` (lines 5-6) defines the "Dual Entry architecture: public Quick Check widget (`src/app/page.tsx`, `QuickCheckWidget.tsx`) vs authenticated 7-tab SPA... State Management: Dual-representation Zustand store (`src/store/useRetirementStore.tsx`) hydrated via URL search params (`/auth?redirect=/plans/new...`)."
  - `SCOPE.md` (lines 5, 14) mandates building "a public `QuickCheckWidget.tsx` on `src/app/page.tsx` that executes in-memory simulations and passes parameters via URL search params to hydrate the Zustand store" and achieving 100% passing test coverage in `__tests__/planner/quickCheckWidget.spec.ts`.
- **Domain Schema & Simulation Engine**:
  - `src/lib/planner/types.ts` (lines 164-170) defines `QuickCheckParamsSchema` with fields: `portfolio` (non-negative number), `withdrawal` (positive number), `years` (positive integer), and optional `taxJurisdiction` (`'US' | 'CA'`).
  - `src/lib/planner/simulator.ts` (lines 284-361) implements `runQuickCheckSimulation(params: QuickCheckParams, marketReturnPaths: number[][]): SimulationResultsSummary`. It performs an efficient, synchronous in-memory simulation across `params.years` using `params.portfolio` and `params.withdrawal`, returning a strict `SimulationResultsSummarySchema.parse(summary)` containing `successRate`, `medianFinalBalance`, `tenthPercentileFinalBalance`, `ninetiethPercentileFinalBalance`, and `annualEndingBalances`.
  - `src/content/historicalMarketData.ts` (lines 50-68) exposes `historicalMarketData` (`Float64Array`) and helper functions `getMarketDataSlice`/`getMarketDataCopy`. The data is organized as interleaved triplets `[stocks, bonds, inflation]`.
- **Existing Frontend & Store Hydration**:
  - `src/app/page.tsx` is a Next.js server/landing page styled with An-yen design tokens (`bg-zen-base`, `text-zen-charcoal`, `bg-white/50 backdrop-blur-md`). It currently features a hero section and `WaitlistIntakeForm` but lacks the public quick check widget.
  - `src/store/useRetirementStore.tsx` (lines 125-200) exposes `hydrateFromParams(params)` which extracts `portfolio`, `withdrawal`, `years`, and `taxJurisdiction` from `URLSearchParams` or object dictionary to initialize the Zustand store.
- **Test Infrastructure**:
  - `__tests__/planner/` contains Jest unit test files using React Testing Library (`@testing-library/react`). `__tests__/planner/quickCheckWidget.spec.ts` does not currently exist.

## 2. Logic Chain
1. **`QuickCheckWidget.tsx` Architectural Design & State**:
   - To serve as an interactive client widget, `QuickCheckWidget.tsx` must be created as a React Client Component (`'use client'`) in `src/components/QuickCheckWidget.tsx`.
   - It should maintain local state for `portfolio` (default `1000000`), `withdrawal` (default `40000`), `years` (default `30`), and `taxJurisdiction` (default `'US'`).
   - Using `useMemo` or `useEffect`, it should construct `marketReturnPaths` from `historicalMarketData` (by computing `0.6 * stocks + 0.4 * bonds` for 1000 bootstrap paths or a representative subset) and execute `runQuickCheckSimulation({ portfolio, withdrawal, years, taxJurisdiction }, marketReturnPaths)`.
   - To prevent runtime crashes during intermediate typing (e.g., empty strings or invalid inputs), the component should validate inputs against `QuickCheckParamsSchema.safeParse(...)`. If invalid, it should gracefully retain the previous valid simulation result or display a clear fallback/error state.
2. **UI & Navigation Integration (`src/app/page.tsx`)**:
   - The widget UI should follow the established An-yen visual identity: frosted glass containers (`bg-white/60 backdrop-blur-md border border-white/40 shadow-sm rounded-3xl p-6 sm:p-8 max-w-xl mx-auto`), prominent display of simulation results (`successRate.toFixed(1)%` and currency formatted `medianFinalBalance`), and interactive form controls.
   - An action button ("Build Detailed Plan") should invoke `useRouter()` from `next/navigation` to execute `router.push('/plans/new?portfolio=1000000&withdrawal=40000&years=30&taxJurisdiction=US')` (or `/auth?redirect=` equivalent).
   - In `src/app/page.tsx`, `QuickCheckWidget` should be imported and rendered right below the hero section or alongside `WaitlistIntakeForm`.
3. **Unit Test Suite Design (`__tests__/planner/quickCheckWidget.spec.ts`)**:
   - To fulfill the 100% test coverage requirement, the test file must mock `next/navigation` (`useRouter`).
   - Test cases must verify:
     - **T1**: Initial render displays default values (`$1,000,000`, `$40,000`, `30`, `US`) and successful simulation results.
     - **T2**: User interaction (via `fireEvent.change` or `userEvent`) updating `portfolio`, `withdrawal`, `years`, and `taxJurisdiction`, verifying that the simulation results correctly update in real-time.
     - **T3**: Edge cases & validation (e.g. negative values or invalid inputs) verifying that the component handles validation gracefully without throwing unhandled exceptions.
     - **T4**: Action button click invoking `router.push` with the exact expected URL query string containing the user's adjusted parameters.

## 3. Caveats
- `src/components/QuickCheckWidget.tsx` needs to be imported by `src/app/page.tsx`. Ensure that any Next.js specific server/client boundaries are respected (e.g., keeping `src/app/page.tsx` as a Server Component while `QuickCheckWidget` uses `'use client'`).
- In Jest test environments, `next/navigation` must be explicitly mocked since Next.js app router context is not available by default in standard Jest/JSDOM runs.

## 4. Conclusion
The implementation strategy for M4.2 is fully specified, aligned with the existing codebase contracts, and ready for development. The implementer should:
1. Create `src/components/QuickCheckWidget.tsx` using `runQuickCheckSimulation` and `historicalMarketData` for live in-memory simulation, with an action button pushing URL params via `useRouter`.
2. Import and render `QuickCheckWidget` in `src/app/page.tsx`.
3. Create `__tests__/planner/quickCheckWidget.spec.ts` using `@testing-library/react` to achieve 100% passing test coverage across all interaction and navigation flows.

## 5. Verification Method
To independently verify the implementation once completed:
1. Run the unit test suite to ensure 100% passing tests:
   ```bash
   npm run test __tests__/planner/quickCheckWidget.spec.ts
   ```
2. Verify all unit tests across the planner domain remain intact:
   ```bash
   npm run test __tests__/planner
   ```
3. Run the end-to-end integration test verification:
   ```bash
   npx tsx e2e/run_e2e.ts
   ```
4. Confirm zero unwanted git commits or remote pushes:
   ```bash
   git status
   ```
