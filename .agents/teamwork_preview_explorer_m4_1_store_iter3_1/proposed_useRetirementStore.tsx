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
  activeWorker: Worker | null;
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
    activeWorker: initialState.activeWorker || null,
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
      activeWorker: data.activeWorker !== undefined ? data.activeWorker : state.activeWorker,
      error: data.error !== undefined ? data.error : state.error,
    })),

    reset: () => {
      const currentWorker = get().activeWorker;
      if (currentWorker) {
        currentWorker.terminate();
      }
      set({
        household: defaultHousehold,
        simulationConfig: defaultSimulationConfig,
        activeTab: 'household',
        simulationResults: null,
        isSimulating: false,
        activeWorker: null,
        error: null,
      });
    },

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

      if (portfolio !== undefined && !isNaN(portfolio) && portfolio >= 0) {
        const existingAccounts = updatedHousehold.accounts ? [...updatedHousehold.accounts] : [];
        if (existingAccounts.length > 0) {
          existingAccounts[0] = { ...existingAccounts[0], balance: portfolio, costBasis: portfolio };
        } else {
          existingAccounts.push({
            id: 'acc-' + Date.now(),
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

      if (withdrawal !== undefined && !isNaN(withdrawal) && withdrawal >= 0) {
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

      if (years !== undefined && !isNaN(years) && years > 0) {
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
      if (state.activeWorker) {
        state.activeWorker.terminate();
      }
      set({ isSimulating: true, error: null, activeWorker: null });

      try {
        const { simulationConfig, household } = state;
        const marketData = getMarketDataCopy(simulationConfig.historicalRange);

        if (
          typeof window !== 'undefined' &&
          typeof window.Worker !== 'undefined'
        ) {
          let activeWorkerInstance: Worker | null = null;
          try {
            const worker = new Worker(new URL('../lib/planner/simulation.worker', (import.meta as any).url));
            activeWorkerInstance = worker;
            set({ activeWorker: worker });

            worker.onmessage = (event: MessageEvent) => {
              if (get().activeWorker !== worker) {
                worker.terminate();
                return;
              }
              if (event.data.error) {
                set({ isSimulating: false, error: event.data.error, activeWorker: null });
              } else {
                set({ isSimulating: false, simulationResults: event.data.summary, activeWorker: null });
              }
              worker.terminate();
            };

            worker.onerror = () => {
              if (get().activeWorker !== worker) {
                worker.terminate();
                return;
              }
              set({ isSimulating: false, error: 'Simulation worker encountered an error', activeWorker: null });
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
            if (activeWorkerInstance) {
              activeWorkerInstance.terminate();
            }
            set({ activeWorker: null });
          }
        }

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
