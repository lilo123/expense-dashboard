# Handoff Report: Challenger for M4.1 (Iteration 2) - Zustand Store & URL Hydration

## 1. Observation
- Verified existing unit test suite (`npm run test __tests__/planner`) passed 100% (19 test suites, 279 tests passed).
- Extracted feature matrix from `task_description.md` and `src/store/useRetirementStore.tsx`, identifying 14 core features and 4 specific edge-case/concurrency gaps.
- Executed adversarial test suite (`npm run test __tests__/planner/adv_useRetirementStore.spec.ts`), which resulted in 6 passing tests and 2 failing tests exposing genuine flaws.
- **Verbatim Error 1 (Concurrency Race Condition / State Overwrite)**:
  ```
  ● adv_useRetirementStore (Adversarial & Stress Testing) › 3. Concurrency Race Conditions & State Leaks › should verify behavior when a terminated worker receives a delayed onmessage (concurrency race condition)
    expect(received).toEqual(expected) // deep equality
    - Expected  - 4
    + Received  + 4
      Object {
    -   "medianFinalBalance": 3000,
    -   "ninetiethPercentileFinalBalance": 6000,
    -   "successRate": 99,
    -   "tenthPercentileFinalBalance": 1000,
    +   "medianFinalBalance": 1000,
    +   "ninetiethPercentileFinalBalance": 2000,
    +   "successRate": 50,
    +   "tenthPercentileFinalBalance": 200,
      }
  ```
- **Verbatim Error 2 (Web Worker Resource Leak)**:
  ```
  ● adv_useRetirementStore (Adversarial & Stress Testing) › 3. Concurrency Race Conditions & State Leaks › should terminate worker when postMessage throws an error (Worker resource leak check)
    expect(jest.fn()).toHaveBeenCalled()
    Expected number of calls: >= 1
    Received number of calls:    0
  ```

## 2. Logic Chain
1. **Concurrency Race Condition & State Overwrite**: In `src/store/useRetirementStore.tsx`, `worker.onmessage` unconditionally calls `set({ isSimulating: false, simulationResults: event.data.summary, activeWorker: null })`. It fails to verify if `get().activeWorker === worker`. If a worker is terminated due to a concurrent `runSimulation()` or `reset()`, but an in-flight message or delayed callback executes, it overwrites the active simulation state and destroys the new `activeWorker` reference.
2. **Web Worker Resource Leak**: When `worker.postMessage(...)` throws an error (e.g. DataCloneError or neutered buffer), the `catch` block logs a warning and calls `set({ activeWorker: null })` but fails to call `worker.terminate()`. The instantiated Web Worker remains active in the background indefinitely, leaking system resources.
3. **Robustness & Hydration Verification**: The 6 passing tests in `adv_useRetirementStore.spec.ts` empirically prove that `hydrateFromParams` correctly handles exact zero boundary values (`portfolio=0`, `withdrawal=0`), invalid/NaN inputs, missing spending/accounts structures, 1000 rapid sequential hydration calls without corruption, outer catch block non-Error throwables, and `areInitialDataEqual` nested object comparisons.

## 3. Caveats
- Review-only constraint: Per instructions, no implementation code in `src/store/useRetirementStore.tsx` was modified to fix these findings.
- Testing environment: Web Worker concurrency and error throws were tested using Jest mock wrappers simulating the exact browser worker interface and event lifecycle.

## 4. Conclusion
- The implementation of `useRetirementStore.tsx` is robust against invalid inputs, extreme stress hydration loops, and boundary values.
- Two high-severity architectural vulnerabilities were uncovered by adversarial stress testing: a **concurrency race condition state overwrite** in `worker.onmessage` and a **Web Worker resource leak** when `worker.postMessage` throws.
- Both vulnerabilities must be addressed by adding `if (get().activeWorker === worker)` checks inside `onmessage` and ensuring `worker.terminate()` is called inside the `postMessage` catch block.

## 5. Verification Method
- Execute the adversarial test suite to observe the failures:
  ```bash
  export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH
  npm run test __tests__/planner/adv_useRetirementStore.spec.ts
  ```
- To verify the base test suite passes:
  ```bash
  export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH
  npm run test __tests__/planner/useRetirementStore.spec.ts
  ```

---

## Coverage Audit Summary

- Features in matrix: 14
- Features covered by existing tests: 10 (10/14 = 71.4%)
- Uncovered features: 4
- Adversarial tests written: 8
- Adversarial tests that exposed failures: 2

## Feature Matrix

| Feature | Source | Category | Test File(s) | Covered? |
|---------|--------|----------|--------------|----------|
| Standalone store state initialization & defaults | Spec & Source | Lifecycle | `useRetirementStore.spec.ts` | ✅ Yes |
| Store update actions (`setHousehold`, `updateHousehold`, etc.) | Spec & Source | State Management | `useRetirementStore.spec.ts` | ✅ Yes |
| Store reset action & active worker termination | Spec & Source | Lifecycle | `useRetirementStore.spec.ts` | ✅ Yes |
| Store state hydration (`hydrate`) | Spec & Source | State Management | `useRetirementStore.spec.ts` | ✅ Yes |
| URLSearchParams & plain object hydration (`hydrateFromParams`) | Spec & Source | Input Handling | `useRetirementStore.spec.ts` | ✅ Yes |
| Dynamic account creation on empty accounts hydration | Spec & Source | Input Handling | `useRetirementStore.spec.ts` | ✅ Yes |
| Web Worker simulation dispatch (`runSimulation`) | Spec & Source | Concurrency | `useRetirementStore.spec.ts` | ✅ Yes |
| Fallback direct execution when Worker undefined | Spec & Source | Fallback | `useRetirementStore.spec.ts` | ✅ Yes |
| React context provider & hook (`RetirementStoreProvider`, `useRetirementStore`) | Spec & Source | React Integration | `useRetirementStore.spec.ts` | ✅ Yes |
| Provider initialData comparison (`areInitialDataEqual`) | Spec & Source | React Integration | `useRetirementStore.spec.ts` | ✅ Yes |
| Hydration exact zero boundary values & unexpected dictionary types | Source B | Input Handling | `adv_useRetirementStore.spec.ts` | ❌ No (Added in adv) |
| Stress testing 1000 rapid sequential hydration calls | Source B | Stress Testing | `adv_useRetirementStore.spec.ts` | ❌ No (Added in adv) |
| Web Worker concurrency race condition (delayed onmessage check) | Source B | Concurrency | `adv_useRetirementStore.spec.ts` | ❌ No (Added in adv) |
| Web Worker resource leak on postMessage throw | Source B | Lifecycle | `adv_useRetirementStore.spec.ts` | ❌ No (Added in adv) |

## Gap Report

| Feature | Severity | Why it matters |
|---------|----------|----------------|
| Web Worker concurrency race condition | High | A delayed message from a terminated worker overwrites active simulation state and clears activeWorker reference. |
| Web Worker resource leak on postMessage throw | High | Instantiated Web Workers remain running in the background indefinitely if postMessage throws (e.g. DataCloneError). |
| Hydration exact zero boundary values & unexpected types | Medium | Ensures store does not corrupt state or crash when given extreme edge case parameters. |
| Stress testing 1000 rapid sequential hydration calls | Medium | Verifies store memory stability and state consistency under high-frequency parameter changes. |

## Adversarial Test Results

| Test File | Feature Targeted | Reference | Product | Verdict |
|-----------|------------------|-----------|---------|---------|
| `adv_useRetirementStore.spec.ts` | Hydration boundary values (`portfolio=0`, `withdrawal=0`, `years=1`) | PASS | PASS | PASS |
| `adv_useRetirementStore.spec.ts` | Invalid/NaN/empty/unexpected types in hydration params | PASS | PASS | PASS |
| `adv_useRetirementStore.spec.ts` | Missing household.spending and household.accounts fallback | PASS | PASS | PASS |
| `adv_useRetirementStore.spec.ts` | Stress testing 1000 rapid sequential hydration calls | PASS | PASS | PASS |
| `adv_useRetirementStore.spec.ts` | Concurrency race condition (delayed onmessage check) | PASS | FAIL | BUG |
| `adv_useRetirementStore.spec.ts` | Web Worker resource leak on postMessage throw | PASS | FAIL | BUG |
| `adv_useRetirementStore.spec.ts` | Unhandled promises & non-Error throwables in outer catch | PASS | PASS | PASS |
| `adv_useRetirementStore.spec.ts` | Provider areInitialDataEqual stress & nested object changes | PASS | PASS | PASS |

## New Test Files
- `/usr/local/google/home/duynguyenn/expense-dashboard/__tests__/planner/adv_useRetirementStore.spec.ts`
