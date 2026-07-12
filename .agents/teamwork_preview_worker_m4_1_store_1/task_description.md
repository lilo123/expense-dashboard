# Task Description: Worker for M4.1 - Zustand Store & URL Hydration

## Objective
Implement `src/store/useRetirementStore.tsx` and `__tests__/planner/useRetirementStore.spec.ts` based on the exact synthesized blueprints from the Explorer investigation, and verify 100% test success via `npm run test __tests__/planner`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Scope & Instructions
1. Create `src/store/useRetirementStore.tsx` with the complete, production-ready Zustand store and React Context provider implementation shown below.
2. Create `__tests__/planner/useRetirementStore.spec.ts` with the complete Jest unit test suite shown below.
3. Run `npm run test __tests__/planner` to verify that all unit tests pass successfully.
4. Write a structured handoff report in your working directory (`handoff.md`) documenting your implementation and verification results.
5. Report back via `send_message` when complete.

---

## Blueprint 1: `src/store/useRetirementStore.tsx`
```tsx
import React, { createContext, useContext, useRef, useLayoutEffect, useEffect, useState } from 'react';
import { createStore, useStore } from 'zustand';
import { Household, SimulationConfig, SimulationResultsSummary } from '@/lib/planner/types';
import { getMarketDataCopy } from '@/content/historicalMarketData';
import { handleSimulationMessage } from '@/lib/planner/simulation.worker';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type ActiveTab = 'household' | 'accounts' | 'spending' | 'pensions' | 'lifeEvents' | 'simulation' | 'summary';

export const defaultSimulationConfig: SimulationConfig = {
  drawdownStrategy: 'taxable_first',
  historicalRange: 'all_125_years',
  numPaths: 1000,
  inflationRate: 0.025,
  retirementHorizon: 30,
  seed: 7,
};

export const defaultHousehold: Household = {
  name: 'My Retirement Plan',
  taxJurisdiction: 'US',
  stateProvince: 'NY',
  birthYear: 1965,
  retirementAge: 65,
  includeSpouse: false,
  horizonMode: 'fixed_years',
  accounts: [
    {
      id: 'acc-default',
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
  },
  pensions: [],
  lifeEvents: [],
  simulationConfig: defaultSimulationConfig,
};

export interface RetirementState {
  household: Household;
  simulationConfig: SimulationConfig;
  activeTab: ActiveTab;
  simulationResults: SimulationResultsSummary | null;
  isSimulating: boolean;
  error: string | null;

  setHousehold: (household: Household | ((prev: Household) => Household)) => void;
  updateHousehold: (updates: Partial<Household>) => void;
  setSimulationConfig: (config: SimulationConfig | ((prev: SimulationConfig) => SimulationConfig)) => void;
  updateSimulationConfig: (updates: Partial<SimulationConfig>) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setSimulationResults: (results: SimulationResultsSummary | null) => void;
  setError: (error: string | null) => void;
  setIsSimulating: (isSimulating: boolean) => void;

  runSimulation: () => void;
  hydrateFromParams: (params: URLSearchParams | { [key: string]: string }) => void;
  hydrate: (data: Partial<RetirementState>) => void;
  reset: () => void;
}

export const createRetirementStore = (initialState: Partial<RetirementState> = {}) =>
  createStore<RetirementState>((set, get) => ({
    household: initialState.household || defaultHousehold,
    simulationConfig: initialState.simulationConfig || defaultSimulationConfig,
    activeTab: initialState.activeTab || 'household',
    simulationResults: initialState.simulationResults || null,
    isSimulating: initialState.isSimulating || false,
    error: initialState.error || null,

    setHousehold: (household) => set((state) => ({
      household: typeof household === 'function' ? household(state.household) : household
    })),
    updateHousehold: (updates) => set((state) => ({
      household: { ...state.household, ...updates }
    })),
    setSimulationConfig: (config) => set((state) => ({
      simulationConfig: typeof config === 'function' ? config(state.simulationConfig) : config
    })),
    updateSimulationConfig: (updates) => set((state) => ({
      simulationConfig: { ...state.simulationConfig, ...updates }
    })),
    setActiveTab: (tab) => set({ activeTab: tab }),
    setSimulationResults: (results) => set({ simulationResults: results }),
    setError: (error) => set({ error }),
    setIsSimulating: (isSimulating) => set({ isSimulating }),

    hydrate: (data) => set((state) => ({
      household: data.household !== undefined ? data.household : state.household,
      simulationConfig: data.simulationConfig !== undefined ? data.simulationConfig : state.simulationConfig,
      activeTab: data.activeTab !== undefined ? data.activeTab : state.activeTab,
      simulationResults: data.simulationResults !== undefined ? data.simulationResults : state.simulationResults,
      isSimulating: data.isSimulating !== undefined ? data.isSimulating : state.isSimulating,
      error: data.error !== undefined ? data.error : state.error,
    })),

    reset: () => set({
      household: defaultHousehold,
      simulationConfig: defaultSimulationConfig,
      activeTab: 'household',
      simulationResults: null,
      isSimulating: false,
      error: null,
    }),

    hydrateFromParams: (params) => set((state) => {
      let portfolio: number | undefined;
      let withdrawal: number | undefined;
      let years: number | undefined;
      let taxJurisdiction: 'US' | 'CA' | undefined;

      if (params instanceof URLSearchParams) {
        if (params.has('portfolio')) portfolio = parseFloat(params.get('portfolio')!);
        if (params.has('withdrawal')) withdrawal = parseFloat(params.get('withdrawal')!);
        if (params.has('years')) years = parseInt(params.get('years')!, 10);
        if (params.has('taxJurisdiction')) {
          const tj = params.get('taxJurisdiction');
          if (tj === 'US' || tj === 'CA') taxJurisdiction = tj;
        }
      } else {
        if (params.portfolio !== undefined) portfolio = parseFloat(String(params.portfolio));
        if (params.withdrawal !== undefined) withdrawal = parseFloat(String(params.withdrawal));
        if (params.years !== undefined) years = parseInt(String(params.years), 10);
        if (params.taxJurisdiction === 'US' || params.taxJurisdiction === 'CA') {
          taxJurisdiction = params.taxJurisdiction;
        }
      }

      const updatedHousehold = { ...state.household };
      let householdModified = false;

      if (portfolio !== undefined && !isNaN(portfolio)) {
        const existingAccounts = updatedHousehold.accounts ? [...updatedHousehold.accounts] : [];
        if (existingAccounts.length > 0) {
          existingAccounts[0] = { ...existingAccounts[0], balance: portfolio, costBasis: portfolio };
        } else {
          existingAccounts.push({
            id: 'acc-hydrated',
            name: 'Primary Portfolio',
            type: 'taxable',
            balance: portfolio,
            costBasis: portfolio,
            owner: 'primary'
          });
        }
        updatedHousehold.accounts = existingAccounts;
        householdModified = true;
      }

      if (withdrawal !== undefined && !isNaN(withdrawal)) {
        updatedHousehold.spending = {
          ...(updatedHousehold.spending || { strategy: 'constant_dollar', inflationAdjusted: true }),
          initialBase: withdrawal
        };
        householdModified = true;
      }

      if (taxJurisdiction !== undefined) {
        updatedHousehold.taxJurisdiction = taxJurisdiction;
        householdModified = true;
      }

      const updatedConfig = { ...state.simulationConfig };
      let configModified = false;

      if (years !== undefined && !isNaN(years)) {
        updatedConfig.retirementHorizon = years;
        configModified = true;
        updatedHousehold.simulationConfig = updatedConfig;
        householdModified = true;
      }

      if (!householdModified && !configModified) {
        return state;
      }

      return {
        household: updatedHousehold,
        simulationConfig: updatedConfig,
      };
    }),

    runSimulation: () => {
      const state = get();
      set({ isSimulating: true, error: null });

      const { simulationConfig, household } = state;
      const marketData = getMarketDataCopy(simulationConfig.historicalRange);

      if (
        typeof window !== 'undefined' &&
        typeof window.Worker !== 'undefined' &&
        !(window as any).__JEST_MOCK_WORKER_FALLBACK__
      ) {
        try {
          const worker = new Worker(new URL('../lib/planner/simulation.worker', (import.meta as any).url));

          worker.onmessage = (event: MessageEvent) => {
            if (event.data.error) {
              set({ isSimulating: false, error: event.data.error });
            } else {
              set({ isSimulating: false, simulationResults: event.data.summary });
            }
            worker.terminate();
          };

          worker.onerror = () => {
            set({ isSimulating: false, error: 'Simulation worker encountered an error' });
            worker.terminate();
          };

          worker.postMessage({
            action: 'simulate',
            config: simulationConfig,
            marketData,
            household,
          }, [marketData.buffer]);
          return;
        } catch (err: any) {
          console.warn('Web Worker instantiation failed, falling back to direct handler:', err);
        }
      }

      try {
        handleSimulationMessage(
          { action: 'simulate', config: simulationConfig, marketData, household },
          (response) => {
            set({ isSimulating: false, simulationResults: response.summary });
          },
          (err) => {
            set({ isSimulating: false, error: err.message || String(err) });
          }
        );
      } catch (err: any) {
        set({ isSimulating: false, error: err.message || String(err) });
      }
    },
  }));

const StoreContext = createContext<ReturnType<typeof createRetirementStore> | null>(null);

function areInitialDataEqual(a: Partial<RetirementState>, b: Partial<RetirementState>): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  const keysToCompare: (keyof RetirementState)[] = [
    'household', 'simulationConfig', 'activeTab', 'simulationResults', 'isSimulating', 'error'
  ];

  for (const key of keysToCompare) {
    const valA = a[key];
    const valB = b[key];

    if (valA === valB) continue;
    if (!valA || !valB) return false;

    if (typeof valA === 'object' && typeof valB === 'object') {
      if (JSON.stringify(valA) !== JSON.stringify(valB)) return false;
    } else {
      if (valA !== valB) return false;
    }
  }
  return true;
}

export function RetirementStoreProvider({ children, initialData = {} }: { children: React.ReactNode; initialData?: Partial<RetirementState> }) {
  const [store] = useState(() => createRetirementStore(initialData));
  const prevInitialDataRef = useRef<Partial<RetirementState>>(initialData);

  useIsomorphicLayoutEffect(() => {
    if (prevInitialDataRef.current !== initialData && !areInitialDataEqual(prevInitialDataRef.current, initialData)) {
      store.getState().hydrate(initialData);
      prevInitialDataRef.current = initialData;
    }
  }, [initialData, store]);

  return (
    <StoreContext.Provider value={store}>
      {children}
    </StoreContext.Provider>
  );
}

const defaultSelector = (state: RetirementState) => state;

export function useRetirementStore(): RetirementState;
export function useRetirementStore<T>(selector: (state: RetirementState) => T): T;
export function useRetirementStore<T>(selector?: (state: RetirementState) => T): T | RetirementState {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useRetirementStore must be used within a RetirementStoreProvider');
  return useStore(store, selector || (defaultSelector as unknown as (state: RetirementState) => T));
}
```

---

## Blueprint 2: `__tests__/planner/useRetirementStore.spec.ts`
```ts
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  createRetirementStore,
  RetirementStoreProvider,
  useRetirementStore,
  defaultHousehold,
  defaultSimulationConfig,
} from '../../src/store/useRetirementStore';

describe('useRetirementStore (M4.1)', () => {
  let originalWorker: any;

  beforeEach(() => {
    originalWorker = (window as any).Worker;
    delete (window as any).__JEST_MOCK_WORKER_FALLBACK__;
  });

  afterEach(() => {
    (window as any).Worker = originalWorker;
    delete (window as any).__JEST_MOCK_WORKER_FALLBACK__;
  });

  describe('Standalone Store Actions & Initial State', () => {
    it('should initialize with default values', () => {
      const store = createRetirementStore();
      const state = store.getState();
      expect(state.household).toEqual(defaultHousehold);
      expect(state.simulationConfig).toEqual(defaultSimulationConfig);
      expect(state.activeTab).toBe('household');
      expect(state.simulationResults).toBeNull();
      expect(state.isSimulating).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should update household via value and functional updater', () => {
      const store = createRetirementStore();
      store.getState().setHousehold({ ...defaultHousehold, name: 'Updated Name' });
      expect(store.getState().household.name).toBe('Updated Name');

      store.getState().setHousehold((prev) => ({ ...prev, name: 'Function Name' }));
      expect(store.getState().household.name).toBe('Function Name');
    });

    it('should update household partials via updateHousehold', () => {
      const store = createRetirementStore();
      store.getState().updateHousehold({ taxJurisdiction: 'CA' });
      expect(store.getState().household.taxJurisdiction).toBe('CA');
    });

    it('should update simulationConfig via value and functional updater', () => {
      const store = createRetirementStore();
      store.getState().setSimulationConfig({ ...defaultSimulationConfig, retirementHorizon: 40 });
      expect(store.getState().simulationConfig.retirementHorizon).toBe(40);

      store.getState().setSimulationConfig((prev) => ({ ...prev, retirementHorizon: 45 }));
      expect(store.getState().simulationConfig.retirementHorizon).toBe(45);
    });

    it('should update simulationConfig partials via updateSimulationConfig', () => {
      const store = createRetirementStore();
      store.getState().updateSimulationConfig({ drawdownStrategy: 'proportional' });
      expect(store.getState().simulationConfig.drawdownStrategy).toBe('proportional');
    });

    it('should update activeTab, simulationResults, error, and isSimulating', () => {
      const store = createRetirementStore();
      store.getState().setActiveTab('accounts');
      expect(store.getState().activeTab).toBe('accounts');

      const mockResults = { successRate: 100, medianFinalBalance: 1000, tenthPercentileFinalBalance: 500, ninetiethPercentileFinalBalance: 2000 };
      store.getState().setSimulationResults(mockResults);
      expect(store.getState().simulationResults).toEqual(mockResults);

      store.getState().setError('Error occurred');
      expect(store.getState().error).toBe('Error occurred');

      store.getState().setIsSimulating(true);
      expect(store.getState().isSimulating).toBe(true);
    });

    it('should reset store to default values', () => {
      const store = createRetirementStore({ activeTab: 'summary', isSimulating: true, error: 'err' });
      store.getState().reset();
      expect(store.getState().activeTab).toBe('household');
      expect(store.getState().isSimulating).toBe(false);
      expect(store.getState().error).toBeNull();
    });

    it('should hydrate store state', () => {
      const store = createRetirementStore();
      store.getState().hydrate({ activeTab: 'pensions', error: 'hydrated error' });
      expect(store.getState().activeTab).toBe('pensions');
      expect(store.getState().error).toBe('hydrated error');
    });
  });

  describe('URL Search Params Hydration (hydrateFromParams)', () => {
    it('should hydrate from URLSearchParams instance', () => {
      const store = createRetirementStore();
      const params = new URLSearchParams('portfolio=2000000&withdrawal=50000&years=35&taxJurisdiction=CA');
      store.getState().hydrateFromParams(params);

      const state = store.getState();
      expect(state.household.accounts![0].balance).toBe(2000000);
      expect(state.household.accounts![0].costBasis).toBe(2000000);
      expect(state.household.spending!.initialBase).toBe(50000);
      expect(state.household.taxJurisdiction).toBe('CA');
      expect(state.simulationConfig.retirementHorizon).toBe(35);
      expect(state.household.simulationConfig!.retirementHorizon).toBe(35);
    });

    it('should hydrate from plain JavaScript object dictionary', () => {
      const store = createRetirementStore();
      const params = { portfolio: '1500000', withdrawal: '45000', years: '25', taxJurisdiction: 'US' };
      store.getState().hydrateFromParams(params);

      const state = store.getState();
      expect(state.household.accounts![0].balance).toBe(1500000);
      expect(state.household.spending!.initialBase).toBe(45000);
      expect(state.household.taxJurisdiction).toBe('US');
      expect(state.simulationConfig.retirementHorizon).toBe(25);
    });

    it('should create a new account if household accounts array is empty during hydration', () => {
      const store = createRetirementStore({ household: { ...defaultHousehold, accounts: [] } });
      store.getState().hydrateFromParams({ portfolio: '500000' });
      expect(store.getState().household.accounts).toHaveLength(1);
      expect(store.getState().household.accounts![0].balance).toBe(500000);
    });

    it('should leave state unmodified if no relevant params are passed', () => {
      const store = createRetirementStore();
      const prevState = store.getState();
      store.getState().hydrateFromParams({ unrelated: 'value' });
      expect(store.getState()).toBe(prevState);
    });
  });

  describe('Web Worker Integration (runSimulation)', () => {
    it('should execute simulation via direct fallback when __JEST_MOCK_WORKER_FALLBACK__ is set', () => {
      (window as any).__JEST_MOCK_WORKER_FALLBACK__ = true;
      const store = createRetirementStore();
      store.getState().runSimulation();
      expect(store.getState().isSimulating).toBe(false);
      expect(store.getState().simulationResults).toBeDefined();
      expect(store.getState().simulationResults!.successRate).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors in direct fallback execution gracefully', () => {
      (window as any).__JEST_MOCK_WORKER_FALLBACK__ = true;
      const store = createRetirementStore({
        simulationConfig: { ...defaultSimulationConfig, historicalRange: 'invalid_range' as any }
      });
      store.getState().runSimulation();
      expect(store.getState().isSimulating).toBe(false);
      expect(store.getState().error).toBeDefined();
    });

    it('should interact with genuine Web Worker when available and handle success message', () => {
      let postMessagePayload: any;
      let onMessageCb: any;
      let terminateCalled = false;

      (window as any).Worker = jest.fn().mockImplementation(() => ({
        postMessage: jest.fn((data) => {
          postMessagePayload = data;
        }),
        terminate: jest.fn(() => { terminateCalled = true; }),
        addEventListener: jest.fn(),
        set onmessage(cb: any) { onMessageCb = cb; },
        set onerror(cb: any) {},
      }));

      const store = createRetirementStore();
      store.getState().runSimulation();

      expect(postMessagePayload).toBeDefined();
      expect(postMessagePayload.action).toBe('simulate');

      const mockSummary = { successRate: 95, medianFinalBalance: 2000, tenthPercentileFinalBalance: 500, ninetiethPercentileFinalBalance: 5000 };
      onMessageCb({ data: { summary: mockSummary } });

      expect(store.getState().isSimulating).toBe(false);
      expect(store.getState().simulationResults).toEqual(mockSummary);
      expect(terminateCalled).toBe(true);
    });

    it('should handle Web Worker error payload in onmessage', () => {
      let onMessageCb: any;
      (window as any).Worker = jest.fn().mockImplementation(() => ({
        postMessage: jest.fn(),
        terminate: jest.fn(),
        set onmessage(cb: any) { onMessageCb = cb; },
      }));

      const store = createRetirementStore();
      store.getState().runSimulation();

      onMessageCb({ data: { error: 'Worker simulation failed' } });
      expect(store.getState().isSimulating).toBe(false);
      expect(store.getState().error).toBe('Worker simulation failed');
    });

    it('should handle Web Worker onerror dispatch', () => {
      let onErrorCb: any;
      (window as any).Worker = jest.fn().mockImplementation(() => ({
        postMessage: jest.fn(),
        terminate: jest.fn(),
        set onmessage(cb: any) {},
        set onerror(cb: any) { onErrorCb = cb; },
      }));

      const store = createRetirementStore();
      store.getState().runSimulation();

      onErrorCb(new Error('Fatal worker error'));
      expect(store.getState().isSimulating).toBe(false);
      expect(store.getState().error).toBe('Simulation worker encountered an error');
    });

    it('should fallback to direct execution if new Worker throws during instantiation', () => {
      (window as any).Worker = jest.fn().mockImplementation(() => {
        throw new Error('Worker not supported in this sandbox');
      });

      const store = createRetirementStore();
      store.getState().runSimulation();
      expect(store.getState().isSimulating).toBe(false);
      expect(store.getState().simulationResults).toBeDefined();
    });
  });

  describe('React Context Provider & Hook (RetirementStoreProvider & useRetirementStore)', () => {
    it('should throw error if useRetirementStore is called outside of RetirementStoreProvider', () => {
      expect(() => renderHook(() => useRetirementStore())).toThrow('useRetirementStore must be used within a RetirementStoreProvider');
    });

    it('should provide store context and support selector filtering', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RetirementStoreProvider initialData={{ activeTab: 'spending' }}>
          {children}
        </RetirementStoreProvider>
      );

      const { result } = renderHook(() => useRetirementStore((state) => state.activeTab), { wrapper });
      expect(result.current).toBe('spending');
    });

    it('should support default selector returning full state', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RetirementStoreProvider initialData={{ activeTab: 'lifeEvents' }}>
          {children}
        </RetirementStoreProvider>
      );

      const { result } = renderHook(() => useRetirementStore(), { wrapper });
      expect(result.current.activeTab).toBe('lifeEvents');
    });

    it('should rehydrate store when initialData changes to a non-equal value', () => {
      const wrapper = ({ children, initialData }: { children: React.ReactNode; initialData?: any }) => (
        <RetirementStoreProvider initialData={initialData}>
          {children}
        </RetirementStoreProvider>
      );

      const { result, rerender } = renderHook(() => useRetirementStore(), {
        wrapper,
        initialProps: { initialData: { activeTab: 'household' } }
      });
      expect(result.current.activeTab).toBe('household');

      rerender({ initialData: { activeTab: 'summary' } });
      expect(result.current.activeTab).toBe('summary');
    });

    it('should handle areInitialDataEqual branches perfectly', () => {
      const wrapper = ({ children, initialData }: { children: React.ReactNode; initialData?: any }) => (
        <RetirementStoreProvider initialData={initialData}>
          {children}
        </RetirementStoreProvider>
      );

      const initialDataObj = { activeTab: 'household' };
      const { result, rerender } = renderHook(() => useRetirementStore(), {
        wrapper,
        initialProps: { initialData: initialDataObj }
      });

      // Same reference
      rerender({ initialData: initialDataObj });
      expect(result.current.activeTab).toBe('household');

      // Different object structure / undefined comparison
      rerender({ initialData: undefined });
      expect(result.current.activeTab).toBe('household');
    });
  });
});
```
