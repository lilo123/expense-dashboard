# Handoff Report — M4.1 Store Explorer (Iteration 3)

## Observation
- **File inspected**: `src/store/useRetirementStore.tsx` (lines 202-260).
  - Observed `runSimulation` implementation. When `window.Worker` is available, it instantiates a `new Worker(...)` at line 218 and sets `activeWorker: worker` at line 219.
  - Observed `worker.onmessage` (lines 221-228) and `worker.onerror` (lines 230-233) handlers. Neither handler checks if `get().activeWorker === worker` before updating store state (`isSimulating`, `error`, `simulationResults`, `activeWorker`).
  - Observed `worker.postMessage` at lines 235-240. If `worker.postMessage` throws an error (e.g., `DataCloneError`), it is caught by `catch (err: any)` at lines 242-245. The catch block executes `console.warn(...)` and `set({ activeWorker: null })`, but omits calling `worker.terminate()`.
- **File inspected**: `__tests__/planner/adv_useRetirementStore.spec.ts` (lines 88-154).
  - Observed test `should verify behavior when a terminated worker receives a delayed onmessage (concurrency race condition)` (lines 89-133). It triggers a second simulation, simulates a delayed `onmessage` from the first worker, and expects the store state not to be overwritten by the first worker's result.
  - Observed test `should terminate worker when postMessage throws an error (Worker resource leak check)` (lines 135-152). It mocks `Worker` such that `postMessage` throws an error, and explicitly asserts `expect(terminateMock).toHaveBeenCalled()`.
- **File inspected**: `__tests__/planner/useRetirementStore.spec.ts` (lines 153-270).
  - Observed standard Web Worker integration tests, including fallback execution, successful `onmessage`, worker error payload in `onmessage`, `onerror` dispatch, and concurrent `runSimulation` calls.

## Logic Chain
1. **Worker State Leak on postMessage Failure**:
   - *From Observation*: In `src/store/useRetirementStore.tsx`, `worker = new Worker(...)` is instantiated inside the `try` block (line 218). If `worker.postMessage(...)` (line 235) throws an error (such as a buffer transfer failure or `DataCloneError`), execution jumps to the `catch (err: any)` block at line 242.
   - *Inference*: Because `worker.terminate()` is not called in the catch block, the worker thread remains alive in memory but orphaned since `activeWorker` is set to `null`. This directly causes the failure in `adv_useRetirementStore.spec.ts` line 151 (`expect(terminateMock).toHaveBeenCalled()`).
   - *Fix Formulation*: Declare `let worker: Worker | null = null;` prior to the inner `try` block (e.g., right after `if (typeof window !== 'undefined' && typeof window.Worker !== 'undefined') {`). Inside `try`, assign `worker = new Worker(...)`. In the `catch (err: any)` block, add `if (worker) { worker.terminate(); }` (or alternatively `get().activeWorker?.terminate();`) before calling `set({ activeWorker: null });`.

2. **Concurrency Race Condition in Worker Event Handlers**:
   - *From Observation*: `worker.onmessage` (line 221) and `worker.onerror` (line 230) unconditionally execute `set({ ... })` and `worker.terminate()`.
   - *Inference*: If a user triggers `reset()` or calls `runSimulation()` a second time, `activeWorker` is updated to `null` or a new worker instance. If an asynchronous, delayed `onmessage` or `onerror` event from a prior worker fires subsequently, it will overwrite the store state with stale simulation results or errors. This directly causes the failure in `adv_useRetirementStore.spec.ts` line 132.
   - *Fix Formulation*: Inside both `worker.onmessage` and `worker.onerror`, insert a guard clause at the very beginning of the callback: `if (get().activeWorker !== worker) { worker.terminate(); return; }`. This ensures that any event originating from a stale or orphaned worker is discarded immediately, and the orphaned worker is cleanly terminated without corrupting store state.

## Caveats
- No caveats. The investigation completely covers `src/store/useRetirementStore.tsx` and all relevant test suites in `__tests__/planner/useRetirementStore.spec.ts` and `__tests__/planner/adv_useRetirementStore.spec.ts`. The recommended fixes operate entirely within the existing state management paradigms and Web Worker lifecycle without introducing new dependencies or altering public APIs.

## Conclusion
- The observed failures in `adv_useRetirementStore.spec.ts` stem from two precise flaws in `src/store/useRetirementStore.tsx`: an orphaned Web Worker thread when `postMessage` throws, and a lack of identity verification in asynchronous worker event callbacks.
- **Actionable Fix Strategy for Implementer**:
  1. **In `src/store/useRetirementStore.tsx` lines 217-246**: Modify `runSimulation` to declare `let worker: Worker | null = null;` before the inner `try` block. In the corresponding `catch (err: any)` block, explicitly invoke `if (worker) { worker.terminate(); }` prior to `set({ activeWorker: null });`.
  2. **In `src/store/useRetirementStore.tsx` lines 221-234**: Insert the guard clause `if (get().activeWorker !== worker) { worker.terminate(); return; }` at the top of both `worker.onmessage` and `worker.onerror` callbacks.

## Verification Method
- **Automated Test Verification**: Run the Jest test suites for the planner store using the following command:
  ```bash
  npm run test __tests__/planner
  ```
- **Specific Target Files to Confirm Pass**:
  - `__tests__/planner/adv_useRetirementStore.spec.ts` (specifically checking `Concurrency Race Conditions & State Leaks` tests).
  - `__tests__/planner/useRetirementStore.spec.ts` (confirming no regressions in existing store behavior).
- **Invalidation Conditions**: If any test fails, or if `activeWorker` does not correctly align with the active worker instance during consecutive simulation runs, the fix strategy must be re-evaluated.
