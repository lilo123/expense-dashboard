# Handoff Report: M2.2 Web Worker Simulation Engine

## 1. Observation
- **Task Requirement**: Plan the implementation of `src/lib/planner/simulation.worker.ts` and its unit tests `__tests__/planner/simulationWorker.spec.ts` supporting Web Worker message contracts (`{ action: 'simulate', config: SimulationConfig, marketData: Float64Array, household?: Household }`), Monte Carlo block bootstrap sampling, in-place numerical sorting (`subarray().sort()`), zero-copy IPC via Transferable Objects, and drawdown strategies with 100% test coverage.
- **File State**: `src/lib/planner/simulation.worker.ts` and `__tests__/planner/simulationWorker.spec.ts` do not currently exist in the repository.
- **Underlying Engines**: `src/lib/planner/simulator.ts` provides `simulatePath(household, marketReturns, config, pathIndex)`. `src/content/historicalMarketData.ts` provides a 375-element `Float64Array` representing 125 years of interleaved empirical data (stocks, bonds, inflation). `src/lib/planner/types.ts` defines `Household`, `SimulationConfig`, and `SimulationResultsSummary`.

## 2. Logic Chain
1. **Web Worker Message Contract & Default Fallbacks**: The message contract specifies `household?: Household`. To ensure `simulatePath` functions correctly when `household` is omitted (e.g. for default quick-check scenarios), the worker must define a robust default `Household` object.
2. **Historical Range Slicing**: The `marketData` provided can be the full 375-element array or a pre-sliced array. The worker must check the length and use `subarray()` to isolate the correct historical window (`most_recent_20_years` at offset 315, `most_recent_50_years` at offset 225, `all_125_years` at offset 0) before calculating `numYears = Math.floor(slice.length / 3)`.
3. **Monte Carlo Block Bootstrapping**: Using deterministic sampling `(p * seed) % numYears` guarantees reproducible paths across the retirement horizon. For each year, the 60/40 portfolio return is computed as `0.6 * stocks + 0.4 * bonds` and passed to `simulatePath`.
4. **Performance & Zero-Copy IPC**: Allocating a single `Float64Array` of size `numPaths + (horizon * numPaths)` allows storing final balances and annual ending balances contiguously. Using `subarray().sort()` sorts each slice numerically in-place, enabling direct calculation of p10, p50, and p90 percentiles. The entire buffer is then returned to the main thread via Transferable Objects (`postMessage({ summary, resultsBuffer }, [resultsBuffer.buffer])`).
5. **100% Hermetic Unit Testability**: To allow Jest to test the worker thoroughly without browser runtime conflicts, the message processing logic is decoupled into an exported function `handleSimulationMessage(data, onSuccess, onError)`. The worker event listener is only attached if `typeof window === 'undefined' && typeof self !== 'undefined'`.

## 3. Caveats
- The Web Worker relies on `simulatePath` from `src/lib/planner/simulator.ts`. Any future changes to `simulatePath`'s signature or drawdown engine rules will automatically propagate to the worker.
- In-place numerical sorting with `Float64Array.prototype.sort()` sorts numbers ascendingly by default, which perfectly suits percentile indexing (`Math.floor(numPaths * 0.10)`, etc.).

## 4. Conclusion
The architectural plan is complete, verified, and ready for drop-in implementation by the Worker/Implementer agent. Full specifications and ready-to-use code blocks are documented in `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m2_2_1/exploration_report.md`.

## 5. Verification Method
After implementing `src/lib/planner/simulation.worker.ts` and `__tests__/planner/simulationWorker.spec.ts`, verify the implementation using the following commands:
1. Run `npm run test __tests__/planner/simulationWorker.spec.ts` to confirm 100% passing test coverage for the Web Worker engine.
2. Run `npm run test __tests__/planner` to confirm no regressions across the entire planner module.
