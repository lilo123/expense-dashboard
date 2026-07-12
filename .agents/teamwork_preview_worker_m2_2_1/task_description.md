# Task Description: M2.2 Web Worker Simulation Engine Implementation

## Objective
Implement M2.2 Web Worker Simulation Engine by creating `src/lib/planner/simulation.worker.ts` and `__tests__/planner/simulationWorker.spec.ts`. Verify 100% passing test coverage and zero regressions.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Scope Boundaries
- Target files to create/implement: `src/lib/planner/simulation.worker.ts` and `__tests__/planner/simulationWorker.spec.ts`.
- Run verification tests via `npm run test __tests__/planner`.

## Synthesized Architectural Blueprint

### 1. `src/lib/planner/simulation.worker.ts`
```typescript
import { Household, SimulationConfig, SimulationResultsSummary, SimulationResultsSummarySchema } from './types';
import { simulatePath } from './simulator';

export interface SimulationWorkerMessage {
  action: string;
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
    if (!data || data.action !== 'simulate') {
      throw new Error(`Unsupported action: ${data?.action}`);
    }

    if (!data.config || !data.marketData) {
      throw new Error('Missing config or marketData');
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

    const rawSummary: SimulationResultsSummary = {
      successRate,
      medianFinalBalance,
      tenthPercentileFinalBalance,
      ninetiethPercentileFinalBalance,
      annualEndingBalances,
    };

    // Ensure strict adherence to Zod runtime validation schema
    const summary = SimulationResultsSummarySchema.parse(rawSummary);

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

### 2. `__tests__/planner/simulationWorker.spec.ts`
```typescript
import { handleSimulationMessage, SimulationWorkerMessage } from '../../src/lib/planner/simulation.worker';
import { historicalMarketData } from '../../src/content/historicalMarketData';
import { Household, SimulationConfig } from '../../src/lib/planner/types';

describe('Simulation Web Worker Engine (M2.2)', () => {
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

  it('should call onError callback when config or marketData is missing', (done) => {
    const message = {
      action: 'simulate',
      config: undefined,
      marketData: undefined,
    } as unknown as SimulationWorkerMessage;

    handleSimulationMessage(message, () => {}, (error) => {
      expect(error).toBeDefined();
      expect(error.message).toContain('Missing config or marketData');
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

## Output Requirements
- Write your implementation report and `handoff.md` in your working directory: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m2_2_1`.
- Include the exact `npm run test __tests__/planner` execution output in your handoff report.
