# M2.2 Web Worker Simulation Engine — Challenger Report

## Challenge Summary

**Overall risk assessment**: LOW
**Verdict**: CONFIRM CORRECTNESS

The M2.2 Web Worker Simulation Engine (`src/lib/planner/simulation.worker.ts`) and its accompanying test suite (`__tests__/planner/simulationWorker.spec.ts`) demonstrate excellent architectural decoupling, robust error handling, zero-copy memory transfers, and comprehensive coverage of edge cases, horizon modes, and drawdown strategies.

## Challenges

### [Low] Challenge 1: Float64Array Buffer Sharing and In-Place Sorting
- **Assumption challenged**: The simulation worker allocates a single `Float64Array` (`resultsBuffer`) for zero-copy IPC transfer and creates subarray views (`finalBalances` and `yearBalances`) which are sorted in-place using `.sort()`.
- **Attack scenario**: If the calling context or an internal consumer expected the `resultsBuffer` layout to maintain the original per-path ordering across years (e.g., tracking Path #5's specific trajectory across all 30 years), the independent in-place sorting of each annual slice would break the per-path correlation across time.
- **Blast radius**: Minimal/None in the current architecture. The primary purpose of `resultsBuffer` in the web worker response is to provide pre-sorted percentile data (`p10`, `p50`, `p90`) for the summary and allow fast aggregate histogram rendering on the main thread, rather than individual time-series path tracking.
- **Mitigation**: If individual path correlation across years becomes required in future milestones, allocate a separate buffer for sorting or return an index map. For the current scope, the existing implementation is highly efficient and correct.

### [Low] Challenge 2: Deterministic Block Bootstrap Sampling Periodicity
- **Assumption challenged**: The Monte Carlo engine uses deterministic block bootstrap sampling `const startYr = (p * seed) % numYears`.
- **Attack scenario**: If `numYears` and `seed` share a common factor (e.g., `numYears = 20` and `seed = 10`), the number of unique starting years sampled across `numPaths` would collapse to `numYears / gcd(numYears, seed)` (e.g., only 2 unique starting years), severely limiting the variance of the simulation.
- **Blast radius**: Low. The default seed is `7` (a prime number), and the standard historical ranges have `numYears` of 125, 50, or 20. Since 7 is coprime to 125, 50, and 20, the full cycle of available starting years is traversed perfectly without period collapse.
- **Mitigation**: Maintain prime numbers for default seeds (like `7` or `42` where coprime) or introduce a true pseudo-random number generator (PRNG) if arbitrary seed/numYears combinations are permitted in user configurations.

## Stress Test Results

- `Empty market data buffer (Float64Array(0))` → `Graceful fallback to 5% default annual return` → `Properly executes 0.05 return across horizon without NaN/division-by-zero` → `pass`
- `Pre-sliced market data (length < 375)` → `Bypasses standard subarray slicing and uses provided slice directly` → `Correctly calculates numYears and simulates paths` → `pass`
- `Invalid action string (action: 'unsupported')` → `Throws Error / triggers onError callback` → `Error caught and forwarded to onError handler` → `pass`
- `Missing config / marketData` → `Throws Error / triggers onError callback` → `Error caught and forwarded to onError handler` → `pass`
- `Horizon Mode: life_expectancy (age 60)` → `Calculates horizon as max(1, 95 - retirementAge) = 35` → `Properly runs simulation for 35 years` → `pass`
- `Drawdown Strategies (proportional, taxable_first, tax_deferred_first)` → `Correctly routes accounts and taxes via calculateAnnualDrawdown` → `Results match exact withdrawal rules across 60/40 bootstrap paths` → `pass`

## Unchallenged Areas

- `Main Thread Web Worker Spawning / Lifecycle` — reason not challenged (out of scope; `simulation.worker.ts` is verified in decoupled unit test environment via `handleSimulationMessage`).
- `UI Chart Rendering of SimulationResultsSummary` — reason not challenged (out of scope for M2.2 Web Worker engine verification).
