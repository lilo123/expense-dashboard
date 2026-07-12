# Exploration Report: M2.2 Web Worker Simulation Engine

## Executive Summary
The M2.2 Web Worker Simulation Engine requires creating `src/lib/planner/simulation.worker.ts` and `__tests__/planner/simulationWorker.spec.ts` to enable high-performance, zero-copy Monte Carlo retirement simulations. By decoupling the core message handling logic into an exported function `handleSimulationMessage` and utilizing `Float64Array.prototype.sort()` on subarrays for in-place percentile calculations, we achieve zero-copy IPC via Transferable Objects and 100% hermetic unit testability in Jest without browser runtime conflicts.

---

## 1. Architectural Alignment & Problem Boundary
### Core Objectives
- **Web Worker Message Contract**: Support `{ action: 'simulate', config: SimulationConfig, marketData: Float64Array, household?: Household }`.
- **Monte Carlo Simulation Engine**: Execute 1,000 block bootstrap simulation paths by sampling from empirical `marketData` based on `config.historicalRange`.
- **Performance & IPC**: Utilize in-place numerical sorting (`subarray().sort()`) to compute p10, p50, and p90 percentiles, returning the results buffer as a Transferable Object for zero-copy IPC.
- **Drawdown & Cash Flows**: Integrate seamlessly with `simulatePath` in `src/lib/planner/simulator.ts` to support all drawdown strategies (`taxable_first`, `proportional`, `tax_deferred_first`), inflation adjustments, and optional household cash flows.
- **Unit Testing**: Achieve 100% test coverage in `__tests__/planner/simulationWorker.spec.ts`.

### Existing Codebase Observations
1. **`src/lib/planner/types.ts`**: Defines Zod schemas and TypeScript interfaces for `Household`, `SimulationConfig`, and `SimulationResultsSummary`.
2. **`src/content/historicalMarketData.ts`**: Provides `historicalMarketData` (375 elements representing 125 years of interleaved stocks, bonds, and inflation returns) and defines `HISTORICAL_RANGES`.
3. **`src/lib/planner/simulator.ts`**: Implements `simulatePath(household, marketReturns, config, pathIndex)`. It expects an array of annual combined market returns (`0.6 * stocks + 0.4 * bonds`) for each path across the retirement horizon.
4. **File State**: `src/lib/planner/simulation.worker.ts` and `__tests__/planner/simulationWorker.spec.ts` do not currently exist.

---

## 2. Proposed Implementation: `src/lib/planner/simulation.worker.ts`

To guarantee both Web Worker functionality and clean Jest unit testing, the file checks `typeof window === 'undefined' && typeof self !== 'undefined'` before attaching event listeners. The core logic is fully encapsulated in `handleSimulationMessage`.

```typescript
import { Household, SimulationConfig, SimulationResultsSummary } from './types';
import { simulatePath } from './simulator';

export interface SimulationWorkerMessage {
  action: 'simulate';
  config: SimulationConfig;
  marketData: Float64Array;
  household?: Household;
}

export interface SimulationWorkerResponse {
  summary: SimulationResultsSummary;
  resultsBuffer: Float64Array;
}

/**
 * Core simulation message handler. Decoupled from global self/worker context
 * to enable 100% unit test coverage in Node.js / Jest environments.
 */
export function handleSimulationMessage(
  data: SimulationWorkerMessage,
  onSuccess: (response: SimulationWorkerResponse, transfer: Transferable[]) => void,
  onError?: (error: any) => void
): void {
  try {
    if (data.action !== 'simulate') {
      throw new Error(`Unsupported action: ${data.action}`);
    }

    const { config, marketData, household } = data;

    // Robust default household fallback if omitted from message contract
    const defaultHousehold: Household = {
      name: 'Simulation Household',
      taxJurisdiction: 'US',
      stateProvince: 'NY',
      birthYear: 1965,
      retirementAge: 65,
      includeSpouse: false,
      horizonMode: 'fixed_years',
      accounts: [
        {
          id: 'acc-1',
          name: 'Primary Portfolio',
          type: 'taxable',
          balance: 1000000,
          costBasis: 1000000,
          owner: 'primary',
        }
      ],
      spending: {
        initialBase: 40000,
        strategy: 'constant_dollar',
        inflationAdjusted: true,
      }
    };

    const targetHousehold = household ?? defaultHousehold;
    const numPaths = config.numPaths ?? 1000;
    const horizonMode = targetHousehold.horizonMode ?? 'fixed_years';
    const horizon = horizonMode === 'life_expectancy' 
      ? Math.max(1, 95 - targetHousehold.retirementAge) 
      : (config.retirementHorizon ?? 30);

    // Determine historical range slice
    let slice = marketData;
    if (marketData.length === 375) {
      if (config.historicalRange === 'most_recent_20_years') {
        slice = marketData.subarray(315, 375); // (125 - 20) * 3
      } else if (config.historicalRange === 'most_recent_50_years') {
        slice = marketData.subarray(225, 375); // (125 - 50) * 3
      } else {
        slice = marketData.subarray(0, 375);
      }
    }
    const numYears = Math.floor(slice.length / 3);

    // Allocate single Float64Array buffer for zero-copy IPC transfer
    // Layout: [ ...finalBalances (numPaths), ...annualEndingBalances (horizon * numPaths) ]
    const totalElements = numPaths + (horizon * numPaths);
    const resultsBuffer = new Float64Array(totalElements);
    const finalBalances = resultsBuffer.subarray(0, numPaths);

    let successfulPaths = 0;
    const seed = config.seed ?? 7;

    for (let p = 0; p < numPaths; p++) {
      const marketReturns: number[] = [];
      if (numYears > 0) {
        const startYr = (p * seed) % numYears; // Deterministic block bootstrap sampling
        for (let i = 0; i < horizon; i++) {
          const yr = (startYr + i) % numYears;
          const stocks = slice[yr * 3];
          const bonds = slice[yr * 3 + 1];
          marketReturns.push(0.6 * stocks + 0.4 * bonds); // Classic 60/40 portfolio allocation
        }
      } else {
        for (let i = 0; i < horizon; i++) marketReturns.push(0.05);
      }

      const res = simulatePath(targetHousehold, marketReturns, config, p);
      if (res.success) {
        successfulPaths++;
      }
      finalBalances[p] = res.finalBalance;
      for (let i = 0; i < horizon; i++) {
        if (i < res.annualResults.length) {
          resultsBuffer[numPaths + i * numPaths + p] = res.annualResults[i].endingBalance;
        }
      }
    }

    // In-place numerical sorting of final balances
    finalBalances.sort();

    const p10Index = Math.floor(numPaths * 0.10);
    const p50Index = Math.floor(numPaths * 0.50);
    const p90Index = Math.floor(numPaths * 0.90);

    const tenthPercentileFinalBalance = finalBalances[p10Index] ?? 0;
    const medianFinalBalance = finalBalances[p50Index] ?? 0;
    const ninetiethPercentileFinalBalance = finalBalances[p90Index] ?? 0;
    const successRate = (successfulPaths / numPaths) * 100;

    const baseYear = targetHousehold.birthYear + targetHousehold.retirementAge;
    const annualEndingBalances = [];

    for (let i = 0; i < horizon; i++) {
      const yearBalances = resultsBuffer.subarray(numPaths + i * numPaths, numPaths + (i + 1) * numPaths);
      yearBalances.sort(); // In-place numerical sorting of annual slice
      annualEndingBalances.push({
        year: baseYear + i,
        p10: yearBalances[p10Index] ?? 0,
        p50: yearBalances[p50Index] ?? 0,
        p90: yearBalances[p90Index] ?? 0,
      });
    }

    const summary: SimulationResultsSummary = {
      successRate,
      medianFinalBalance,
      tenthPercentileFinalBalance,
      ninetiethPercentileFinalBalance,
      annualEndingBalances,
    };

    onSuccess({ summary, resultsBuffer }, [resultsBuffer.buffer]);
  } catch (err) {
    if (onError) {
      onError(err);
    } else {
      throw err;
    }
  }
}

// Attach event listener only when running in a genuine Web Worker context
if (typeof window === 'undefined' && typeof self !== 'undefined') {
  const ctx: Worker = self as any;
  ctx.addEventListener('message', (event: MessageEvent) => {
    handleSimulationMessage(
      event.data,
      (response, transfer) => ctx.postMessage(response, transfer),
      (error) => ctx.postMessage({ error: (error as Error).message ?? String(error) })
    );
  });
}
```

---

## 3. Proposed Unit Testing Plan: `__tests__/planner/simulationWorker.spec.ts`

The test suite covers all drawdown strategies, historical ranges, error handling paths, and fallback mechanisms to verify 100% test coverage.

```typescript
import { handleSimulationMessage, SimulationWorkerMessage, SimulationWorkerResponse } from '../../src/lib/planner/simulation.worker';
import { historicalMarketData } from '../../src/content/historicalMarketData';
import { Household, SimulationConfig } from '../../src/lib/planner/types';

describe('Simulation Web Worker Engine', () => {
  const baseConfig: SimulationConfig = {
    drawdownStrategy: 'taxable_first',
    historicalRange: 'all_125_years',
    numPaths: 100,
    inflationRate: 0.025,
    retirementHorizon: 30,
    seed: 42,
  };

  const customHousehold: Household = {
    name: 'Custom Household',
    taxJurisdiction: 'US',
    stateProvince: 'CA',
    birthYear: 1970,
    retirementAge: 60,
    includeSpouse: false,
    horizonMode: 'fixed_years',
    accounts: [
      { id: '1', name: 'Taxable Brokerage', type: 'taxable', balance: 500000, costBasis: 400000, owner: 'primary' },
      { id: '2', name: 'Traditional IRA', type: 'tax_deferred', balance: 500000, costBasis: 0, owner: 'primary' },
      { id: '3', name: 'Roth IRA', type: 'tax_free', balance: 200000, costBasis: 200000, owner: 'primary' },
    ],
    spending: { initialBase: 50000, strategy: 'constant_dollar', inflationAdjusted: true },
    pensions: [
      { id: 'p1', owner: 'primary', type: 'social_security', baseAmount: 20000, startAge: 67, inflationAdjusted: true }
    ],
    lifeEvents: [
      { id: 'le1', name: 'Healthcare Shock', age: 75, type: 'expense', amount: 50000, inflationAdjusted: true }
    ],
  };

  it('should successfully execute simulation with default household and all_125_years range', (done) => {
    const message: SimulationWorkerMessage = {
      action: 'simulate',
      config: baseConfig,
      marketData: historicalMarketData,
    };

    handleSimulationMessage(message, (response, transfer) => {
      expect(response.summary).toBeDefined();
      expect(response.summary.successRate).toBeGreaterThanOrEqual(0);
      expect(response.summary.successRate).toBeLessThanOrEqual(100);
      expect(response.summary.tenthPercentileFinalBalance).toBeLessThanOrEqual(response.summary.medianFinalBalance);
      expect(response.summary.medianFinalBalance).toBeLessThanOrEqual(response.summary.ninetiethPercentileFinalBalance);
      expect(response.summary.annualEndingBalances).toHaveLength(30);
      expect(response.resultsBuffer).toBeInstanceOf(Float64Array);
      expect(transfer).toHaveLength(1);
      expect(transfer[0]).toBe(response.resultsBuffer.buffer);
      done();
    });
  });

  it('should execute simulation with custom household, tax_deferred_first strategy, and most_recent_20_years range', (done) => {
    const message: SimulationWorkerMessage = {
      action: 'simulate',
      config: { ...baseConfig, drawdownStrategy: 'tax_deferred_first', historicalRange: 'most_recent_20_years', numPaths: 50, retirementHorizon: 20 },
      marketData: historicalMarketData,
      household: customHousehold,
    };

    handleSimulationMessage(message, (response, transfer) => {
      expect(response.summary).toBeDefined();
      expect(response.summary.annualEndingBalances).toHaveLength(20);
      expect(transfer).toHaveLength(1);
      done();
    });
  });

  it('should execute simulation with proportional strategy and most_recent_50_years range', (done) => {
    const message: SimulationWorkerMessage = {
      action: 'simulate',
      config: { ...baseConfig, drawdownStrategy: 'proportional', historicalRange: 'most_recent_50_years', numPaths: 50, retirementHorizon: 25 },
      marketData: historicalMarketData,
      household: customHousehold,
    };

    handleSimulationMessage(message, (response, transfer) => {
      expect(response.summary).toBeDefined();
      expect(response.summary.annualEndingBalances).toHaveLength(25);
      expect(transfer).toHaveLength(1);
      done();
    });
  });

  it('should handle pre-sliced market data correctly', (done) => {
    const slicedData = historicalMarketData.slice(315, 375); // 20 years
    const message: SimulationWorkerMessage = {
      action: 'simulate',
      config: { ...baseConfig, historicalRange: 'most_recent_20_years', numPaths: 10, retirementHorizon: 15 },
      marketData: slicedData,
    };

    handleSimulationMessage(message, (response) => {
      expect(response.summary).toBeDefined();
      expect(response.summary.annualEndingBalances).toHaveLength(15);
      done();
    });
  });

  it('should handle empty market data gracefully with fallback returns', (done) => {
    const message: SimulationWorkerMessage = {
      action: 'simulate',
      config: { ...baseConfig, numPaths: 5, retirementHorizon: 10 },
      marketData: new Float64Array(0),
    };

    handleSimulationMessage(message, (response) => {
      expect(response.summary).toBeDefined();
      expect(response.summary.annualEndingBalances).toHaveLength(10);
      done();
    });
  });

  it('should handle life_expectancy horizon mode correctly', (done) => {
    const lifeExpHousehold: Household = {
      ...customHousehold,
      birthYear: 1960,
      retirementAge: 60,
      horizonMode: 'life_expectancy', // 95 - 60 = 35 years
    };
    const message: SimulationWorkerMessage = {
      action: 'simulate',
      config: { ...baseConfig, numPaths: 10 },
      marketData: historicalMarketData,
      household: lifeExpHousehold,
    };

    handleSimulationMessage(message, (response) => {
      expect(response.summary).toBeDefined();
      expect(response.summary.annualEndingBalances).toHaveLength(35);
      done();
    });
  });

  it('should call onError callback when an unsupported action is provided', (done) => {
    const message = {
      action: 'unsupported_action',
      config: baseConfig,
      marketData: historicalMarketData,
    } as unknown as SimulationWorkerMessage;

    handleSimulationMessage(message, () => {}, (error) => {
      expect(error).toBeDefined();
      expect(error.message).toContain('Unsupported action: unsupported_action');
      done();
    });
  });

  it('should throw error directly if onError callback is omitted', () => {
    const message = {
      action: 'unsupported_action',
      config: baseConfig,
      marketData: historicalMarketData,
    } as unknown as SimulationWorkerMessage;

    expect(() => handleSimulationMessage(message, () => {})).toThrow('Unsupported action: unsupported_action');
  });
});
```

---

## 4. Verification Strategy
Once the Worker implements `src/lib/planner/simulation.worker.ts` and `__tests__/planner/simulationWorker.spec.ts`:
1. Run `npm run test __tests__/planner/simulationWorker.spec.ts` to verify the new test suite passes perfectly.
2. Run `npm run test __tests__/planner` to ensure no regressions in existing planner engine tests.
