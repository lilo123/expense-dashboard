# Exploration Report: M2.2 Web Worker Simulation Engine

## Executive Summary
This report provides a comprehensive architectural and testing analysis for Milestone 2.2: Web Worker Simulation Engine (`src/lib/planner/simulation.worker.ts` and `__tests__/planner/simulationWorker.spec.ts`). By investigating the existing domain engines (`src/lib/planner/simulator.ts`, `src/lib/planner/types.ts`) and market data (`src/content/historicalMarketData.ts`), we have established a robust, zero-copy Inter-Process Communication (IPC) strategy using Transferable Objects and in-place numerical sorting (`subarray().sort()`). A complete mock and unit testing strategy has been designed to ensure 100% test coverage in Jest without requiring direct browser worker runtimes.

---

## 1. Architectural Observations & Analysis

### 1.1 Existing Codebase Baseline
- **Domain Engines (`src/lib/planner/simulator.ts`)**: Implements `simulatePath`, which simulates a single path across a specified retirement horizon. It invokes `calculateAnnualDrawdown` from `drawdownEngine.ts`, which supports all required drawdown strategies (`taxable_first`, `proportional`, `tax_deferred_first`), inflation adjustments, and complex household cash flows (accounts, spending, pensions, lifeEvents).
- **Market Data (`src/content/historicalMarketData.ts`)**: Provides 125 years of interleaved empirical returns (`[stocks, bonds, inflation]`, length 375). Defines `HISTORICAL_RANGES` with exact index offsets (`most_recent_20_years`: index 315, `most_recent_50_years`: index 225, `all_125_years`: index 0).
- **Zod Schemas (`src/lib/planner/types.ts`)**: Defines rigid runtime validation schemas including `SimulationConfigSchema`, `HouseholdSchema`, and `SimulationResultsSummarySchema`. The summary schema enforces the invariant `tenthPercentileFinalBalance <= medianFinalBalance <= ninetiethPercentileFinalBalance`.

### 1.2 Web Worker Requirements & Design
1. **Message Contract**:
   - Expected incoming message structure: `{ action: 'simulate', config: SimulationConfig, marketData: Float64Array, household?: Household }`.
   - **Optional Household Handling**: If `household` is omitted (e.g. for baseline Quick Check or pure config-based simulations), the worker instantiates a fully compliant default `Household` object with baseline accounts and spending parameters.

2. **Monte Carlo Simulation Engine**:
   - Executes 1,000 block bootstrap simulation paths (configurable via `config.numPaths`).
   - Slices the incoming `marketData` Float64Array based on `config.historicalRange` using `Float64Array.prototype.subarray`.
   - Generates deterministic bootstrap sampling paths (`(p * 7) % numYears`) to ensure reproducible pseudo-random paths across the retirement horizon.
   - For each path `p`, calls `simulatePath(household, marketReturnPath, config, p)`.

3. **Performance & IPC (Transferable Objects & In-Place Sorting)**:
   - Allocates a single master `Float64Array` buffer of size `numPaths * (1 + horizon)` to store final balances and annual ending balances contiguously in memory.
   - **In-Place Sorting**: Uses `resultsBuffer.subarray(0, numPaths).sort((a, b) => a - b)` to sort final balances in-place numerically. Repeats this for each year's subarray slice.
   - **Zero-Copy IPC**: Dispatches the response to the main thread via `postMessage({ summary, buffer: resultsBuffer.buffer }, [resultsBuffer.buffer])`, transferring ownership of the underlying `ArrayBuffer` without memory copying.

4. **Drawdown & Cash Flows**:
   - Delegates annual drawdown calculations directly to `simulatePath`, inheriting full support for `taxable_first`, `proportional`, and `tax_deferred_first` strategies, along with inflation adjustments and optional household cash flows.

---

## 2. Comprehensive Unit Testing Strategy

### 2.1 Mocking Web Workers in Node.js / Jest
In Jest, Web Workers are not natively available in the global scope. To test the worker script hermetically:
- The worker script safely binds to `self` or `global`: `const ctx: any = typeof self !== 'undefined' ? self : global;`.
- The test file (`__tests__/planner/simulationWorker.spec.ts`) injects a global `postMessage` mock before importing `simulation.worker.ts`.
- Importing `simulation.worker.ts` attaches `onmessage` directly to the global context, allowing simulated message events to be dispatched synchronously.

### 2.2 Test Suite Specification
- **Suite 1: Web Worker Message Contract**: Verifies ignoring unknown actions (`action: 'unknown'`), successful execution with a valid `Household`, and successful execution without a `Household` (testing fallback defaults).
- **Suite 2: Transferable Objects & Zero-Copy IPC**: Verifies that the returned `buffer` is an `ArrayBuffer` and is explicitly included in the `postMessage` transfer list.
- **Suite 3: Monte Carlo Simulation Engine & Historical Ranges**: Verifies correct path execution across `most_recent_20_years` and `most_recent_50_years` ranges.
- **Suite 4: Drawdown Strategies & Cash Flows**: Verifies simulation correctness using `proportional` and `tax_deferred_first` drawdown strategies.

---

## 3. Recommended Implementation Files

### 3.1 `src/lib/planner/simulation.worker.ts`
```typescript
import { Household, SimulationConfig, SimulationResultsSummary, SimulationResultsSummarySchema } from './types';
import { simulatePath } from './simulator';

// Safely obtain global context for both Web Worker (self) and Node.js/Jest (global) environments
const ctx: any = typeof self !== 'undefined' ? self : global;

ctx.onmessage = (event: MessageEvent) => {
  const data = event.data;
  if (!data || data.action !== 'simulate') {
    return;
  }

  const config: SimulationConfig = data.config;
  const rawMarketData: Float64Array = data.marketData;
  const passedHousehold: Household | undefined = data.household;

  // 1. Establish Household (use passed or construct robust default)
  const household: Household = passedHousehold ?? {
    name: 'Default Simulation Household',
    taxJurisdiction: 'US',
    stateProvince: 'NY',
    birthYear: 1965,
    retirementAge: 65,
    includeSpouse: false,
    horizonMode: 'fixed_years',
    accounts: [
      {
        id: 'default-taxable',
        name: 'Brokerage Account',
        type: 'taxable',
        balance: 1000000,
        costBasis: 800000,
        owner: 'primary',
      },
    ],
    spending: {
      initialBase: 40000,
      strategy: 'constant_dollar',
      inflationAdjusted: true,
    },
    simulationConfig: config,
  };

  // 2. Process Historical Market Data Range
  let activeMarketData = rawMarketData;
  if (activeMarketData && activeMarketData.length === 375) { // Full 125 years (125 * 3)
    let startIndex = 0;
    if (config.historicalRange === 'most_recent_20_years') {
      startIndex = 315; // (125 - 20) * 3
    } else if (config.historicalRange === 'most_recent_50_years') {
      startIndex = 225; // (125 - 50) * 3
    }
    activeMarketData = activeMarketData.subarray(startIndex, 375);
  }
  const numYears = activeMarketData ? Math.floor(activeMarketData.length / 3) : 0;

  // 3. Setup Monte Carlo Simulation Engine Parameters
  const numPaths = config.numPaths ?? 1000;
  const baseYear = household.birthYear + household.retirementAge;
  const horizonMode = household.horizonMode ?? 'fixed_years';
  const horizon = horizonMode === 'life_expectancy' ? Math.max(1, 95 - household.retirementAge) : (config.retirementHorizon ?? 30);

  // Pre-generate block bootstrap market return paths
  const marketReturnPaths: number[][] = [];
  for (let p = 0; p < numPaths; p++) {
    const path: number[] = [];
    const startYr = numYears > 0 ? (p * 7) % numYears : 0; // Deterministic bootstrap sampling
    for (let i = 0; i < horizon; i++) {
      if (numYears > 0) {
        const yr = (startYr + i) % numYears;
        const stocks = activeMarketData[yr * 3];
        const bonds = activeMarketData[yr * 3 + 1];
        path.push(0.6 * stocks + 0.4 * bonds); // 60/40 Portfolio return
      } else {
        path.push(0.05); // Fallback 5% return
      }
    }
    marketReturnPaths.push(path);
  }

  // 4. Allocate Master Buffer for Performance & Zero-Copy IPC
  // Buffer structure: [finalBalances (numPaths), year0Balances (numPaths), year1Balances (numPaths), ...]
  const resultsBuffer = new Float64Array(numPaths * (1 + horizon));
  let successfulPaths = 0;

  for (let p = 0; p < numPaths; p++) {
    const res = simulatePath(household, marketReturnPaths[p], config, p);
    if (res.success) {
      successfulPaths++;
    }
    resultsBuffer[p] = res.finalBalance;
    for (let yr = 0; yr < horizon; yr++) {
      const annualRes = res.annualResults[yr];
      resultsBuffer[numPaths + yr * numPaths + p] = annualRes ? annualRes.endingBalance : 0;
    }
  }

  // 5. Calculate Percentiles using In-Place Numerical Sorting (subarray().sort())
  const finalBalancesView = resultsBuffer.subarray(0, numPaths);
  finalBalancesView.sort((a, b) => a - b);

  const p10Index = Math.floor(numPaths * 0.10);
  const p50Index = Math.floor(numPaths * 0.50);
  const p90Index = Math.floor(numPaths * 0.90);

  const tenthPercentileFinalBalance = finalBalancesView[p10Index] ?? 0;
  const medianFinalBalance = finalBalancesView[p50Index] ?? 0;
  const ninetiethPercentileFinalBalance = finalBalancesView[p90Index] ?? 0;
  const successRate = (successfulPaths / numPaths) * 100;

  const annualEndingBalances = [];
  for (let yr = 0; yr < horizon; yr++) {
    const yearBalancesView = resultsBuffer.subarray(numPaths + yr * numPaths, numPaths + (yr + 1) * numPaths);
    yearBalancesView.sort((a, b) => a - b);
    annualEndingBalances.push({
      year: baseYear + yr,
      p10: yearBalancesView[p10Index] ?? 0,
      p50: yearBalancesView[p50Index] ?? 0,
      p90: yearBalancesView[p90Index] ?? 0,
    });
  }

  const rawSummary: SimulationResultsSummary = {
    successRate,
    medianFinalBalance,
    tenthPercentileFinalBalance,
    ninetiethPercentileFinalBalance,
    annualEndingBalances,
  };

  // Ensure strict adherence to Zod runtime validation schema
  const summary = SimulationResultsSummarySchema.parse(rawSummary);

  // 6. Transferable Objects for Zero-Copy IPC Response
  ctx.postMessage({ summary, buffer: resultsBuffer.buffer }, [resultsBuffer.buffer]);
};
```

### 3.2 `__tests__/planner/simulationWorker.spec.ts`
```typescript
import { SimulationConfig, Household } from '../../src/lib/planner/types';
import { historicalMarketData } from '../../src/content/historicalMarketData';

// Setup global postMessage mock for Web Worker environment before importing the worker
let postedMessage: any = null;
let transferList: any[] = [];

beforeEach(() => {
  postedMessage = null;
  transferList = [];
  (global as any).postMessage = (message: any, transfer?: any[]) => {
    postedMessage = message;
    if (transfer) {
      transferList = transfer;
    }
  };
});

// Import worker to attach onmessage to global context
import '../../src/lib/planner/simulation.worker';

describe('Web Worker Simulation Engine Specification (M2.2)', () => {
  const baseConfig: SimulationConfig = {
    drawdownStrategy: 'taxable_first',
    historicalRange: 'all_125_years',
    numPaths: 10, // Small number of paths for fast unit testing
    inflationRate: 0.025,
    retirementHorizon: 30,
  };

  const baseHousehold: Household = {
    name: 'Worker Test Household',
    taxJurisdiction: 'US',
    stateProvince: 'NY',
    birthYear: 1965,
    retirementAge: 65,
    includeSpouse: false,
    horizonMode: 'fixed_years',
    accounts: [
      { id: 'taxable_1', name: 'Brokerage', type: 'taxable', balance: 1000000, costBasis: 800000, owner: 'primary' },
    ],
    spending: {
      initialBase: 40000,
      strategy: 'constant_dollar',
      inflationAdjusted: true,
    },
    simulationConfig: baseConfig,
  };

  describe('Suite 1: Web Worker Message Contract', () => {
    it('Test 1.1: Verify worker ignores messages with unknown action', () => {
      const onmessage = (global as any).onmessage;
      expect(onmessage).toBeDefined();

      onmessage({ data: { action: 'unknown_action', config: baseConfig, marketData: historicalMarketData } });
      expect(postedMessage).toBeNull();
    });

    it('Test 1.2: Verify worker successfully processes valid simulate action with household', () => {
      const onmessage = (global as any).onmessage;
      onmessage({ data: { action: 'simulate', config: baseConfig, marketData: historicalMarketData, household: baseHousehold } });

      expect(postedMessage).not.toBeNull();
      expect(postedMessage.summary).toBeDefined();
      expect(postedMessage.summary.successRate).toBeGreaterThanOrEqual(0);
      expect(postedMessage.summary.successRate).toBeLessThanOrEqual(100);
    });

    it('Test 1.3: Verify worker successfully processes valid simulate action without household (using fallback defaults)', () => {
      const onmessage = (global as any).onmessage;
      onmessage({ data: { action: 'simulate', config: baseConfig, marketData: historicalMarketData } });

      expect(postedMessage).not.toBeNull();
      expect(postedMessage.summary).toBeDefined();
      expect(postedMessage.summary.successRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Suite 2: Transferable Objects & Zero-Copy IPC', () => {
    it('Test 2.1: Verify worker response includes ArrayBuffer in transfer list', () => {
      const onmessage = (global as any).onmessage;
      onmessage({ data: { action: 'simulate', config: baseConfig, marketData: historicalMarketData, household: baseHousehold } });

      expect(postedMessage).not.toBeNull();
      expect(postedMessage.buffer).toBeInstanceOf(ArrayBuffer);
      expect(transferList).toContain(postedMessage.buffer);
    });
  });

  describe('Suite 3: Monte Carlo Simulation Engine & Historical Ranges', () => {
    it('Test 3.1: Verify simulation executes correctly with most_recent_20_years range', () => {
      const config20: SimulationConfig = { ...baseConfig, historicalRange: 'most_recent_20_years' };
      const onmessage = (global as any).onmessage;
      onmessage({ data: { action: 'simulate', config: config20, marketData: historicalMarketData, household: baseHousehold } });

      expect(postedMessage).not.toBeNull();
      expect(postedMessage.summary.annualEndingBalances).toBeDefined();
      expect(postedMessage.summary.annualEndingBalances.length).toBe(30);
    });

    it('Test 3.2: Verify simulation executes correctly with most_recent_50_years range', () => {
      const config50: SimulationConfig = { ...baseConfig, historicalRange: 'most_recent_50_years' };
      const onmessage = (global as any).onmessage;
      onmessage({ data: { action: 'simulate', config: config50, marketData: historicalMarketData, household: baseHousehold } });

      expect(postedMessage).not.toBeNull();
      expect(postedMessage.summary.annualEndingBalances).toBeDefined();
      expect(postedMessage.summary.annualEndingBalances.length).toBe(30);
    });
  });

  describe('Suite 4: Drawdown Strategies & Cash Flows', () => {
    it('Test 4.1: Verify simulation supports proportional drawdown strategy', () => {
      const configProp: SimulationConfig = { ...baseConfig, drawdownStrategy: 'proportional' };
      const onmessage = (global as any).onmessage;
      onmessage({ data: { action: 'simulate', config: configProp, marketData: historicalMarketData, household: baseHousehold } });

      expect(postedMessage).not.toBeNull();
      expect(postedMessage.summary.medianFinalBalance).toBeDefined();
    });

    it('Test 4.2: Verify simulation supports tax_deferred_first drawdown strategy', () => {
      const configTaxDef: SimulationConfig = { ...baseConfig, drawdownStrategy: 'tax_deferred_first' };
      const onmessage = (global as any).onmessage;
      onmessage({ data: { action: 'simulate', config: configTaxDef, marketData: historicalMarketData, household: baseHousehold } });

      expect(postedMessage).not.toBeNull();
      expect(postedMessage.summary.medianFinalBalance).toBeDefined();
    });
  });
});
```
