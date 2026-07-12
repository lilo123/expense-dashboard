# Handoff Report: M2.2 Web Worker Simulation Engine Exploration

## 1. Observation
- **`src/lib/planner/types.ts`**: Defines Zod schemas and TypeScript types for `Household`, `SimulationConfig`, `SimulationResultsSummary`, `Account`, `Spending`, `Pension`, and `LifeEvent`.
- **`src/content/historicalMarketData.ts`**: Contains `historicalMarketData` (`Float64Array` of length 375 representing 125 years of interleaved empirical returns) and `HISTORICAL_RANGES` (`most_recent_20_years`, `most_recent_50_years`, `all_125_years`).
- **`src/lib/planner/simulator.ts`**: Defines `simulatePath(household, marketReturns, config, pathIndex)`, which calculates annual progressions and executes the drawdown engine (`calculateAnnualDrawdown`).
- **`package.json`**: Configures Jest as the primary test runner (`"test": "jest"`).
- **Target Files**: `src/lib/planner/simulation.worker.ts` and `__tests__/planner/simulationWorker.spec.ts` currently do not exist in the codebase and are ready to be created by the Implementer.

## 2. Logic Chain
1. **Message Contract & Decoupling**: To satisfy the Web Worker message contract (`{ action: 'simulate', config: SimulationConfig, marketData: Float64Array, household?: Household }`) while ensuring clean testability in Jest, the worker must export a standalone `handleMessage(event: MessageEvent, scope: any = self)` function.
2. **Defensive Input Handling**: The worker must validate `action === 'simulate'` and verify the presence of `config` and `marketData`. To support the optional `household` parameter, the worker must initialize a robust default `Household` adhering to `HouseholdSchema` when `household` is omitted.
3. **Market Data Alignment**: To support `config.historicalRange`, the worker must inspect `marketData.length`. If `marketData.length === 375`, it must slice the array using `HISTORICAL_RANGES[config.historicalRange]`.
4. **Monte Carlo Engine & Drawdown Integration**: For each path `p` (from `0` to `config.numPaths - 1`), the worker must perform deterministic block bootstrap sampling (`(p * 7) % numYears`) to build a `marketReturns` array (`0.6 * stocks + 0.4 * bonds`) and execute `simulatePath`. This seamlessly incorporates all drawdown strategies (`taxable_first`, `proportional`, `tax_deferred_first`), inflation adjustments, and cash flows.
5. **High-Performance IPC & In-place Sorting**: To achieve zero-copy IPC and avoid memory overhead, the worker must allocate a single flat `Float64Array` buffer of size `numPaths * (1 + horizon)`. Subarray views (`buffer.subarray(...)`) must be sorted in-place (`.sort()`) to compute `p10`, `p50`, and `p90` percentiles. The buffer is then transferred back to the main thread via `scope.postMessage({ summary, buffer: buffer.buffer }, [buffer.buffer])`.
6. **Comprehensive Unit Testing**: A Jest test suite (`__tests__/planner/simulationWorker.spec.ts`) must be created to mock `scope = { postMessage: jest.fn() }` and test valid full market data execution, valid sliced market data execution with custom household cash flows, and error handling edge cases, achieving 100% test coverage.

## 3. Caveats
- **No caveats.** The exploration thoroughly analyzed all dependent schemas, market data structures, simulation engines, and Jest test runner configurations.

## 4. Conclusion
The architectural plan and proposed file implementations fully satisfy all M2.2 technical requirements. The Implementer can directly create `src/lib/planner/simulation.worker.ts` and `__tests__/planner/simulationWorker.spec.ts` using the verified code implementations provided in `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m2_2_2/exploration_report.md`.

## 5. Verification Method
To independently verify the implementation:
1. Run `npm run test __tests__/planner/simulationWorker.spec.ts` to confirm 100% passing test coverage for the Web Worker test suite.
2. Run `npm run test __tests__/planner` to ensure all existing planner tests continue to pass successfully without regression.
3. Verify that `src/lib/planner/simulation.worker.ts` correctly utilizes `subarray().sort()` and Transferable Objects (`[buffer.buffer]`) for zero-copy IPC.
