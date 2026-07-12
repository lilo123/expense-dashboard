# E2E Test Infra Reviewer 1 — Handoff Report

## 1. Observation
During our independent review and adversarial verification of the E2E Test Infrastructure for `expense-dashboard` at `/usr/local/google/home/duynguyenn/expense-dashboard`, we directly observed the following:

- **`TEST_INFRA.md`**: Exists at the project root (85 lines) and defines a comprehensive opaque-box test suite containing **45 concrete test cases** across the 3 main features:
  - Feature 1: Global Market Data Toggle (Test cases 1-14)
  - Feature 2: Accumulation Phase & Timeline Calculation Toggle (Test cases 15-30)
  - Feature 3: Simulation Mode Toggle (Historical Backtesting vs. Scrambled Monte Carlo) (Test cases 31-45)
  - It strictly adheres to the **4-Tier Productivity Workflow** (Tier 1: Local Watch-Mode Unit Testing, Tier 2: Targeted Single-Spec E2E, Tier 3: Automated Git Pre-Push Smoke Tests, Tier 4: Asynchronous Cloud CI/CD Auditing).
  - It explicitly enforces all **Brand & Empathy Assertions ("No Game Overs")** (zero negative financial jargon like "Debt", "Penalty", "Failing", "Over-limit", "Deficit"; empathetic error catch-all *"Uh oh, the system tripped up! Don't worry, your data is safe. Let's try that again."*) and **Design System Assertions** (Tailwind Zen Palette, Glassmorphism, mathematical filter heights alignment, bounding box alignment) defined in `TESTING.md`.
- **`e2e/verify_accumulation.ts`**: Exists (78 lines) and correctly establishes `globalThis.self` and `addEventListener` mocks for Comlink before dynamically importing `simulationService` from `../src/workers/simulation.worker`. When executed via `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_accumulation.ts`, it correctly invokes `runSimulation` and fails as expected:
  ```
  [FAIL] Run startYear 1974, Age 2: Expected $0 withdrawal during accumulation, got $41189.15050710841
  ...
  === [E2E VERIFICATION] Accumulation Verification FAILED ===
  Error: Accumulation phase verification failed due to incorrect withdrawal or contribution logic.
  ```
- **`e2e/verify_monte_carlo.ts`**: Exists (80 lines) and correctly establishes Comlink mocks before dynamically importing `simulationService`. When executed via `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_monte_carlo.ts`, it correctly invokes `runSimulation` and fails as expected:
  ```
  === [E2E VERIFICATION] Validating Scrambled Monte Carlo Simulation Engine ===
  Executing first Scrambled Monte Carlo invocation...
  Invocation 1 generated 126 runs.
  === [E2E VERIFICATION] Monte Carlo Verification FAILED ===
  Error: [FAIL] Expected exactly 1,000 simulation runs, got 126
  ```
- **`npx tsc --noEmit`**: When executed, fails as expected with TypeScript errors in `src/app/calculator/CalculatorParams.tsx:103:5` (`missing the following properties from type... marketDataMode, timelineMode, simulationMode`), confirming that the UI and types (Milestone M1/M4) are pending implementation by the respective workers.
- **Integrity & Compliance**: There are zero hardcoded test results or expected outputs embedded in the verification scripts. They perform genuine numerical and behavioral assertions against the actual `simulationService.runSimulation` engine.

## 2. Logic Chain
1. **Requirement Satisfaction**: `ORIGINAL_REQUEST.md` and `task_description.md` mandate verifying that `TEST_INFRA.md` follows the 4-tier methodology with at least 38 test cases across the 3 main features. `TEST_INFRA.md` successfully exceeds this by providing 45 highly detailed test cases perfectly categorized into the 4 tiers.
2. **Contract & Brand Conformance**: `TEST_INFRA.md` aligns perfectly with `PROJECT.md` interface contracts (`SimulationConfig`, `marketData.ts`) and `TESTING.md` brand/empathy/design assertions, ensuring upcoming implementations will be rigorously audited for "No Game Overs" compliance and zero Cumulative Layout Shift (CLS).
3. **Comlink Node.js Robustness**: By defining `(globalThis as any).self = globalThis; (globalThis as any).addEventListener = () => {};` and utilizing `await import('../src/workers/simulation.worker')`, `e2e/verify_accumulation.ts` and `e2e/verify_monte_carlo.ts` successfully prevent ES module import hoisting from bypassing the Comlink mock. This allows seamless opaque-box verification of the Web Worker engine directly in Node.js via `npx tsx`.
4. **Adversarial Critique & Stress-Testing**:
   - *PRNG Seed Isolation*: `e2e/verify_monte_carlo.ts` invokes `runSimulation` twice with identical config and asserts exact determinism (`summary1.successRate === summary2.successRate`, etc.). This introduces a powerful adversarial safeguard: if the upcoming Web Worker implementation (M3) fails to reset the Mulberry32 PRNG seed on each `runSimulation` invocation (e.g., leaking PRNG state across runs), `verify_monte_carlo.ts` will immediately catch the determinism mismatch and fail.
   - *Accumulation Slice Robustness*: `e2e/verify_accumulation.ts` configures `currentAge: 40`, `retirementAge: 60`, `duration: 50`, and slices the first 20 years for accumulation checks (`withdrawal === 0`). This perfectly matches the explicit test configuration and ensures exact boundary validation.
5. **Genuine Verification**: The verification scripts correctly fail at this stage because `src/workers/simulation.worker.ts` has not yet been updated by the Implementation Track workers. This proves 100% genuine verification with zero dummy mocks or reward hacking.

## 3. Caveats
- **Pending Implementations (M1-M4)**: The verification scripts `e2e/verify_accumulation.ts` and `e2e/verify_monte_carlo.ts`, as well as `npx tsc --noEmit`, currently fail as expected because the underlying simulation worker logic (`src/workers/simulation.worker.ts`) and types (`src/types/simulation.ts`) have not yet been updated. They will successfully pass once the implementers complete Milestones M1, M2, M3, and M4.

## 4. Conclusion
**Verdict: APPROVE**

E2E Test Infra Worker 1 has successfully and robustly established the comprehensive opaque-box test suite (`TEST_INFRA.md`) and automated verification scripts (`e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`). The test infrastructure exhibits exceptional quality, strict contract conformance, zero integrity violations, and provides powerful adversarial safeguards for the upcoming implementation phases.

## 5. Verification Method
To independently verify the test infrastructure once the implementers complete Milestones M1, M2, M3, and M4, execute the following commands:

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
