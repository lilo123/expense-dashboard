## Coverage Audit Summary

- Features in matrix: 12
- Features covered by existing tests: 10 (10/12 = 83.3%)
- Uncovered features: 2
- Adversarial tests written: 8
- Adversarial tests that exposed failures: 2

## Feature Matrix

| Feature | Source | Category | Test File(s) | Covered? |
|---------|--------|----------|--------------|----------|
| Standalone store default initialization | Spec & Source | Store Initialization | `useRetirementStore.spec.ts` | ✅ Yes |
| State mutators (setHousehold, updateHousehold, etc.) | Spec & Source | State Management | `useRetirementStore.spec.ts` | ✅ Yes |
| Store reset & worker termination on reset | Spec & Source | State Management | `useRetirementStore.spec.ts` | ✅ Yes |
| Store hydration from partial state | Spec & Source | State Management | `useRetirementStore.spec.ts` | ✅ Yes |
| URLSearchParams & plain object hydration | Spec & Source | Hydration | `useRetirementStore.spec.ts` | ✅ Yes |
| Dynamic account creation on empty accounts array | Spec & Source | Hydration | `useRetirementStore.spec.ts` | ✅ Yes |
| Ignoring negative boundary values in hydration | Spec & Source | Hydration | `useRetirementStore.spec.ts` | ✅ Yes |
| Ignoring years=0 boundary value in hydration | Source B (Code) | Hydration | `adv_useRetirementStore.spec.ts` | ✅ Yes |
| Robust handling of missing accounts/spending sub-objects | Source B (Code) | Hydration | `adv_useRetirementStore.spec.ts` | ✅ Yes |
| Web Worker instantiation & fallback execution | Spec & Source | Worker Integration | `useRetirementStore.spec.ts` | ✅ Yes |
| Web Worker cleanup on postMessage failure | Source B (Code) | Worker Integration | `adv_useRetirementStore.spec.ts` | ❌ No (Orphan leak) |
| Web Worker onmessage race condition protection | Source B (Code) | Worker Integration | `adv_useRetirementStore.spec.ts` | ❌ No (Race condition) |

## Gap Report

| Feature | Severity | Why it matters |
|---------|----------|----------------|
| Web Worker cleanup on postMessage failure | High | If `worker.postMessage` throws (e.g. DataCloneError), `set({ activeWorker: null })` is called without `worker.terminate()`, leaving an orphaned worker thread running in memory. |
| Web Worker onmessage race condition protection | Medium | `onmessage` does not verify if `get().activeWorker === worker` before setting `simulationResults`, allowing delayed messages to override a user `reset()`. |

## Adversarial Test Results

| Test File | Feature Targeted | Reference | Product | Verdict |
|-----------|------------------|-----------|---------|---------|
| `adv_useRetirementStore.spec.ts` | Exact boundary values (`portfolio=0`, `years=0`) | PASS | PASS | PASS |
| `adv_useRetirementStore.spec.ts` | NaN and invalid string hydration | PASS | PASS | PASS |
| `adv_useRetirementStore.spec.ts` | Extremely large number hydration | PASS | PASS | PASS |
| `adv_useRetirementStore.spec.ts` | Duplicate keys in URLSearchParams | PASS | PASS | PASS |
| `adv_useRetirementStore.spec.ts` | Missing `accounts`/`spending` sub-objects | PASS | PASS | PASS |
| `adv_useRetirementStore.spec.ts` | Web Worker cleanup on postMessage failure | PASS | FAIL | BUG (Worker State Leak) |
| `adv_useRetirementStore.spec.ts` | Worker `onmessage` race condition post-reset | PASS | FAIL | BUG (Race Condition) |
| `adv_useRetirementStore.spec.ts` | Deep nested inequality in `areInitialDataEqual` | PASS | PASS | PASS |

## New Test Files

- `/usr/local/google/home/duynguyenn/expense-dashboard/__tests__/planner/adv_useRetirementStore.spec.ts`

## 5-Component Handoff Report

### 1. Observation
- Inspecting `src/store/useRetirementStore.tsx:218-245` reveals that when `worker.postMessage` throws an error, the `catch (err: any)` block executes `console.warn(...)` and `set({ activeWorker: null })`, but does not call `worker.terminate()`.
- Inspecting `src/store/useRetirementStore.tsx:221-228` reveals that `worker.onmessage` directly sets `isSimulating: false, simulationResults: event.data.summary` without checking if `get().activeWorker === worker`.
- Running `npm run test __tests__/planner` successfully executes 20 test suites and 287 tests, including `__tests__/planner/adv_useRetirementStore.spec.ts` which empirically confirms both the worker state leak and the `onmessage` race condition.

### 2. Logic Chain
- Because `worker` is instantiated via `new Worker(...)`, a background thread is spawned immediately. When `worker.postMessage` fails (e.g. due to buffer transfer issues or cloning errors), clearing `activeWorker` from the store without calling `worker.terminate()` removes the only reference to the worker, resulting in an orphaned worker thread that cannot be cleaned up by subsequent `reset()` calls.
- Because `worker.onmessage` lacks an active worker check (`get().activeWorker === worker`), any delayed or rogue message arriving after `store.reset()` will incorrectly update `simulationResults` and override the clean reset state.

### 3. Caveats
- Tested within a Jest DOM / Node.js mock environment where `window.Worker` is simulated. In real browser environments, `worker.terminate()` immediately halts thread execution, but `postMessage` transfer failures will still leak the thread if `terminate()` is not invoked in the catch block.

### 4. Conclusion
- The implementation of `useRetirementStore` provides robust parameter hydration and fallback handling, but contains two specific concurrency/lifecycle flaws: a Web Worker state leak on `postMessage` failure and a potential race condition in `onmessage` following a store reset.

### 5. Verification Method
- Execute the full test suite including adversarial tests:
  ```bash
  export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH
  npm run test __tests__/planner
  ```
- Inspect `/usr/local/google/home/duynguyenn/expense-dashboard/__tests__/planner/adv_useRetirementStore.spec.ts` to review the empirical stress test cases.
