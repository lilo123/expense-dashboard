# E2E Test Infra Reviewer 2 — Handoff Report

## 1. Observation
During our independent review and verification of the E2E Test Infrastructure for `expense-dashboard` at `/usr/local/google/home/duynguyenn/expense-dashboard`, we directly observed the following:

- **`TEST_INFRA.md`**: Exists at the project root and defines a comprehensive opaque-box test suite containing **45 concrete test cases** (exceeding the 38 required). It strictly follows the **4-Tier Productivity Workflow** (Tier 1: Local Watch-Mode Unit Testing, Tier 2: Targeted Single-Spec E2E, Tier 3: Automated Git Pre-Push Smoke Tests, Tier 4: Asynchronous Cloud CI/CD Auditing). It explicitly enforces all Brand & Empathy Assertions ("No Game Overs", absence of forbidden words "Debt", "Penalty", "Failing", "Over-limit", "Deficit", and the global empathetic error catch-all *"Uh oh, the system tripped up! Don't worry, your data is safe. Let's try that again."*) and Design System Assertions (Tailwind Zen Palette, Glassmorphism, strict bounding box alignment `Math.abs(plannerBox.y - skeletonBox.y) <= 1.0px`).
- **`e2e/verify_accumulation.ts`**: Exists and correctly implements a Comlink Node.js environment workaround (`globalThis.self = globalThis; (globalThis as any).addEventListener = () => {};`) before dynamically importing `../src/workers/simulation.worker`. When executed via `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_accumulation.ts`, it correctly invokes the simulation engine and fails as expected (`[FAIL] Run startYear 1974, Age 2: Expected $0 withdrawal during accumulation, got $41189.15...`) because `src/workers/simulation.worker.ts` has not yet been updated by the implementers to support the accumulation phase.
- **`e2e/verify_monte_carlo.ts`**: Exists and correctly implements the Comlink Node.js environment workaround. When executed via `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_monte_carlo.ts`, it correctly invokes the simulation engine and fails as expected (`[FAIL] Expected exactly 1,000 simulation runs, got 126`) because `src/workers/simulation.worker.ts` currently executes historical backtesting over the 126 valid start years instead of 1,000 Scrambled Monte Carlo runs.
- **`npx tsc --noEmit`**: Fails with TypeScript errors in `CalculatorParams.tsx` due to missing properties (`marketDataMode`, `timelineMode`, `simulationMode`) in the form values/resolver, confirming that the UI and types (Milestone M1/M2/M3) are pending implementation by the respective workers.
- **Integrity & Reward Hacking Check**: We verified that `e2e/verify_accumulation.ts` and `e2e/verify_monte_carlo.ts` perform genuine, real numerical and behavioral assertions against the actual `simulationService.runSimulation` engine. There are no hardcoded test results, dummy/facade implementations, or fabricated verification outputs.

## 2. Logic Chain
1. **Interface Conformance**: The test infrastructure aligns perfectly with the interface contracts defined in `PROJECT.md` and `TESTING.md`. `TEST_INFRA.md` covers all required configuration properties (`marketDataMode`, `timelineMode`, `simulationMode`, `currentAge`, `retirementAge`, `additionalContribution`) across all 4 tiers.
2. **Robustness of Verification Scripts**: The inclusion of `(globalThis as any).self = globalThis; (globalThis as any).addEventListener = () => {};` and dynamic imports (`await import('../src/workers/simulation.worker')`) successfully prevents ES module import hoisting from bypassing the Comlink mock in Node.js. This allows direct, zero-overhead opaque-box verification of the mathematical engine.
3. **Genuine Verification & Integrity Mandate**: The verification scripts maintain real state and perform genuine assertions. Their current failure against the un-updated `src/workers/simulation.worker.ts` proves that they do not cheat or hardcode test results.
4. **Adversarial Critique & Stress-Testing**:
   - *Comlink Node.js Global Mocking*: We challenged the assumption of mocking `globalThis.self`. Since `runSimulation` is currently a synchronous function on `simulationService`, direct invocation works perfectly in Node.js. For future async worker expansions, using the `worker_threads` module in Node.js would provide higher fidelity.
   - *Monte Carlo PRNG Seed Determinism*: `verify_monte_carlo.ts` calls `runSimulation` twice sequentially and expects identical results. The implementers of `simulation.worker.ts` must ensure that `runSimulation` explicitly initializes the Mulberry32 PRNG with a fixed seed at the start of every simulation call; otherwise, the second invocation would pick up where the first left off and fail the determinism check.
   - *Accumulation Compounding vs. Market Crashes*: `verify_accumulation.ts` logs a warning (`[WARN] ... endBalance not greater than startBalance despite contributions`) if `yr.endBalance <= yr.startBalance`. In a severe market crash year (e.g., 2008), an 80% equities portfolio could lose more than the $12,000 contribution. The script correctly uses `console.warn` rather than `console.error` for this check, demonstrating excellent resilience against flaky test failures during historical crash years.
   - *Memory & CPU Limits*: Executing 1,000 Monte Carlo runs allocates large buffers. `TEST_INFRA.md` correctly includes `ci_monte_carlo_performance_benchmarking` (Test Case 42) and `e2e_monte_carlo_simulations_list_view` (Test Case 38) to explicitly benchmark Web Worker execution timeouts and verify virtualization/memory leaks.

## 3. Caveats
- **Prerequisite Implementations (M1, M2, M3)**: The verification scripts `e2e/verify_accumulation.ts` and `e2e/verify_monte_carlo.ts`, as well as `npx tsc --noEmit`, currently fail because the underlying simulation worker logic (`src/workers/simulation.worker.ts`) and types (`src/types/simulation.ts`) have not yet been updated. They will successfully pass once the implementers complete the corresponding source code changes.

## 4. Conclusion
**Verdict**: APPROVE

E2E Test Infra Worker 1 has successfully established a pristine, enterprise-grade opaque-box test suite (`TEST_INFRA.md`) and automated verification scripts (`e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`). The test infrastructure is fully operational, free of integrity violations, and ready to validate the upcoming worker engine and UI implementations.

## 5. Verification Method
To independently verify the test infrastructure once the implementers complete Milestones M1, M2, and M3, execute the following commands:

1. **Verify TypeScript Compilation & Type Safety**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsc --noEmit
   ```
   *Expected Result*: Zero TypeScript compilation or type errors.

2. **Verify Accumulation Phase Verification Script**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsx e2e/verify_accumulation.ts
   ```
   *Expected Result*: Script executes successfully, outputs `✔ Accumulation phase correctly applies $0 withdrawals, adds contributions, and compounds returns.`, and exits with code `0`.

3. **Verify Scrambled Monte Carlo Verification Script**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsx e2e/verify_monte_carlo.ts
   ```
   *Expected Result*: Script executes successfully, outputs `✔ Scrambled Monte Carlo results are 100% deterministic and reproducible across invocations.`, and exits with code `0`.

4. **Verify Existing E2E Test Suite Pass**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsx e2e/run_e2e.ts
   ```
   *Expected Result*: Playwright tests execute successfully with 100% passing specs.
