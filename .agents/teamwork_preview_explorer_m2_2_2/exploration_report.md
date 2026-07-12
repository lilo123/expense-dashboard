# M2.2 Web Worker Simulation Engine — Detailed Exploration Report

## 1. Executive Summary
This report provides a comprehensive architectural analysis and implementation strategy for the M2.2 Web Worker Simulation Engine. The objective is to establish a high-performance, zero-copy Monte Carlo simulation engine within a Web Worker (`src/lib/planner/simulation.worker.ts`) and ensure 100% unit test coverage via a dedicated test suite (`__tests__/planner/simulationWorker.spec.ts`).

## 2. Codebase Investigation & Context
Our investigation examined the core domain types, existing simulation logic, and empirical market data structures:
- **`src/lib/planner/types.ts`**: Defines Zod schemas and TypeScript interfaces for `Household`, `SimulationConfig`, `SimulationResultsSummary`, etc.
- **`src/content/historicalMarketData.ts`**: Contains `historicalMarketData` (a `Float64Array` of length 375 representing 125 years of interleaved stocks, bonds, and inflation data) and `HISTORICAL_RANGES`.
- **`src/lib/planner/simulator.ts`**: Implements `simulatePath`, the core annual simulation loop that executes the drawdown engine (`calculateAnnualDrawdown`).
- **`package.json`**: Confirms the use of Jest for unit testing (`npm run test`).

## 3. Key Technical Requirements & Architectural Blueprint

### Requirement 1: Web Worker Message Contract
- **Contract**: `{ action: 'simulate', config: SimulationConfig, marketData: Float64Array, household?: Household }`.
- **Implementation Strategy**:
  - Export a standalone `handleMessage(event: MessageEvent, scope: any = self): void` function to facilitate seamless unit testing.
  - Implement validation checks on `event.data`. If `action !== 'simulate'`, return `{ error: 'Unsupported action' }`. If `!config || !marketData`, return `{ error: 'Missing config or marketData' }`.
  - Handle optional `household`: If `household` is omitted, construct a fully valid default `Household` object adhering to `HouseholdSchema`.

### Requirement 2: Monte Carlo Simulation Engine
- **Requirement**: Execute 1,000 block bootstrap simulation paths sampling from `marketData` based on `config.historicalRange`.
- **Implementation Strategy**:
  - Determine the active market data slice. If the incoming `marketData.length === 375`, slice it using `HISTORICAL_RANGES[config.historicalRange]`. If already sliced by the caller (e.g. `getMarketDataCopy`), use it directly.
  - Iterate `p` from `0` to `config.numPaths - 1` (defaulting to 1000). Use deterministic block bootstrap sampling (`(p * 7) % numYears`) to construct a 30-year `marketReturns` array (using a 60/40 stocks/bonds allocation: `0.6 * stocks + 0.4 * bonds`).
  - Execute `simulatePath(activeHousehold, marketReturns, config, p)` for each path.

### Requirement 3: Performance & IPC (In-place Sorting & Transferable Objects)
- **Requirement**: Use in-place numerical sorting (`subarray().sort()`) for calculating percentiles (p10, p50, p90) and Transferable Objects for zero-copy IPC response.
- **Implementation Strategy**:
  - Allocate a single flat `Float64Array` buffer of size `numPaths * (1 + horizon)` to store all final balances and annual ending balances.
  - Populate `buffer[p] = res.finalBalance` and `buffer[numPaths + i * numPaths + p] = res.annualResults[i].endingBalance`.
  - Extract views using `buffer.subarray(...)` and call `.sort()` to sort numerically in-place with zero memory allocation overhead.
  - Compute `p10`, `p50`, and `p90` indices (`Math.floor(numPaths * 0.10)`, etc.).
  - Transmit the result back to the main thread via `scope.postMessage({ summary, buffer: buffer.buffer }, [buffer.buffer])`, detaching the buffer for zero-copy IPC.

### Requirement 4: Drawdown & Cash Flows
- **Requirement**: Support `SimulationConfig` drawdown strategies (`taxable_first`, `proportional`, `tax_deferred_first`), inflation adjustments, and optional `Household` cash flows.
- **Implementation Strategy**:
  - By directly passing `activeHousehold` and `config` to `simulatePath`, the Web Worker inherently delegates to `calculateAnnualDrawdown`, fully supporting all drawdown strategies, tax calculations, inflation adjustments, and cash flows (accounts, spending, pensions, lifeEvents).

### Requirement 5: Comprehensive Unit Testing
- **Requirement**: Plan `__tests__/planner/simulationWorker.spec.ts` to mock/test the Web Worker and verify 100% passing test coverage.
- **Implementation Strategy**:
  - Import `handleMessage` from `simulation.worker.ts`.
  - Construct a mock scope object `const mockScope = { postMessage: jest.fn() }`.
  - Design three comprehensive test suites:
    1. **Suite 1: Valid Simulation Execution (Full Market Data)**: Verify successful simulation, verify `postMessage` receives `summary` and `buffer`, and validate `summary` against `SimulationResultsSummarySchema`.
    2. **Suite 2: Valid Simulation Execution (Sliced Market Data & Explicit Household)**: Provide custom household with pensions/spending and sliced market data (`getMarketDataCopy('most_recent_20_years')`).
    3. **Suite 3: Error Handling & Edge Cases**: Test invalid actions (`action: 'invalid'`) and missing payload properties (`config`/`marketData`), verifying appropriate error responses.

## 4. Proposed File Implementations

### A. `src/lib/planner/simulation.worker.ts`
```typescript
import { Household, SimulationConfig, SimulationResultsSummary } from './types';
import { simulatePath } from './simulator';
import { HISTORICAL_RANGES } from '../../content/historicalMarketData';

export interface SimulationWorkerMessage {
  action: string;
  config: SimulationConfig;
  marketData: Float64Array;
  household?: Household;
}

export function handleMessage(event: MessageEvent<SimulationWorkerMessage>, scope: any = self): void {
  const { action, config, marketData, household } = event.data;

  if (action !== 'simulate') {
    scope.postMessage({ error: 'Unsupported action' });
    return;
  }

  if (!config || !marketData) {
    scope.postMessage({ error: 'Missing config or marketData' });
    return;
  }

  const activeHousehold: Household = household ?? {
    name: 'Default Simulation Household',
    taxJurisdiction: 'US',
    stateProvince: 'NY',
    birthYear: 1965,
    retirementAge: 65,
    includeSpouse: false,
    horizonMode: 'fixed_years',
    accounts: [
      { id: 'taxable_base', name: 'Existing Portfolio', type: 'taxable', balance: 1000000, costBasis: 1000000, owner: 'primary' },
    ],
    spending: {
      initialBase: 40000,
      strategy: 'constant_dollar',
      inflationAdjusted: true,
    },
    simulationConfig: config,
  };

  let activeMarketData = marketData;
  if (activeMarketData.length === 375) {
    const rangeMeta = HISTORICAL_RANGES[config.historicalRange ?? 'all_125_years'];
    if (rangeMeta) {
      activeMarketData = activeMarketData.subarray(rangeMeta.startIndex, rangeMeta.endIndex);
    }
  }

  const numPaths = config.numPaths ?? 1000;
  const horizon = config.retirementHorizon ?? 30;
  const numYears = Math.floor(activeMarketData.length / 3);

  // Allocate single flat Float64Array buffer for final balances and annual ending balances
  const buffer = new Float64Array(numPaths * (1 + horizon));
  let successfulPaths = 0;

  for (let p = 0; p < numPaths; p++) {
    const startYr = (p * 7) % numYears;
    const marketReturns: number[] = [];
    for (let i = 0; i < horizon; i++) {
      const yr = (startYr + i) % numYears;
      const stocks = activeMarketData[yr * 3];
      const bonds = activeMarketData[yr * 3 + 1];
      marketReturns.push(0.6 * stocks + 0.4 * bonds);
    }

    const res = simulatePath(activeHousehold, marketReturns, config, p);
    if (res.success) {
      successfulPaths++;
    }

    buffer[p] = res.finalBalance;
    for (let i = 0; i < horizon; i++) {
      if (res.annualResults[i]) {
        buffer[numPaths + i * numPaths + p] = res.annualResults[i].endingBalance;
      }
    }
  }

  // Calculate percentiles using in-place numerical sorting (subarray().sort())
  const finalBalancesView = buffer.subarray(0, numPaths);
  finalBalancesView.sort();

  const p10Index = Math.floor(numPaths * 0.10);
  const p50Index = Math.floor(numPaths * 0.50);
  const p90Index = Math.floor(numPaths * 0.90);

  const tenthPercentileFinalBalance = finalBalancesView[p10Index] ?? 0;
  const medianFinalBalance = finalBalancesView[p50Index] ?? 0;
  const ninetiethPercentileFinalBalance = finalBalancesView[p90Index] ?? 0;
  const successRate = (successfulPaths / numPaths) * 100;

  const baseYear = activeHousehold.birthYear + activeHousehold.retirementAge;
  const annualEndingBalances = [];

  for (let i = 0; i < horizon; i++) {
    const yearView = buffer.subarray(numPaths + i * numPaths, numPaths + (i + 1) * numPaths);
    yearView.sort();
    annualEndingBalances.push({
      year: baseYear + i,
      p10: yearView[p10Index] ?? 0,
      p50: yearView[p50Index] ?? 0,
      p90: yearView[p90Index] ?? 0,
    });
  }

  const summary: SimulationResultsSummary = {
    successRate,
    medianFinalBalance,
    tenthPercentileFinalBalance,
    ninetiethPercentileFinalBalance,
    annualEndingBalances,
  };

  // Transferable Object IPC Response
  scope.postMessage({ summary, buffer: buffer.buffer }, [buffer.buffer]);
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', (event: MessageEvent) => {
    handleMessage(event, self);
  });
}
```

### B. `__tests__/planner/simulationWorker.spec.ts`
```typescript
import { handleMessage } from '../../src/lib/planner/simulation.worker';
import { historicalMarketData, getMarketDataCopy } from '../../src/content/historicalMarketData';
import { SimulationConfig, Household, SimulationResultsSummarySchema } from '../../src/lib/planner/types';

describe('Simulation Web Worker Specification (M2.2)', () => {
  let mockScope: { postMessage: jest.Mock };

  beforeEach(() => {
    mockScope = { postMessage: jest.fn() };
  });

  describe('Suite 1: Valid Simulation Execution (Full Market Data)', () => {
    it('Test 1.1: Verify successful simulation execution and transferable object response', () => {
      const config: SimulationConfig = {
        drawdownStrategy: 'taxable_first',
        historicalRange: 'all_125_years',
        numPaths: 10,
        inflationRate: 0.025,
        retirementHorizon: 30,
      };

      const event = {
        data: {
          action: 'simulate',
          config,
          marketData: historicalMarketData,
        },
      } as any;

      handleMessage(event, mockScope);

      expect(mockScope.postMessage).toHaveBeenCalledTimes(1);
      const payload = mockScope.postMessage.mock.calls[0][0];

      expect(payload).toHaveProperty('summary');
      expect(payload).toHaveProperty('buffer');
      expect(payload.buffer).toBeInstanceOf(ArrayBuffer);

      const parseResult = SimulationResultsSummarySchema.safeParse(payload.summary);
      expect(parseResult.success).toBe(true);
      expect(payload.summary.annualEndingBalances).toHaveLength(30);
    });
  });

  describe('Suite 2: Valid Simulation Execution (Sliced Market Data & Explicit Household)', () => {
    it('Test 2.1: Verify simulation with explicit household, pensions, and sliced market data', () => {
      const config: SimulationConfig = {
        drawdownStrategy: 'proportional',
        historicalRange: 'most_recent_20_years',
        numPaths: 5,
        inflationRate: 0.03,
        retirementHorizon: 20,
      };

      const household: Household = {
        name: 'Worker Custom Household',
        taxJurisdiction: 'US',
        stateProvince: 'CA',
        birthYear: 1960,
        retirementAge: 65,
        includeSpouse: false,
        horizonMode: 'fixed_years',
        accounts: [
          { id: 'taxable_1', name: 'Brokerage', type: 'taxable', balance: 800000, costBasis: 600000, owner: 'primary' },
          { id: 'tax_deferred_1', name: 'IRA', type: 'tax_deferred', balance: 400000, costBasis: 400000, owner: 'primary' },
        ],
        pensions: [
          { id: 'ss_1', owner: 'primary', type: 'social_security', baseAmount: 25000, startAge: 65, inflationAdjusted: true },
        ],
        spending: {
          initialBase: 50000,
          strategy: 'constant_dollar',
          inflationAdjusted: true,
        },
        simulationConfig: config,
      };

      const slicedMarketData = getMarketDataCopy('most_recent_20_years');

      const event = {
        data: {
          action: 'simulate',
          config,
          marketData: slicedMarketData,
          household,
        },
      } as any;

      handleMessage(event, mockScope);

      expect(mockScope.postMessage).toHaveBeenCalledTimes(1);
      const payload = mockScope.postMessage.mock.calls[0][0];
      expect(payload.summary.annualEndingBalances).toHaveLength(20);
      expect(payload.summary.successRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Suite 3: Error Handling & Edge Cases', () => {
    it('Test 3.1: Verify error response for unsupported action', () => {
      const event = {
        data: {
          action: 'unsupported_action',
          config: { drawdownStrategy: 'taxable_first', historicalRange: 'all_125_years', numPaths: 10, inflationRate: 0.025, retirementHorizon: 30 },
          marketData: historicalMarketData,
        },
      } as any;

      handleMessage(event, mockScope);

      expect(mockScope.postMessage).toHaveBeenCalledTimes(1);
      expect(mockScope.postMessage).toHaveBeenCalledWith({ error: 'Unsupported action' });
    });

    it('Test 3.2: Verify error response for missing config or marketData', () => {
      const event = {
        data: {
          action: 'simulate',
          config: undefined,
          marketData: undefined,
        },
      } as any;

      handleMessage(event, mockScope);

      expect(mockScope.postMessage).toHaveBeenCalledTimes(1);
      expect(mockScope.postMessage).toHaveBeenCalledWith({ error: 'Missing config or marketData' });
    });
  });
});
```
