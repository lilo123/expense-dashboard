# Task Description: Explorer for M4.1 (Iteration 2) - Zustand Store & URL Hydration

## Objective
Analyze the codebase and recommend a fix strategy for Milestone 4.1: Zustand Store & URL Hydration (`src/store/useRetirementStore.tsx`, `__tests__/planner/useRetirementStore.spec.ts`) based on the review feedback and identified integrity violations from Iteration 1.

## Scope Boundaries
- Do NOT implement the code directly (you are a read-only Explorer).
- Focus strictly on fixing `src/store/useRetirementStore.tsx` and `__tests__/planner/useRetirementStore.spec.ts`.

## Previous Review Feedback & Failure Output (Iteration 1)
```
**Verdict**: REQUEST_CHANGES

1. **Production Code Test Backdoor (`src/store/useRetirementStore.tsx:200-204`)**:
   `if (typeof window !== 'undefined' && typeof window.Worker !== 'undefined' && !(window as any).__JEST_MOCK_WORKER_FALLBACK__)`
   The production code explicitly inspects a global test flag `__JEST_MOCK_WORKER_FALLBACK__` to bypass Web Worker instantiation. In `__tests__/planner/useRetirementStore.spec.ts`, the test suite sets `(window as any).__JEST_MOCK_WORKER_FALLBACK__ = true` to force the fallback execution path.
   *Fix Strategy*: Remove `!(window as any).__JEST_MOCK_WORKER_FALLBACK__` from `useRetirementStore.tsx`. In `useRetirementStore.spec.ts`, test the fallback path by temporarily setting `(window as any).Worker = undefined`.

2. **React Render Phase Side-Effect (`src/store/useRetirementStore.tsx:279-282`)**:
   `RetirementStoreProvider` calls `store.getState().hydrate(initialData)` directly within its render function. During test execution (`npm run test __tests__/planner`), this triggers the following verbatim React error in the console: `Cannot update a component (TestComponent) while rendering a different component (RetirementStoreProvider)`.
   *Fix Strategy*: Remove the render-phase `if` block entirely. Rely solely on `useIsomorphicLayoutEffect` to perform store hydration and ref updates.

3. **Missing Boundary & Adversarial Input Validation (`src/store/useRetirementStore.tsx:115-190`)**:
   `hydrateFromParams` checks `!isNaN(portfolio)`, `!isNaN(withdrawal)`, and `!isNaN(years)`, but lacks boundary checks. Negative values (e.g., `years=-10`, `portfolio=-500000`) or extreme values are accepted directly into the store state, which can destabilize the simulation engine.
   *Fix Strategy*: Add boundary checks (e.g., `portfolio >= 0`, `withdrawal >= 0`, `years > 0`) alongside `!isNaN()` checks in `hydrateFromParams`.
```

## Key Requirements to Plan
1. **Clean Production Code**: Ensure `useRetirementStore.tsx` has zero test-specific backdoor flags (`__JEST_MOCK_WORKER_FALLBACK__`).
2. **Pure React Provider**: Ensure `RetirementStoreProvider` contains zero `setState` or `hydrate` calls during the render phase. All hydration must happen cleanly inside `useIsomorphicLayoutEffect`.
3. **Robust Hydration Validation**: Add rigorous numerical boundary checks in `hydrateFromParams`.
4. **100% Test Coverage**: Update `useRetirementStore.spec.ts` to properly mock `(window as any).Worker = undefined` to verify the fallback path, ensuring 100% passing test coverage in Jest without any React console errors.

## Output Requirements
- Write a structured handoff report in your working directory (`handoff.md`) following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Report back via `send_message` when complete.
