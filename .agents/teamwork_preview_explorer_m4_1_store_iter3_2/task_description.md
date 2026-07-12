# Task Description: Explorer for M4.1 (Iteration 3) - Zustand Store & URL Hydration

## Objective
Analyze the codebase and recommend a fix strategy for Milestone 4.1: Zustand Store & URL Hydration (`src/store/useRetirementStore.tsx`, `__tests__/planner/useRetirementStore.spec.ts`, `__tests__/planner/adv_useRetirementStore.spec.ts`) based on the adversarial stress test findings and concurrency flaws from Iteration 2.

## Scope Boundaries
- Do NOT implement the code directly (you are a read-only Explorer).
- Focus strictly on fixing `src/store/useRetirementStore.tsx` and ensuring all tests in `useRetirementStore.spec.ts` and `adv_useRetirementStore.spec.ts` pass successfully.

## Previous Adversarial Findings & Failure Output (Iteration 2)
```
**Verdict**: BUG / FAIL in `adv_useRetirementStore.spec.ts`

1. **Worker State Leak**: When `worker.postMessage` fails (e.g. DataCloneError or buffer transfer failure), the store sets `activeWorker: null` but omits `worker.terminate()`, leaving an orphaned worker thread running in memory.
   *Fix Strategy*: In `runSimulation`, when `worker.postMessage` throws an error in the inner try/catch block, explicitly invoke `worker.terminate()` before setting `activeWorker: null`.

2. **Concurrency Race Condition**: `worker.onmessage` and `worker.onerror` do not verify if `get().activeWorker === worker` before setting `simulationResults` or `error`, allowing delayed messages to override a user `reset()`.
   *Fix Strategy*: Inside `worker.onmessage` and `worker.onerror`, add a guard check: `if (get().activeWorker !== worker) { worker.terminate(); return; }` before performing any state updates or setting `activeWorker: null`.
```

## Key Requirements to Plan
1. **Pristine Web Worker Cleanup**: Ensure `worker.terminate()` is reliably invoked if `worker.postMessage` throws an error during simulation instantiation.
2. **Robust Concurrency Guards**: Ensure `worker.onmessage` and `worker.onerror` verify `if (get().activeWorker !== worker)` to prevent delayed background resolutions from corrupting store state after a reset or concurrent simulation run.
3. **100% Test Coverage & Success**: Ensure all 20 test suites and 287+ unit tests in `npm run test __tests__/planner` (including `adv_useRetirementStore.spec.ts`) pass successfully without any leaks or race conditions.

## Output Requirements
- Write a structured handoff report in your working directory (`handoff.md`) following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Report back via `send_message` when complete.
