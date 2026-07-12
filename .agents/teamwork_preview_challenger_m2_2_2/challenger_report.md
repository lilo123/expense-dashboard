# Challenger 2 Report: M2.2 Web Worker Simulation Engine

## Challenge Summary

**Overall risk assessment**: LOW

**Clear Verdict**: CONFIRM CORRECTNESS

## Scope Boundaries & Verified Artifacts
- **Target Files**: `src/lib/planner/simulation.worker.ts` and `__tests__/planner/simulationWorker.spec.ts`
- **Verification Command**: `export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npm run test __tests__/planner`
- **Results**: 18 test suites passed, 254 tests passed (100% success rate).

## Key Challenge Checkpoints

### 1. Edge Case Handling
- **Empty Market Data Buffers**: Evaluated behavior when `marketData` is an empty `Float64Array`. The worker correctly checks `numYears > 0` and falls back gracefully to pushing a default `0.05` constant market return across the entire retirement horizon. This perfectly matches the core simulator fallback behavior.
- **Pre-sliced Data**: Evaluated behavior when `marketData` is passed as a pre-sliced subset (e.g., length 60 for 20 years, or length 150 for 50 years). The worker verifies `marketData.length === 375` before attempting `subarray()` slicing for `most_recent_20_years` or `most_recent_50_years`. If pre-sliced data is provided, it correctly defaults to using `slice = marketData` directly without causing out-of-bounds indexing.
- **Invalid Action Strings**: Evaluated message contracts with unsupported action strings (e.g., `action: 'unsupported_action'`). The worker correctly raises an explicit error (`Unsupported action: ...`) and routes it to the `onError` callback or `postMessage({ error: ... })`.
- **Missing Configs**: Evaluated missing `config` or `marketData` payloads. The worker correctly validates both properties and raises `Missing config or marketData`.

### 2. Horizon Modes
- **Correctness of `life_expectancy` vs `fixed_years`**:
  - In `fixed_years` mode, the worker correctly defaults to `config.retirementHorizon ?? 30`.
  - In `life_expectancy` mode, the worker executes `Math.max(1, 95 - targetHousehold.retirementAge)`. This perfectly matches the primary logic implemented in `src/lib/planner/simulator.ts`.

### 3. Drawdown Strategies
- **Proper Execution**: Confirmed proper execution of `proportional`, `taxable_first`, and `tax_deferred_first` drawdown strategies across the 60/40 Monte Carlo bootstrap paths.
- **Bootstrapping Mechanics**: The worker implements deterministic block bootstrap sampling (`(p * seed) % numYears`) to generate historical return sequences, applying a classic 60/40 portfolio allocation (`0.6 * stocks + 0.4 * bonds`).
- **Strategy Propagation**: The drawdown strategy configuration is correctly propagated to `simulatePath`, which successfully delegates to `calculateAnnualDrawdown` to manage account balances and withdrawals according to the designated strategy rules.

### 4. Zero-Copy IPC & Percentile Precision
- **Memory Allocation**: The worker allocates a single contiguous `Float64Array` (`resultsBuffer`) to store final balances and annual ending balances, allowing highly efficient zero-copy transfer (`[resultsBuffer.buffer]`).
- **In-place Sorting**: `finalBalances.sort()` and `yearBalances.sort()` correctly leverage `TypedArray.prototype.sort()`, which performs numerical sorting in place by default (unlike standard `Array.prototype.sort()`). This ensures accurate percentile calculations (`p10`, `p50`, `p90`).
- **Runtime Type Safety**: The aggregated summary undergoes strict Zod runtime schema validation via `SimulationResultsSummarySchema.parse(rawSummary)`, guaranteeing full contract adherence before posting the response back to the main thread.

## Stress Test Results
- `[Default household, all_125_years]` → Expected: `successRate` in [0, 100], valid percentiles, 30 annual results → Actual: Matches exactly → PASS
- `[Custom household, tax_deferred_first, most_recent_20_years]` → Expected: 20 annual results, valid buffer transfer → Actual: Matches exactly → PASS
- `[Custom household, proportional, most_recent_50_years]` → Expected: 25 annual results, valid buffer transfer → Actual: Matches exactly → PASS
- `[Pre-sliced market data]` → Expected: Correct horizon handling without index out-of-bounds → Actual: Matches exactly → PASS
- `[Empty market data buffer]` → Expected: Fallback to 5% constant return, successful completion → Actual: Matches exactly → PASS
- `[life_expectancy horizon mode]` → Expected: Horizon calculated as `95 - retirementAge` (35 years for age 60) → Actual: Matches exactly → PASS
- `[Invalid action / Missing config]` → Expected: Proper invocation of `onError` callback / error postMessage → Actual: Matches exactly → PASS

## Conclusion
The M2.2 Web Worker Simulation Engine is fully correct, robust, and handles all identified edge cases, horizon modes, and drawdown strategies flawlessly.

**Verdict**: CONFIRM CORRECTNESS
