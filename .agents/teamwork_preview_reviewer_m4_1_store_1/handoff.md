# Handoff Report: Review & Verification of M4.1 (Zustand Store & URL Hydration)

## Review Summary

**Verdict**: REQUEST_CHANGES

## 1. Observation
During independent examination of `src/store/useRetirementStore.tsx`, `__tests__/planner/useRetirementStore.spec.ts`, and the execution of `npm run test __tests__/planner`, the following facts were observed:

1. **Production Code Test Backdoor (`src/store/useRetirementStore.tsx:200-204`)**:
   ```tsx
   if (
     typeof window !== 'undefined' &&
     typeof window.Worker !== 'undefined' &&
     !(window as any).__JEST_MOCK_WORKER_FALLBACK__
   ) {
   ```
   The production code explicitly inspects a global test flag `__JEST_MOCK_WORKER_FALLBACK__` to bypass Web Worker instantiation. In `__tests__/planner/useRetirementStore.spec.ts:141-148`, the test suite sets `(window as any).__JEST_MOCK_WORKER_FALLBACK__ = true` to force the fallback execution path.

2. **React Render Phase Side-Effect (`src/store/useRetirementStore.tsx:279-282`)**:
   ```tsx
   if (prevInitialDataRef.current !== initialData && !areInitialDataEqual(prevInitialDataRef.current, initialData)) {
     store.getState().hydrate(initialData);
     prevInitialDataRef.current = initialData;
   }
   ```
   `RetirementStoreProvider` calls `store.getState().hydrate(initialData)` directly within its render function. During test execution (`npm run test __tests__/planner`), this triggers the following verbatim React error in the console:
   ```
   console.error
     Cannot update a component (`TestComponent`) while rendering a different component (`RetirementStoreProvider`). To locate the bad setState() call inside `RetirementStoreProvider`, follow the stack trace as described in https://react.dev/link/setstate-in-render
   ```

3. **Missing Boundary & Adversarial Input Validation (`src/store/useRetirementStore.tsx:115-190`)**:
   `hydrateFromParams` checks `!isNaN(portfolio)`, `!isNaN(withdrawal)`, and `!isNaN(years)`, but lacks boundary checks. Negative values (e.g., `years=-10`, `portfolio=-500000`) or extreme values are accepted directly into the store state, which can destabilize the simulation engine.

## 2. Logic Chain
1. **Integrity Violation (Test Shortcut)**: Embedding `__JEST_MOCK_WORKER_FALLBACK__` directly into production code is an integrity violation and test shortcut. Production code must remain agnostic to test runners. To test the fallback path, the test suite should properly mock or delete `window.Worker` rather than polluting production logic with test-specific flags.
2. **React Architectural Flaw (setState in Render)**: Invoking `store.getState().hydrate()` during the render phase of `RetirementStoreProvider` triggers a Zustand store update while React is actively rendering. Subscribed child components (e.g., `TestComponent` in `renderHook`) are forced to re-render mid-cycle, violating React's pure render rules and causing console errors. Furthermore, mutating `prevInitialDataRef.current` during render renders the subsequent `useIsomorphicLayoutEffect` check dead code. Hydration must occur exclusively inside `useIsomorphicLayoutEffect`.
3. **Robustness Flaw**: Accepting unvalidated numerical inputs (such as negative years or negative balances) from URL search parameters exposes the application to invalid states and simulation worker failures.

## 3. Caveats
- No caveats. All relevant files in M4.1 were fully inspected and verified against the test suite and architectural rules.

## 4. Conclusion
The implementation of M4.1 requires architectural changes and cleanup before it can be approved.

### Findings

#### [Critical] Finding 1: INTEGRITY VIOLATION - Test Backdoor in Production Code
- **What**: Production code checks `!(window as any).__JEST_MOCK_WORKER_FALLBACK__` to bypass Web Worker instantiation.
- **Where**: `src/store/useRetirementStore.tsx:200-204` and `__tests__/planner/useRetirementStore.spec.ts:141-148`.
- **Why**: Pollutes production code with test instrumentation and bypasses proper mocking techniques.
- **Suggestion**: Remove `!(window as any).__JEST_MOCK_WORKER_FALLBACK__` from `useRetirementStore.tsx`. In `useRetirementStore.spec.ts`, test the fallback path by temporarily setting `(window as any).Worker = undefined`.

#### [Major] Finding 2: React Render Phase Side-Effect (`setState` in render)
- **What**: `RetirementStoreProvider` mutates store state and ref values directly during render.
- **Where**: `src/store/useRetirementStore.tsx:279-282`.
- **Why**: Causes React console errors (`Cannot update a component...`), violates pure render rules, and causes redundant layout effect execution.
- **Suggestion**: Remove the render-phase `if` block (lines 279-282) entirely. Rely solely on `useIsomorphicLayoutEffect` (lines 284-290) to perform store hydration and ref updates.

#### [Medium] Finding 3: Lack of Boundary Validation in URL Hydration
- **What**: `hydrateFromParams` accepts invalid/negative numerical values.
- **Where**: `src/store/useRetirementStore.tsx:141-180`.
- **Why**: Adversarial or malformed URL parameters (e.g. `?years=-5`) can corrupt store state and break the simulation engine.
- **Suggestion**: Add boundary checks (e.g., `portfolio >= 0`, `withdrawal >= 0`, `years > 0`) alongside `!isNaN()` checks in `hydrateFromParams`.

## 5. Verification Method
To independently verify these findings and confirm future fixes:
1. Inspect `src/store/useRetirementStore.tsx` to ensure `__JEST_MOCK_WORKER_FALLBACK__` has been removed and no `store.getState().hydrate()` calls exist in the render body of `RetirementStoreProvider`.
2. Run the test suite using the following command and confirm that all tests pass without any React `Cannot update a component...` console errors:
   ```bash
   export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH
   npm run test __tests__/planner
   ```
