import { create } from 'zustand';
import { SimulationConfig, QuickCheckParams } from '../types/simulation';

export interface RetirementStoreState {
  quickCheckParams: QuickCheckParams;
  simulationConfig: SimulationConfig | null;
  setQuickCheckParams: (params: QuickCheckParams) => void;
  setSimulationConfig: (config: SimulationConfig) => void;
  syncQuickCheckToConfig: (setQuery: any) => void;
  syncConfigToQuickCheck: (config: SimulationConfig) => void;
}

export const useRetirementStore = create<RetirementStoreState>((set, get) => ({
  quickCheckParams: {
    initialPortfolio: 1000000,
    annualWithdrawal: 40000,
    duration: 30,
    equities: 60,
    bonds: 40,
    cash: 0,
    withdrawalStrategy: 'constant_dollar',
  },
  simulationConfig: null,
  setQuickCheckParams: (params) => set({ quickCheckParams: params }),
  setSimulationConfig: (config) => set({ simulationConfig: config }),
  syncQuickCheckToConfig: (setQuery) => {
    const { quickCheckParams } = get();
    if (setQuery) {
      setQuery({
        initialPortfolio: quickCheckParams.initialPortfolio,
        annualWithdrawal: quickCheckParams.annualWithdrawal,
        initialWithdrawal: quickCheckParams.annualWithdrawal,
        duration: quickCheckParams.duration,
        equities: quickCheckParams.equities,
        bonds: quickCheckParams.bonds,
        cash: quickCheckParams.cash,
        withdrawalStrategy: quickCheckParams.withdrawalStrategy,
      }, { history: 'push', shallow: true });
    }
  },
  syncConfigToQuickCheck: (config) => {
    set({
      quickCheckParams: {
        initialPortfolio: config.initialPortfolio,
        annualWithdrawal: config.annualWithdrawal ?? config.initialWithdrawal ?? 40000,
        duration: config.duration,
        equities: config.equities,
        bonds: config.bonds,
        cash: config.cash,
        withdrawalStrategy: config.withdrawalStrategy,
      },
      simulationConfig: config,
    });
  },
}));
