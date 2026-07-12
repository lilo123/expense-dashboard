'use client';

import React, { createContext, useContext } from 'react';
import { SimulationConfig, SimulationSummary } from './types/simulation';
import { useSimulationWorker } from './hooks/useSimulationWorker';

interface SimulationContextValue {
  config: SimulationConfig;
  result: SimulationSummary | null;
  isCalculating: boolean;
  updateConfig?: (newConfig: SimulationConfig) => void;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

interface SimulationProviderProps {
  initialConfig: SimulationConfig;
  children: React.ReactNode;
}

export function SimulationProvider({ initialConfig, children }: SimulationProviderProps) {
  const simulationState = useSimulationWorker(initialConfig);

  return (
    <SimulationContext.Provider value={{ ...simulationState, updateConfig: () => {} }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
}
