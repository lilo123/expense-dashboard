# Handoff Report: M2.1 Global Market Data Ingestion (Codebase Compatibility & Type Safety Focus)

## 1. Observation
- **Discrepancy between `PROJECT.md` and `SCOPE.md` Interface Contracts**:
  - `PROJECT.md` (lines 27-30) defines the `marketData.ts` interface contract as:
    ```typescript
    - getMarketData(mode: 'us' | 'global', year: number): MarketDataPoint
    - getValidStartYears(mode: 'us' | 'global', duration: number): number[]
    - getAllMarketData(mode: 'us' | 'global'): MarketDataPoint[]
    ```
  - `SCOPE.md` (lines 13-16) defines the `marketData.ts` interface contract as:
    ```typescript
    - getMarketDataForYear(year: number, mode?: 'us' | 'global'): MarketDataPoint
    - getValidStartYears(duration: number, mode?: 'us' | 'global'): number[]
    - getAllMarketData(mode?: 'us' | 'global'): Record<number, MarketDataPoint>
    ```
- **Existing Implementation of `src/lib/marketData.ts`**:
  - `src/lib/marketData.ts` currently exports `shillerMarketData: Record<number, MarketDataPoint>` (line 26).
  - It exports `getMarketDataForYear(year: number): MarketDataPoint` (lines 67-82).
  - It exports `getValidStartYears(duration: number): number[]` (lines 84-95).
  - It does NOT currently export `getAllMarketData`.
- **Consumers of `src/lib/marketData.ts` across the codebase**:
  - `src/workers/simulation.worker.ts`:
    - Imports `getMarketDataForYear` and `getValidStartYears` from `../lib/marketData` (line 9).
    - Calls `getValidStartYears(config.duration)` at line 180.
    - Calls `getMarketDataForYear(startYear)` at line 207.
    - Calls `getMarketDataForYear(currentYear)` at line 212.
    - Calls `getMarketDataForYear(currentYear - 1)` at line 213.
    - Calls `getMarketDataForYear(cfStartYear)` at lines 254 and 275.
    - *Note*: None of these calls pass a second argument (`mode`).
  - `src/app/calculator/views/DataAssumptionsView.tsx`:
    - Imports `shillerMarketData` from `../../../lib/marketData` (line 4).
    - Uses `Object.values(shillerMarketData)` at line 12 to generate `historicalDataRows`.
- **Test Suite and Schema Verification**:
  - `__tests__/simulationSchemaStress.test.ts` and `__tests__/lib/adv_simulation_schema.test.ts` verify `simulationConfigSchema` which includes `marketDataMode: z.enum(['us', 'global']).default('us')`.
  - There are no existing unit tests directly importing `src/lib/marketData.ts` or testing `getMarketDataForYear` / `getValidStartYears` directly in `__tests__/`.

## 2. Logic Chain
1. **Contract Selection for Backwards Compatibility**:
   - If the `PROJECT.md` contract (`getMarketData(mode, year)`) is adopted, `src/workers/simulation.worker.ts` will fail to compile (`npx tsc --noEmit` error) because it expects `getMarketDataForYear(year)` and `getValidStartYears(duration)`.
   - By adopting the `SCOPE.md` contract (`getMarketDataForYear(year, mode?: 'us' | 'global')` and `getValidStartYears(duration, mode?: 'us' | 'global')`), all existing call sites in `src/workers/simulation.worker.ts` remain 100% valid in TypeScript. Since `mode` is optional, it will cleanly default to `'us'` when omitted, preserving existing behavior without requiring immediate changes to `simulation.worker.ts`.
2. **Preservation of `shillerMarketData` Export**:
   - `src/app/calculator/views/DataAssumptionsView.tsx` relies directly on the exported `shillerMarketData` object.
   - If `src/lib/marketData.ts` is refactored to only export functions (`getMarketDataForYear`, `getValidStartYears`, `getAllMarketData`), `DataAssumptionsView.tsx` will break during `npx tsc --noEmit`.
   - Therefore, `src/lib/marketData.ts` MUST continue to export `export const shillerMarketData: Record<number, MarketDataPoint>`.
3. **Implementation of `getAllMarketData`**:
   - `SCOPE.md` requires `getAllMarketData(mode?: 'us' | 'global'): Record<number, MarketDataPoint>`.
   - This function must be added as a new export in `src/lib/marketData.ts`. It should return `shillerMarketData` when `mode === 'us'` (or undefined/default), and the new global market data dictionary when `mode === 'global'`.
4. **Future Integration Risks & M3 Alignment**:
   - While making `mode?: 'us' | 'global'` optional ensures zero breakage for M2.1, `src/workers/simulation.worker.ts` currently does NOT pass `config.marketDataMode` to `getMarketDataForYear` or `getValidStartYears`.
   - This means that until `simulation.worker.ts` is updated in Milestone M3 to pass `config.marketDataMode`, selecting "Global" in the UI will still result in the worker fetching US Shiller data. This is an expected architectural staging boundary between M2 and M3, but must be explicitly documented for the M3 implementer.

## 3. Caveats
- **Global Market Data Structure**: We assume `src/lib/globalMarketData.ts` will export a dictionary structure compatible with `Record<number, MarketDataPoint>` (e.g., `globalMarketData: Record<number, MarketDataPoint>`) so `marketData.ts` can seamlessly switch between `shillerMarketData` and `globalMarketData`.
- **UI Data Assumptions View**: `DataAssumptionsView.tsx` currently only displays `shillerMarketData`. In M4 (UI Inputs & Toggles), `DataAssumptionsView.tsx` should be updated to use `getAllMarketData(config.marketDataMode)` if the user wishes to inspect MSCI World data assumptions in the UI.

## 4. Conclusion
- The `SCOPE.md` contract (`mode?: 'us' | 'global'` as an optional second parameter) is the correct, type-safe, and backwards-compatible contract to implement for M2.1.
- `src/lib/marketData.ts` must retain the `export const shillerMarketData` export to prevent breaking `src/app/calculator/views/DataAssumptionsView.tsx`.
- `getAllMarketData(mode?: 'us' | 'global'): Record<number, MarketDataPoint>` must be added to `src/lib/marketData.ts`.
- M3 must update `src/workers/simulation.worker.ts` to pass `config.marketDataMode` to `getValidStartYears` and `getMarketDataForYear`.

## 5. Verification Method
- **TypeScript Type Safety**: Run `npx tsc --noEmit` to verify that no consuming files (`simulation.worker.ts`, `DataAssumptionsView.tsx`) have broken contracts.
- **Unit & Build Tests**: Run `npm run test` and `npm run build` to ensure full test suite pass and successful Next.js production build.
- **Inspection**: Verify `src/lib/marketData.ts` retains `export const shillerMarketData`.
