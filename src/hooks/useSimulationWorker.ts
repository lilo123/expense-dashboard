import { useState, useEffect, useRef } from 'react';
import * as Comlink from 'comlink';
import { SimulationConfig, SimulationSummary } from '../types/simulation';
import type { SimulationService } from '../workers/simulation.worker';

// Web Worker Singleton initialized once on the client side with HMR safeguards
const globalWorker = globalThis as unknown as { __workerSingleton?: Comlink.Remote<SimulationService> };

function getWorker() {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  if (!globalWorker.__workerSingleton) {
    const rawWorker = new Worker(new URL('../workers/simulation.worker', import.meta.url), { type: 'module' });
    globalWorker.__workerSingleton = Comlink.wrap<SimulationService>(rawWorker);
  }
  return globalWorker.__workerSingleton;
}

export function useSimulationWorker(initialConfig: SimulationConfig) {
  const [result, setResult] = useState<SimulationSummary | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  const activeRunIdRef = useRef<number>(0);

  useEffect(() => {
    const worker = getWorker();
    if (!worker) return;

    setIsCalculating(true);
    const runId = ++activeRunIdRef.current;

    // Direct asynchronous execution without double-debounce latency
    worker.runSimulation(initialConfig)
      .then((summary) => {
        if (activeRunIdRef.current === runId) {
          setResult(summary);
          setIsCalculating(false);
        }
      })
      .catch((error) => {
        if (activeRunIdRef.current === runId) {
          console.error('Simulation worker error:', error);
          setIsCalculating(false);
        }
      });

    return () => {
      activeRunIdRef.current += 1;
    };
  }, [initialConfig]);

  return {
    config: initialConfig,
    result,
    isCalculating,
  };
}
