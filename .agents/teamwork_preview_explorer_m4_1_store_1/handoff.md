# Milestone 4.1 Explorer Handoff Report: Zustand Store & URL Hydration

## 1. Observation
During our comprehensive read-only investigation of the `expense-dashboard` codebase for Milestone 4.1, we directly observed the following:

- **Missing Files**: `src/store/useRetirementStore.tsx` and `__tests__/planner/useRetirementStore.spec.ts` currently do not exist in the repository (`view_file` returned `no such file or directory`). Both must be created from scratch.
- **Dependencies & Environment**: `package.json` confirms `zustand` version `^5.0.12`, `jest` version `^30.4.2`, and `jest-environment-jsdom` version `^30.4.1`. `tsconfig.json` targets `ES2017` with `module: esnext`, supporting `import.meta.url`. `jest.config.ts` utilizes `next/jest.js` with SWC transformations and `jsdom` test environment.
- **Zod Schemas (`src/lib/planner/types.ts`)**:
  - `HouseholdSchema` (lines 110-139) defines household state including `accounts`, `spending`, `pensions`, `lifeEvents`, and `simulationConfig`.
  - `SimulationConfigSchema` (lines 99-107) defines `drawdownStrategy`, `historicalRange`, `numPaths`, `inflationRate`, `retirementHorizon`, and `seed`.
  - `QuickCheckParamsSchema` (lines 164-170) expects `portfolio`, `withdrawal`, `years`, and an optional `taxJurisdiction`.
- **Web Worker Contracts (`src/lib/planner/simulation.worker.ts`)**:
  - Defines `SimulationWorkerMessage` (`action`, `config`, `marketData`, `household`) and `SimulationWorkerResponse` (`summary`, `resultsBuffer`).
  - Exports `handleSimulationMessage(data, onSuccess, onError)` (lines 20-162) which operates independently of global self/worker context to enable 100% unit test coverage in Node.js/Jest environments.
- **Market Data (`src/content/historicalMarketData.ts`)**:
  - Exports `getMarketDataCopy(range)` (lines 65-68) which returns an independent copy of the historical market data slice suitable for Web Worker transfer or direct fallback simulation.
- **Existing Tests (`__tests__/planner/simulationWorker.spec.ts`)**:
  - Demonstrates invoking `handleSimulationMessage` directly for unit testing simulation logic in Jest without requiring a browser Web Worker runtime.

## 2. Logic Chain
1. **Store Initialization & Architecture**:
   - Since `src/store/useRetirementStore.tsx` must be created from scratch, it should use Zustand v5 (`import { create } from 'zustand'`).
   - To support the dual-representation requirements, the store state must include `household` (initialized to a robust default `Household`), `simulationConfig` (initialized to a default `SimulationConfig`), `activeTab` (defaulting to `'household'`), `simulationResults` (defaulting to `null`), `isSimulating` (defaulting to `false`), and `error` (defaulting to `null`).
   - The store must provide flexible updater actions (`setHousehold`, `setSimulationConfig`) accepting either partial update objects or functional state updaters, alongside direct setters (`setActiveTab`, `setSimulationResults`, `setIsSimulating`, `setError`, `reset`).
2. **Robust URL Hydration (`hydrateFromParams`)**:
   - Based on `QuickCheckParamsSchema` in `types.ts`, the Quick Check widget passes `portfolio`, `withdrawal`, `years`, and `taxJurisdiction` via URL search parameters.
   - To accommodate varied invocation forms from Next.js page searchParams, raw strings, or `URLSearchParams` objects, `hydrateFromParams` should accept `URLSearchParams | { [key: string]: string } | string`.
   - Extracting parameter values and parsing them via `QuickCheckParamsSchema.partial().safeParse` ensures robust validation without failing if a subset of parameters is provided.
   - Upon successful validation, the store updates `household.accounts[0].balance`, `household.accounts[0].costBasis`, `household.spending.initialBase`, `household.taxJurisdiction`, and `simulationConfig.retirementHorizon`. If validation fails, `error` is populated with an appropriate error message.
3. **Web Worker Integration & Seamless Fallback (`runSimulation`)**:
   - In Next.js/Webpack environments, the Web Worker should be instantiated using `new Worker(new URL('../lib/planner/simulation.worker', import.meta.url))`, passing `getMarketDataCopy(simulationConfig.historicalRange)` as a Transferable Object.
   - In Jest / JSDOM unit test environments where `window.Worker` may be undefined or where `new Worker()` throws an exception, `runSimulation` must implement a seamless `fallbackSimulate()` wrapping `handleSimulationMessage`. This guarantees execution without failing the test suite or requiring complex external Web Worker bundling in Jest.
4. **Comprehensive Unit Testing (`__tests__/planner/useRetirementStore.spec.ts`)**:
   - To achieve 100% passing test coverage (`npm run test __tests__/planner`), the test suite must verify:
     - Initial state and all basic setters (`setActiveTab`, `setIsSimulating`, `setError`, `setSimulationResults`, `reset`).
     - Household and SimulationConfig updaters (both partial objects and functional updaters).
     - URL hydration across all input formats (`URLSearchParams`, plain object, raw string), empty parameters, and invalid parameter structures (testing error handling).
     - Simulation execution flows: fallback execution (when `Worker` is undefined), Web Worker success flow (using a mocked `window.Worker`), Web Worker error flows (Worker returning `{ error }`, invalid data structure, `onerror` callback invocation, and `new Worker()` throwing an exception).

## 3. Caveats
- **No caveats.** All file paths, dependencies, Zod schemas, Web Worker contracts, and Jest environment configurations have been thoroughly investigated and verified against the existing codebase.

## 4. Conclusion
The implementation of Milestone 4.1 should proceed by creating two new files: `src/store/useRetirementStore.tsx` and `__tests__/planner/useRetirementStore.spec.ts`.

### Proposed Implementation Details

#### `src/store/useRetirementStore.tsx`
```typescript
import { create } from 'zustand';
import { Household, SimulationConfig, SimulationResultsSummary, QuickCheckParamsSchema } from '../lib/planner/types';
import { handleSimulationMessage } from '../lib/planner/simulation.worker';
import { getMarketDataCopy } from '../content/historicalMarketData';

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  drawdownStrategy: 'taxable_first',
  historicalRange: 'all_125_years',
  numPaths: 1000,
  inflationRate: 0.025,
  retirementHorizon: 30,
  seed: 42,
};

export const DEFAULT_HOUSEHOLD: Household = {
  name: 'Default Household',
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
    },
  ],
  spending: {
    initialBase: 40000,
    strategy: 'constant_dollar',
    inflationAdjusted: true,
  },
  pensions: [],
  lifeEvents: [],
};

export interface RetirementStoreState {
  household: Household;
  simulationConfig: SimulationConfig;
  activeTab: string;
  simulationResults: SimulationResultsSummary | null;
  isSimulating: boolean;
  error: string | null;

  setHousehold: (householdUpdate: Partial<Household> | ((prev: Household) => Household)) => void;
  setSimulationConfig: (configUpdate: Partial<SimulationConfig> | ((prev: SimulationConfig) => SimulationConfig)) => void;
  setActiveTab: (tab: string) => void;
  setSimulationResults: (results: SimulationResultsSummary | null) => void;
  setIsSimulating: (isSimulating: boolean) => void;
  setError: (error: string | null) => void;

  runSimulation: () => void;
  hydrateFromParams: (params: URLSearchParams | { [key: string]: string } | string) => void;
  reset: () => void;
}

export const useRetirementStore = create<RetirementStoreState>((set, get) => ({
  household: DEFAULT_HOUSEHOLD,
  simulationConfig: DEFAULT_SIMULATION_CONFIG,
  activeTab: 'household',
  simulationResults: null,
  isSimulating: false,
  error: null,

  setHousehold: (householdUpdate) =>
    set((state) => ({
      household:
        typeof householdUpdate === 'function'
          ? householdUpdate(state.household)
          : { ...state.household, ...householdUpdate },
    })),

  setSimulationConfig: (configUpdate) =>
    set((state) => ({
      simulationConfig:
        typeof configUpdate === 'function'
          ? configUpdate(state.simulationConfig)
          : { ...state.simulationConfig, ...configUpdate },
    })),

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSimulationResults: (results) => set({ simulationResults: results }),
  setIsSimulating: (isSimulating) => set({ isSimulating }),
  setError: (error) => set({ error }),

  runSimulation: () => {
    const { household, simulationConfig } = get();
    set({ isSimulating: true, error: null });

    const fallbackSimulate = () => {
      try {
        const marketData = getMarketDataCopy(simulationConfig.historicalRange);
        handleSimulationMessage(
          { action: 'simulate', config: simulationConfig, marketData, household },
          (response) => {
            set({ isSimulating: false, simulationResults: response.summary, error: null });
          },
          (error) => {
            set({ isSimulating: false, error: (error as Error).message ?? String(error) });
          }
        );
      } catch (err: any) {
        set({ isSimulating: false, error: err.message ?? String(err) });
      }
    };

    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        const worker = new Worker(new URL('../lib/planner/simulation.worker', import.meta.url));

        worker.onmessage = (event: MessageEvent) => {
          if (event.data && event.data.error) {
            set({ isSimulating: false, error: event.data.error });
          } else if (event.data && event.data.summary) {
            set({ isSimulating: false, simulationResults: event.data.summary, error: null });
          } else {
            set({ isSimulating: false, error: 'Received invalid response from simulation worker.' });
          }
          worker.terminate();
        };

        worker.onerror = (err) => {
          set({ isSimulating: false, error: 'Simulation worker failed to execute.' });
          worker.terminate();
        };

        const marketData = getMarketDataCopy(simulationConfig.historicalRange);

        worker.postMessage(
          {
            action: 'simulate',
            config: simulationConfig,
            marketData,
            household,
          },
          [marketData.buffer]
        );
      } catch (err) {
        fallbackSimulate();
      }
    } else {
      fallbackSimulate();
    }
  },

  hydrateFromParams: (params) => {
    let searchParams: URLSearchParams | { [key: string]: string };
    if (typeof params === 'string') {
      searchParams = new URLSearchParams(params);
    } else {
      searchParams = params;
    }

    const getParam = (key: string): string | null => {
      if (searchParams instanceof URLSearchParams) {
        return searchParams.get(key);
      }
      return (searchParams as any)[key] ?? null;
    };

    const portfolioStr = getParam('portfolio');
    const withdrawalStr = getParam('withdrawal');
    const yearsStr = getParam('years');
    const taxJurisdictionStr = getParam('taxJurisdiction');

    if (portfolioStr === null && withdrawalStr === null && yearsStr === null && taxJurisdictionStr === null) {
      return;
    }

    const rawParams = {
      portfolio: portfolioStr !== null ? Number(portfolioStr) : undefined,
      withdrawal: withdrawalStr !== null ? Number(withdrawalStr) : undefined,
      years: yearsStr !== null ? Number(yearsStr) : undefined,
      taxJurisdiction: taxJurisdictionStr !== null ? taxJurisdictionStr : undefined,
    };

    const parsed = QuickCheckParamsSchema.partial().safeParse(rawParams);
    if (!parsed.success) {
      set({ error: 'Failed to hydrate from URL params: invalid format' });
      return;
    }

    const { portfolio, withdrawal, years, taxJurisdiction } = parsed.data;

    set((state) => {
      const prevHousehold = state.household;
      const prevConfig = state.simulationConfig;

      const updatedAccounts = prevHousehold.accounts?.length
        ? prevHousehold.accounts.map((acc, idx) =>
            idx === 0 ? { ...acc, balance: portfolio ?? acc.balance, costBasis: portfolio ?? acc.costBasis } : acc
          )
        : [
            {
              id: 'acc-primary',
              name: 'Primary Portfolio',
              type: 'taxable' as const,
              balance: portfolio ?? 1000000,
              costBasis: portfolio ?? 1000000,
              owner: 'primary' as const,
            },
          ];

      const updatedSpending = {
        ...prevHousehold.spending,
        initialBase: withdrawal ?? prevHousehold.spending?.initialBase ?? 40000,
        strategy: prevHousehold.spending?.strategy ?? 'constant_dollar',
        inflationAdjusted: prevHousehold.spending?.inflationAdjusted ?? true,
      };

      const updatedHousehold: Household = {
        ...prevHousehold,
        taxJurisdiction: (taxJurisdiction as any) ?? prevHousehold.taxJurisdiction,
        accounts: updatedAccounts,
        spending: updatedSpending,
      };

      const updatedConfig: SimulationConfig = {
        ...prevConfig,
        retirementHorizon: years ?? prevConfig.retirementHorizon,
      };

      return {
        household: updatedHousehold,
        simulationConfig: updatedConfig,
        error: null,
      };
    });
  },

  reset: () =>
    set({
      household: DEFAULT_HOUSEHOLD,
      simulationConfig: DEFAULT_SIMULATION_CONFIG,
      activeTab: 'household',
      simulationResults: null,
      isSimulating: false,
      error: null,
    }),
}));
```

#### `__tests__/planner/useRetirementStore.spec.ts`
```typescript
import { useRetirementStore, DEFAULT_HOUSEHOLD, DEFAULT_SIMULATION_CONFIG } from '../../src/store/useRetirementStore';
import { SimulationResultsSummary } from '../../src/lib/planner/types';

describe('useRetirementStore (M4.1)', () => {
  const mockSummary: SimulationResultsSummary = {
    successRate: 95,
    medianFinalBalance: 2000000,
    tenthPercentileFinalBalance: 1000000,
    ninetiethPercentileFinalBalance: 4000000,
    annualEndingBalances: [],
  };

  let originalWorker: any;

  beforeAll(() => {
    originalWorker = (window as any).Worker;
  });

  afterAll(() => {
    (window as any).Worker = originalWorker;
  });

  beforeEach(() => {
    useRetirementStore.getState().reset();
    (window as any).Worker = undefined;
  });

  it('should initialize with default state and update basic state properties', () => {
    const store = useRetirementStore.getState();
    expect(store.household).toEqual(DEFAULT_HOUSEHOLD);
    expect(store.simulationConfig).toEqual(DEFAULT_SIMULATION_CONFIG);
    expect(store.activeTab).toBe('household');
    expect(store.simulationResults).toBeNull();
    expect(store.isSimulating).toBe(false);
    expect(store.error).toBeNull();

    store.setActiveTab('accounts');
    expect(useRetirementStore.getState().activeTab).toBe('accounts');

    store.setIsSimulating(true);
    expect(useRetirementStore.getState().isSimulating).toBe(true);

    store.setError('Custom error');
    expect(useRetirementStore.getState().error).toBe('Custom error');

    store.setSimulationResults(mockSummary);
    expect(useRetirementStore.getState().simulationResults).toEqual(mockSummary);

    store.reset();
    expect(useRetirementStore.getState().activeTab).toBe('household');
    expect(useRetirementStore.getState().error).toBeNull();
  });

  it('should update household using partial object and functional updater', () => {
    const store = useRetirementStore.getState();
    store.setHousehold({ name: 'Updated Household Name' });
    expect(useRetirementStore.getState().household.name).toBe('Updated Household Name');

    store.setHousehold((prev) => ({ ...prev, birthYear: 1970 }));
    expect(useRetirementStore.getState().household.birthYear).toBe(1970);
  });

  it('should update simulationConfig using partial object and functional updater', () => {
    const store = useRetirementStore.getState();
    store.setSimulationConfig({ retirementHorizon: 25 });
    expect(useRetirementStore.getState().simulationConfig.retirementHorizon).toBe(25);

    store.setSimulationConfig((prev) => ({ ...prev, numPaths: 500 }));
    expect(useRetirementStore.getState().simulationConfig.numPaths).toBe(500);
  });

  it('should hydrate store state from URLSearchParams instance', () => {
    const store = useRetirementStore.getState();
    const params = new URLSearchParams('?portfolio=2000000&withdrawal=50000&years=25&taxJurisdiction=CA');
    store.hydrateFromParams(params);

    const state = useRetirementStore.getState();
    expect(state.household.accounts![0].balance).toBe(2000000);
    expect(state.household.accounts![0].costBasis).toBe(2000000);
    expect(state.household.spending!.initialBase).toBe(50000);
    expect(state.household.taxJurisdiction).toBe('CA');
    expect(state.simulationConfig.retirementHorizon).toBe(25);
    expect(state.error).toBeNull();
  });

  it('should hydrate store state from plain object', () => {
    const store = useRetirementStore.getState();
    store.hydrateFromParams({ portfolio: '1500000', withdrawal: '45000', years: '35', taxJurisdiction: 'US' });

    const state = useRetirementStore.getState();
    expect(state.household.accounts![0].balance).toBe(1500000);
    expect(state.household.spending!.initialBase).toBe(45000);
    expect(state.simulationConfig.retirementHorizon).toBe(35);
  });

  it('should hydrate store state from raw string', () => {
    const store = useRetirementStore.getState();
    store.hydrateFromParams('?portfolio=3000000&withdrawal=60000&years=20&taxJurisdiction=US');

    const state = useRetirementStore.getState();
    expect(state.household.accounts![0].balance).toBe(3000000);
    expect(state.household.spending!.initialBase).toBe(60000);
    expect(state.simulationConfig.retirementHorizon).toBe(20);
  });

  it('should not modify state when hydrating with empty or unmatched params', () => {
    const store = useRetirementStore.getState();
    store.hydrateFromParams({ unrelatedParam: '123' });

    const state = useRetirementStore.getState();
    expect(state.household).toEqual(DEFAULT_HOUSEHOLD);
  });

  it('should set error state when hydrating with invalid params', () => {
    const store = useRetirementStore.getState();
    store.hydrateFromParams({ portfolio: 'invalid_number' });

    const state = useRetirementStore.getState();
    expect(state.error).toBe('Failed to hydrate from URL params: invalid format');
  });

  it('should successfully execute fallback simulation when Worker is undefined', () => {
    (window as any).Worker = undefined;
    const store = useRetirementStore.getState();
    store.runSimulation();

    const state = useRetirementStore.getState();
    expect(state.isSimulating).toBe(false);
    expect(state.simulationResults).toBeDefined();
    expect(state.simulationResults!.successRate).toBeGreaterThanOrEqual(0);
    expect(state.error).toBeNull();
  });

  it('should successfully execute simulation using Web Worker', (done) => {
    class MockWorker {
      onmessage: any;
      onerror: any;
      postMessage(data: any) {
        setTimeout(() => {
          this.onmessage({ data: { summary: mockSummary } });
        }, 10);
      }
      terminate() {
        expect(useRetirementStore.getState().isSimulating).toBe(false);
        expect(useRetirementStore.getState().simulationResults).toEqual(mockSummary);
        expect(useRetirementStore.getState().error).toBeNull();
        done();
      }
    }
    (window as any).Worker = MockWorker;

    const store = useRetirementStore.getState();
    store.runSimulation();
    expect(useRetirementStore.getState().isSimulating).toBe(true);
  });

  it('should handle Web Worker error in message data', (done) => {
    class MockWorker {
      onmessage: any;
      postMessage(data: any) {
        setTimeout(() => {
          this.onmessage({ data: { error: 'Worker simulation failed' } });
        }, 10);
      }
      terminate() {
        expect(useRetirementStore.getState().isSimulating).toBe(false);
        expect(useRetirementStore.getState().error).toBe('Worker simulation failed');
        done();
      }
    }
    (window as any).Worker = MockWorker;

    const store = useRetirementStore.getState();
    store.runSimulation();
  });

  it('should handle Web Worker returning invalid data structure', (done) => {
    class MockWorker {
      onmessage: any;
      postMessage(data: any) {
        setTimeout(() => {
          this.onmessage({ data: {} });
        }, 10);
      }
      terminate() {
        expect(useRetirementStore.getState().isSimulating).toBe(false);
        expect(useRetirementStore.getState().error).toBe('Received invalid response from simulation worker.');
        done();
      }
    }
    (window as any).Worker = MockWorker;

    const store = useRetirementStore.getState();
    store.runSimulation();
  });

  it('should handle Web Worker onerror event', (done) => {
    class MockWorker {
      onerror: any;
      postMessage(data: any) {
        setTimeout(() => {
          this.onerror(new Error('Worker execution error'));
        }, 10);
      }
      terminate() {
        expect(useRetirementStore.getState().isSimulating).toBe(false);
        expect(useRetirementStore.getState().error).toBe('Simulation worker failed to execute.');
        done();
      }
    }
    (window as any).Worker = MockWorker;

    const store = useRetirementStore.getState();
    store.runSimulation();
  });

  it('should gracefully fallback when new Worker() throws an exception', () => {
    (window as any).Worker = jest.fn().mockImplementation(() => {
      throw new Error('Web Worker not supported in this context');
    });

    const store = useRetirementStore.getState();
    store.runSimulation();

    const state = useRetirementStore.getState();
    expect(state.isSimulating).toBe(false);
    expect(state.simulationResults).toBeDefined();
    expect(state.error).toBeNull();
  });

  it('should handle fallback simulation errors gracefully', () => {
    (window as any).Worker = undefined;
    const store = useRetirementStore.getState();
    // Force an invalid configuration to trigger an error in handleSimulationMessage
    store.setSimulationConfig({ historicalRange: 'invalid_range' as any });
    store.runSimulation();

    const state = useRetirementStore.getState();
    expect(state.isSimulating).toBe(false);
    expect(state.error).toBeDefined();
    expect(state.error).not.toBeNull();
  });
});
```

## 5. Verification Method
To independently verify the success of the implementation:
1. **Unit Testing**:
   Execute the Jest test runner targeting the planner test suite:
   ```bash
   npm run test __tests__/planner
   ```
   Verify that `useRetirementStore.spec.ts` passes with 100% test coverage and zero failures.
2. **E2E Integration Verification**:
   Run the Playwright E2E suite to verify full integration with the Quick Check widget and Detailed Plan Builder:
   ```bash
   npx tsx e2e/run_e2e.ts
   ```
3. **Local-Only Compliance**:
   Run `git status` to verify all changes exist strictly in the local working directory with zero commits pushed to remote repositories.
