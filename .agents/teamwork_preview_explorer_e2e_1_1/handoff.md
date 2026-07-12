# Handoff Report: E2E Test Infra Design & Verification Scripts Recommendation

## 1. Observation
During our read-only investigation of `/usr/local/google/home/duynguyenn/expense-dashboard`, we observed the following architectural patterns, requirements, and existing test infrastructure:

- **User Requirements (`.agents/ORIGINAL_REQUEST.md`, lines 41-79)**: 
  - **R1. Global Market Data Toggle**: Parse `chart.csv` (MSCI World Index starting `12/1969`). Include a user-facing toggle to switch between US and Global market data.
  - **R2. Accumulation Phase & Timeline Calculation Toggle**: Add "Current Age" and "Additional Yearly Contributions" fields. Toggle between `Retirement Period Only` (greys out accumulation fields) and `Retirement & Accumulation Period` (combines both phases; accumulation years apply 0 withdrawals, add contributions, and compound interest).
  - **R3. Simulation Mode Toggle**: Toggle between `Historical Backtesting` and `Scrambled Monte Carlo` (1,000 unique simulations using a seeded PRNG like Mulberry32 for deterministic, reproducible results).
- **Project & Scope Status (`PROJECT.md`, lines 9-16; `SCOPE.md`, lines 7-16)**:
  - M1 (Core Types & Schemas) is `IN_PROGRESS`. M2 (Global Market Data), M3 (Simulation Engine Expansion), M4 (UI Inputs & Toggles), and M5 (Final Milestone / E2E Test Pass) are `PLANNED`.
- **Existing E2E Infrastructure (`e2e/run_e2e.ts`, `playwright.config.ts`, `TESTING.md`)**:
  - `e2e/run_e2e.ts` is a standalone wrapper executed via `npx tsx e2e/run_e2e.ts` that swaps `.env.local` with `.env.test` and launches `npx playwright test`.
  - `TESTING.md` (lines 9-31) defines the **4-Tier Productivity Workflow**: Tier 1 (Local Watch-Mode Unit Testing via Jest, `< 2s`), Tier 2 (Targeted Single-Spec E2E via Playwright Desktop Chromium, `< 5s`), Tier 3 (Automated Git Pre-Push Smoke Tests, `~15s`), and Tier 4 (Asynchronous Cloud CI/CD Auditing across 5 browser emulations).
  - `TESTING.md` (lines 95-115) enforces strict **Brand & Empathy Assertions ("No Game Overs")**: Zero negative financial jargon (forbidden: "Debt", "Penalty", "Failing", "Over-limit", "Deficit"; approved: "Flow", "Pace", "Reallocate", "Borrowed", "Slow down") and global empathetic error catch-alls.
  - `TESTING.md` (lines 166-175) highlights **Hydration Locks for Webkit Stability**: Waiting for `isMounted` and `#hydrated-marker` before interacting with DOM elements.
- **Calculator UI & Worker (`src/app/calculator/CalculatorParams.tsx`, `src/workers/simulation.worker.ts`)**:
  - `CalculatorParams.tsx` uses `nuqs` (`useQueryStates`) to synchronize form state directly with URL search parameters (`?initialPortfolio=1000000&duration=30...`).
  - `simulation.worker.ts` is a Web Worker exposed via `Comlink` that calculates simulation years and transfers results (`SimulationSummary`) back to the main thread using zero-copy `Float64Array` buffers.

## 2. Logic Chain
Based on the observations, we deduce the following architectural and implementation strategy for `TEST_INFRA.md`, `e2e/verify_accumulation.ts`, and `e2e/verify_monte_carlo.ts`:

1. **`TEST_INFRA.md` Structure & 4-Tier Methodology**:
   - To comply with `TESTING.md` and the task objective, `TEST_INFRA.md` must be structured around the 4-tier methodology, categorizing test cases into Tier 1 (Jest Unit), Tier 2 (Targeted E2E), Tier 3 (Pre-Push Smoke), and Tier 4 (Cloud CI/CD).
   - To satisfy the requirement of at least 38 test cases across the 3 main features (R1, R2, R3), we must define a granular matrix covering CSV parsing, Zod schema validation, Web Worker math, nuqs URL persistence, UI toggles/grey-out logic, cross-browser compatibility, CLS bounding box checks, and An-yen empathy/jargon assertions.
2. **`e2e/verify_accumulation.ts` Design**:
   - As a standalone automated verification script, it should be executable via `npx tsx e2e/verify_accumulation.ts`.
   - It must use Playwright's `chromium.launch()` to spawn a headless browser, navigate to `http://localhost:3000/calculator?timelineMode=retirement_and_accumulation&currentAge=30&retirementAge=50&duration=50&additionalContribution=15000&initialPortfolio=100000`, wait for `#hydrated-marker`, and verify the calculation results.
   - To verify the accumulation phase accurately, it must assert that for years 1 to 20 (ages 30 to 49), `withdrawal` is exactly `0`, and `endBalance` correctly compounds `startBalance` + `15000` with market growth. At year 21 (age 50), it must assert that withdrawals begin according to the selected strategy.
3. **`e2e/verify_monte_carlo.ts` Design**:
   - Executable via `npx tsx e2e/verify_monte_carlo.ts`, it must navigate to `http://localhost:3000/calculator?simulationMode=monte_carlo&duration=30&initialPortfolio=1000000`.
   - It must verify that the simulation engine generates exactly 1,000 runs (`totalRuns === 1000`).
   - To prove determinism and reproducibility (via Mulberry32 PRNG), the script must record the `medianEndingBalance`, `worstEndingBalance`, and `bestEndingBalance`, perform a page reload/second navigation, extract the second set of results, and assert that the values are **exactly identical**.
4. **Testability Hook Recommendation (`window.__SIMULATION_RESULT__`)**:
   - To enable precise mathematical assertions in `verify_accumulation.ts` and `verify_monte_carlo.ts` without brittle DOM scraping of formatted currency strings, `SimulationProvider.tsx` should attach the raw `SimulationSummary` object to `window.__SIMULATION_RESULT__` during development/testing.

## 3. Caveats
- **Pending Feature Implementations**: The underlying features (M2, M3, M4) are currently `PLANNED` or `IN_PROGRESS`. The recommended test scripts and `TEST_INFRA.md` are designed against the agreed interface contracts (`PROJECT.md`) and requirements (`ORIGINAL_REQUEST.md`). The verification scripts will fail until the worker agents complete M1-M4.
- **Port & URL Assumption**: The verification scripts assume the local Next.js development/production server runs on `http://localhost:3000`.

## 4. Conclusion
We recommend creating `TEST_INFRA.md` at the project root with the 38 detailed test cases structured across the 4 tiers, and implementing `e2e/verify_accumulation.ts` and `e2e/verify_monte_carlo.ts` as standalone Playwright TSX scripts.

### Recommended `TEST_INFRA.md` Content
```markdown
# Comprehensive E2E Test Infrastructure & 4-Tier Test Suite

This document defines the comprehensive opaque-box test suite for the Retirement Calculator Expansion, structured around our **4-Tier Productivity Workflow** and enforcing strict **An-yen Brand & Empathy Assertions ("No Game Overs")**.

## 4-Tier Productivity Workflow
1. **Tier 1: Local Watch-Mode Unit Testing (< 2s)**: Jest & React Testing Library (`npm run test:watch`).
2. **Tier 2: Targeted Single-Spec E2E (< 5s)**: Playwright Desktop Chromium (`npx playwright test --project=chromium`).
3. **Tier 3: Automated Git Pre-Push Smoke Tests (~15s)**: Husky / Lefthook pre-push hooks.
4. **Tier 4: Asynchronous Cloud CI/CD Auditing**: Full multi-browser cross-compatibility run (`CI=true npx tsx e2e/run_e2e.ts`).

---

## Test Case Matrix (38 Test Cases)

### Feature 1: Global Market Data Toggle (R1)
| ID | Tier | Target / Module | Description | Empathy & Brand Assertion |
|---|---|---|---|---|
| TC01 | Tier 1 | `globalMarketData.ts` | Verify correct parsing of `chart.csv` (MSCI World Index starting 12/1969). | N/A |
| TC02 | Tier 1 | `globalMarketData.ts` | Verify monthly returns are correctly compounded into annual growth rates and CPI metrics. | N/A |
| TC03 | Tier 1 | `marketData.ts` | Verify `getMarketData('global', year)` returns MSCI World data and `getMarketData('us', year)` returns Shiller data. | N/A |
| TC04 | Tier 1 | `marketData.ts` | Verify `getValidStartYears('global', 30)` correctly restricts start years to 1970–(2025-30+1). | N/A |
| TC05 | Tier 1 | `simulationSchema.ts` | Verify Zod schema `marketDataMode` accepts `'us'` and `'global'`, defaulting to `'us'`. | N/A |
| TC06 | Tier 1 | `CalculatorParams.tsx` | Verify Global Market Data toggle renders correctly in the general input section with proper ARIA labels. | Zero forbidden terms used in toggle label. |
| TC07 | Tier 2 | `CalculatorParams.tsx` | Verify clicking the Global Market Data toggle updates URL query params (`?marketDataMode=global`) via nuqs without full page reload. | N/A |
| TC08 | Tier 2 | `CalculatorParams.tsx` | Verify switching to Global Market Data triggers Web Worker recalculation and updates `SummaryView` with MSCI World results. | N/A |
| TC09 | Tier 2 | `CalculatorParams.tsx` | Verify switching to Global Market Data dynamically restricts `Start Year Min` input to 1970 in the UI. | N/A |
| TC10 | Tier 3 | `CalculatorParams.tsx` | Smoke test: Verify toggle exists, defaults to US, switches to Global cleanly, and maintains An-yen jargon compliance. | Ensure no "Failing" or "Deficit" text appears on switch. |
| TC11 | Tier 4 | Cross-Browser | Verify Global Market Data toggle functions across Chromium, Firefox, Safari, Mobile Chrome, and Mobile Safari with correct hydration locks. | N/A |
| TC12 | Tier 4 | Mobile Viewport | Verify Global Market Data toggle layout and text do not overlap or cause CLS on Mobile Safari (375x812). | N/A |

### Feature 2: Accumulation Phase & Timeline Calculation Toggle (R2)
| ID | Tier | Target / Module | Description | Empathy & Brand Assertion |
|---|---|---|---|---|
| TC13 | Tier 1 | `simulationSchema.ts` | Verify Zod schema validates `timelineMode`, `currentAge`, `retirementAge`, and `additionalContribution`. | N/A |
| TC14 | Tier 1 | `simulationSchema.ts` | Verify Zod refinement enforces `currentAge < retirementAge` when `timelineMode === 'retirement_and_accumulation'`. | N/A |
| TC15 | Tier 1 | `simulation.worker.ts` | Verify accumulation years apply 0 withdrawals, add `additionalContribution`, and compound market growth. | N/A |
| TC16 | Tier 1 | `simulation.worker.ts` | Verify transition from accumulation to retirement correctly initiates withdrawal strategy in the first retirement year. | N/A |
| TC17 | Tier 1 | `CalculatorParams.tsx` | Verify `currentAge`, `retirementAge`, and `additionalContribution` inputs are disabled/greyed out when `timelineMode === 'retirement_only'`. | N/A |
| TC18 | Tier 1 | `CalculatorParams.tsx` | Verify accumulation inputs become active and required when `timelineMode === 'retirement_and_accumulation'`. | N/A |
| TC19 | Tier 2 | `CalculatorParams.tsx` | Verify toggling to `Retirement & Accumulation Period` updates URL (`?timelineMode=retirement_and_accumulation`) and enables inputs. | N/A |
| TC20 | Tier 2 | `CalculatorParams.tsx` | Verify entering `currentAge=30`, `retirementAge=50`, `additionalContribution=15000` reflects in nuqs URL and persists across reload. | N/A |
| TC21 | Tier 2 | `SummaryView.tsx` | Verify `SummaryView` and `AvailableSpendingView` show $0 withdrawals during the accumulation phase years (years 1 to 20). | N/A |
| TC22 | Tier 2 | `PortfolioValueView` | Verify `PortfolioValueView` shows portfolio growth reflecting `initialPortfolio` + contributions + market interest over accumulation years. | N/A |
| TC23 | Tier 3 | `CalculatorParams.tsx` | Smoke test: Verify timeline toggle switches modes cleanly, greys out fields appropriately, and displays zero negative financial jargon. | Asserts zero negative jargon in accumulation views. |
| TC24 | Tier 4 | Cross-Browser | Verify timeline toggle and dynamic input enabling/disabling work across all 5 browser emulations. | N/A |
| TC25 | Tier 4 | CLS Defense | Verify toggling timeline modes does not trigger Cumulative Layout Shift exceeding `1.0px` vertical shift in the parent container. | N/A |

### Feature 3: Simulation Mode Toggle (Historical Backtesting vs. Scrambled Monte Carlo) (R3)
| ID | Tier | Target / Module | Description | Empathy & Brand Assertion |
|---|---|---|---|---|
| TC26 | Tier 1 | `simulationSchema.ts` | Verify Zod schema validates `simulationMode` (`'historical' | 'monte_carlo'`). | N/A |
| TC27 | Tier 1 | `mulberry32.ts` | Verify Mulberry32 PRNG produces deterministic, uniformly distributed values for a given seed. | N/A |
| TC28 | Tier 1 | `simulation.worker.ts` | Verify `simulationMode === 'monte_carlo'` executes exactly 1,000 simulation runs. | N/A |
| TC29 | Tier 1 | `simulation.worker.ts` | Verify two separate simulation calls with identical configs in `monte_carlo` mode return identical ending balances. | N/A |
| TC30 | Tier 1 | `simulation.worker.ts` | Verify Monte Carlo mode correctly samples annual market returns from the selected market data pool (US or Global). | N/A |
| TC31 | Tier 1 | `CalculatorParams.tsx` | Verify Simulation Mode toggle renders correctly in the UI with clear distinction between Historical and Monte Carlo. | N/A |
| TC32 | Tier 2 | `CalculatorParams.tsx` | Verify clicking Scrambled Monte Carlo updates URL (`?simulationMode=monte_carlo`) and triggers Web Worker calculation. | N/A |
| TC33 | Tier 2 | `SummaryView.tsx` | Verify `SummaryView`, `PortfolioValueView`, `AvailableSpendingView`, `SimulationsListView` seamlessly render 1,000 runs without lag. | N/A |
| TC34 | Tier 2 | `SummaryView.tsx` | Verify reloading the page with `?simulationMode=monte_carlo` displays the exact same median, worst, and best ending balances. | N/A |
| TC35 | Tier 3 | `CalculatorParams.tsx` | Smoke test: Verify Simulation Mode toggle switches cleanly, executes worker successfully, and adheres to empathy rules. | Asserts no "Failing" or "Deficit" labels in worst-case Monte Carlo runs. |
| TC36 | Tier 4 | Cross-Browser | Verify Web Worker spawning and 1,000 Monte Carlo run rendering succeed across all 5 browser emulations. | N/A |
| TC37 | Tier 4 | Cross-Browser | Verify combining `marketDataMode=global`, `timelineMode=retirement_and_accumulation`, `simulationMode=monte_carlo` executes successfully. | N/A |
| TC38 | Tier 4 | Accessibility | Verify the fully expanded Monte Carlo + Global + Accumulation UI passes `@axe-core/playwright` accessibility audits (0 violations). | Asserts 0 WCAG violations and 0 forbidden financial terms. |
```

### Recommended `e2e/verify_accumulation.ts` Implementation
```typescript
import { chromium } from '@playwright/test';

async function verifyAccumulation() {
  console.log('\n=== [E2E VERIFICATION] Starting Accumulation Phase Verification ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Navigate to Calculator with Accumulation Mode active
    const targetUrl = 'http://localhost:3000/calculator?timelineMode=retirement_and_accumulation&currentAge=30&retirementAge=50&duration=50&additionalContribution=15000&initialPortfolio=100000';
    console.log(`Navigating to: ${targetUrl}`);
    await page.goto(targetUrl);

    // Wait for hydration and simulation calculation to complete
    await page.waitForSelector('#hydrated-marker', { state: 'attached', timeout: 15000 });
    await page.waitForFunction(() => (window as any).__SIMULATION_RESULT__ !== undefined, { timeout: 30000 });

    const result = await page.evaluate(() => (window as any).__SIMULATION_RESULT__);
    
    if (!result || !result.runs || result.runs.length === 0) {
      throw new Error('Simulation results not found on window.__SIMULATION_RESULT__');
    }

    console.log(`Analyzing ${result.runs.length} simulation runs...`);
    const firstRun = result.runs[0];

    // Assert Years 1-20 (Accumulation Phase)
    for (let age = 1; age <= 20; age++) {
      const yearData = firstRun.years[age - 1];
      if (yearData.withdrawal !== 0) {
        throw new Error(`Verification Failed: Withdrawal in accumulation year ${age} was ${yearData.withdrawal}, expected 0.`);
      }
      if (yearData.endBalance <= yearData.startBalance) {
        throw new Error(`Verification Failed: Portfolio did not grow in accumulation year ${age}. Start: ${yearData.startBalance}, End: ${yearData.endBalance}`);
      }
    }
    console.log('✓ Verified Years 1-20: Zero withdrawals applied, contributions added, and returns compounded successfully.');

    // Assert Year 21+ (Retirement Phase)
    const firstRetirementYear = firstRun.years[20];
    if (firstRetirementYear.withdrawal <= 0) {
      throw new Error(`Verification Failed: Withdrawal in first retirement year (age 50) was ${firstRetirementYear.withdrawal}, expected > 0.`);
    }
    console.log(`✓ Verified Year 21 (Age 50): Retirement withdrawals initiated successfully ($${firstRetirementYear.withdrawal.toFixed(2)}).`);

    console.log('=== [VERIFICATION SUCCESS] Accumulation phase verified successfully ===\n');
    process.exit(0);
  } catch (error) {
    console.error('=== [VERIFICATION FAILURE] Accumulation phase verification failed ===');
    console.error(error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verifyAccumulation();
```

### Recommended `e2e/verify_monte_carlo.ts` Implementation
```typescript
import { chromium } from '@playwright/test';

async function verifyMonteCarlo() {
  console.log('\n=== [E2E VERIFICATION] Starting Scrambled Monte Carlo Verification ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. First Invocation
    const targetUrl = 'http://localhost:3000/calculator?simulationMode=monte_carlo&duration=30&initialPortfolio=1000000';
    console.log(`Navigating to: ${targetUrl}`);
    await page.goto(targetUrl);

    await page.waitForSelector('#hydrated-marker', { state: 'attached', timeout: 15000 });
    await page.waitForFunction(() => (window as any).__SIMULATION_RESULT__ !== undefined, { timeout: 30000 });

    const result1 = await page.evaluate(() => (window as any).__SIMULATION_RESULT__);
    
    if (!result1 || !result1.runs) {
      throw new Error('Simulation results not found on window.__SIMULATION_RESULT__');
    }

    console.log(`Run 1 completed. Total Runs: ${result1.totalRuns}`);
    if (result1.totalRuns !== 1000) {
      throw new Error(`Verification Failed: Expected exactly 1,000 runs, but got ${result1.totalRuns}.`);
    }
    console.log('✓ Verified exactly 1,000 simulation runs generated.');

    const median1 = result1.medianEndingBalance;
    const worst1 = result1.worstEndingBalance;
    const best1 = result1.bestEndingBalance;
    console.log(`Run 1 Metrics -> Median: $${median1.toFixed(2)}, Worst: $${worst1.toFixed(2)}, Best: $${best1.toFixed(2)}`);

    // 2. Second Invocation (Reload to test determinism)
    console.log('\nReloading page to verify Mulberry32 PRNG determinism...');
    await page.reload();
    await page.waitForSelector('#hydrated-marker', { state: 'attached', timeout: 15000 });
    await page.waitForFunction(() => (window as any).__SIMULATION_RESULT__ !== undefined, { timeout: 30000 });

    const result2 = await page.evaluate(() => (window as any).__SIMULATION_RESULT__);
    
    const median2 = result2.medianEndingBalance;
    const worst2 = result2.worstEndingBalance;
    const best2 = result2.bestEndingBalance;
    console.log(`Run 2 Metrics -> Median: $${median2.toFixed(2)}, Worst: $${worst2.toFixed(2)}, Best: $${best2.toFixed(2)}`);

    if (median1 !== median2 || worst1 !== worst2 || best1 !== best2) {
      throw new Error('Verification Failed: Monte Carlo results were not deterministic across reloads.');
    }
    console.log('✓ Verified Determinism: Run 1 and Run 2 metrics are exactly identical.');

    console.log('=== [VERIFICATION SUCCESS] Scrambled Monte Carlo verified successfully ===\n');
    process.exit(0);
  } catch (error) {
    console.error('=== [VERIFICATION FAILURE] Scrambled Monte Carlo verification failed ===');
    console.error(error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verifyMonteCarlo();
```

## 5. Verification Method
To independently verify the recommendations once implemented by the worker agents:
1. **Verify `TEST_INFRA.md`**: Inspect `TEST_INFRA.md` at the project root to ensure all 38 test cases are present and correctly formatted.
2. **Verify Accumulation Script**: Run `npx tsx e2e/verify_accumulation.ts`. It must exit with code `0` and print `=== [VERIFICATION SUCCESS] Accumulation phase verified successfully ===`.
3. **Verify Monte Carlo Script**: Run `npx tsx e2e/verify_monte_carlo.ts`. It must exit with code `0` and print `=== [VERIFICATION SUCCESS] Scrambled Monte Carlo verified successfully ===`.
4. **Verify Full E2E Suite**: Run `npx tsx e2e/run_e2e.ts` to ensure all existing and new Playwright tests pass successfully with zero brand/empathy violations.
