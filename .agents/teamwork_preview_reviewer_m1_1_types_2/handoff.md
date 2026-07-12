# Milestone 1.1 Review & Adversarial Critique Report

## 1. Observation
- **Files Examined**: 
  - `src/lib/planner/types.ts` (103 lines, defining 8 Zod schemas and inferred TypeScript types: `Account`, `Spending`, `Pension`, `LifeEvent`, `SimulationConfig`, `Household`, `SimulationResultsSummary`, `QuickCheckParams`).
  - `__tests__/planner/types.spec.ts` (275 lines, comprehensive unit test suite covering valid/invalid parsing cases for all 8 schemas).
  - `.agents/orchestrator/PROJECT.md` & `.agents/sub_orch_m1_core_domain_1/SCOPE.md` (defining M1.1 architectural goals and interface contracts).
  - `docs/PRD_RETIREMENT_PLANNER.md` & `ARCHITECTURE.md` (defining domain pillars and CUJs).
- **Independent Verification Execution**:
  - Executed `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/types.spec.ts`
  - **Result**: `PASS __tests__/planner/types.spec.ts`. 1 test suite passed, 19 tests passed, 19 total. Time: 0.911s.
  - Executed `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npx tsc --noEmit`
  - **Result**: Clean TypeScript compilation with zero errors.
- **Integrity Check**:
  - No hardcoded test results, dummy/facade implementations, or fabricated verification outputs were found. All Zod validations (`z.string().min(1)`, `z.number().nonnegative()`, `z.enum(...)`, etc.) are fully and genuinely implemented.

## 2. Logic Chain
1. **Correctness & Compilation**: `npx tsc --noEmit` completes with zero errors, proving that the exported TypeScript types (`Household`, `Account`, `Spending`, `Pension`, `LifeEvent`, `SimulationConfig`, `SimulationResultsSummary`, `QuickCheckParams`) are correctly inferred from their Zod schemas (`z.infer<typeof ...>`) and are syntactically valid in TypeScript 5.x.
2. **Test Coverage & Robustness**: `npm run test __tests__/planner/types.spec.ts` successfully passes 19 out of 19 unit tests. The test suite rigorously verifies boundary conditions (e.g., negative balances/costs, invalid enum types, out-of-bound ages [50-80], out-of-bound weights [0-1], and out-of-bound success rates [0-100]).
3. **Interface Conformance**: `SCOPE.md` and `PROJECT.md` mandate Zod schemas and exported types for the 8 core entities to serve as pure contracts for upcoming business logic engines (`taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`). `src/lib/planner/types.ts` fulfills this contract exactly.
4. **Architectural & Adversarial Findings**: While the current schemas meet all M1.1 specifications, adversarial examination against `PRD_RETIREMENT_PLANNER.md` reveals two areas for future robustness enhancement (asset allocation tracking in `AccountSchema` and URL search param coercion in `QuickCheckParamsSchema`). These do not block M1.1 but serve as vital guidance for subsequent engine and store milestones.

## 3. Caveats
- The schemas are evaluated as pure domain definitions and validation contracts. Downstream integration with `useRetirementStore.tsx` (Zustand) and `simulation.worker.ts` (Web Worker) in Milestones 2-4 will determine if additional runtime transformations or default values are necessary.
- No other caveats.

## 4. Conclusion
**Final Verdict**: PASS (APPROVE)

The Zod schemas and domain types in `src/lib/planner/types.ts` are correct, complete, robust, and fully conformant with the interface requirements in `PROJECT.md` and `SCOPE.md`. 100% of unit tests pass, TypeScript compilation is clean, and zero integrity violations were detected.

---

## Review Summary

**Verdict**: APPROVE

## Findings

### [Minor] Finding 1: Missing Asset Allocation Fields in AccountSchema
- **What**: `AccountSchema` defines `expectedReturnOverride` but does not explicitly include asset allocation breakdown fields (e.g., `stocksWeight`, `bondsWeight`, `cashWeight`).
- **Where**: `src/lib/planner/types.ts`, lines 4-12.
- **Why**: `PRD_RETIREMENT_PLANNER.md` (Section 3, Pillar 2) states that Accounts management *"Includes custom asset allocation sliders (Stocks vs. Bonds vs. Cash)."* If the simulation or UI requires explicit tracking of these percentages per account, the schema will need these optional fields.
- **Suggestion**: In Milestone 4 (UI & Store), consider adding `assetAllocation: z.object({ stocks: z.number(), bonds: z.number(), cash: z.number() }).optional()` to `AccountSchema`.

## Verified Claims
- `100% passing test coverage` → verified via `npm run test __tests__/planner/types.spec.ts` → PASS
- `Clean TypeScript compilation` → verified via `npx tsc --noEmit` → PASS
- `Zero integrity violations` → verified via source code inspection → PASS

## Coverage Gaps
- `Asset Allocation Sliders` — risk level: low — recommendation: investigate during M4 UI implementation.

## Unverified Items
- None. All items within M1.1 scope were fully verified.

---

## Challenge Summary

**Overall risk assessment**: LOW

## Challenges

### [Medium] Challenge 1: Raw URL Search Parameter Hydration Failure in QuickCheckParamsSchema
- **Assumption challenged**: `QuickCheckParamsSchema` assumes incoming data types are native JavaScript numbers (`z.number()`).
- **Attack scenario**: According to `PRD_RETIREMENT_PLANNER.md` (CUJ 2: Authenticated Detailed Builder), `useRetirementStore.tsx` parses incoming URL search parameters via `QuickCheckParamsSchema`. URL search parameters parsed via `Object.fromEntries(searchParams)` yield string values (`{ portfolio: "1000000", withdrawal: "4", years: "30" }`). Calling `QuickCheckParamsSchema.parse()` on this object will throw a Zod validation error because `z.number()` does not automatically coerce strings.
- **Blast radius**: Initial landing page handoff to `/plans/new` would fail to hydrate the Zustand store, breaking CUJ 2.
- **Mitigation**: When implementing `useRetirementStore.tsx` in M4, either ensure the store explicitly converts URL parameter strings to numbers before calling `.parse()`, or update `QuickCheckParamsSchema` to use `z.coerce.number()` (e.g., `portfolio: z.coerce.number().nonnegative(...)`).

## Stress Test Results
- `Negative/Invalid Values in Schemas` → Zod throws expected validation errors → PASS
- `Out-of-bounds Percentiles and Ages` → Zod rejects invalid ranges correctly → PASS

## Unchallenged Areas
- `Web Worker memory buffer serialization` — reason not challenged: out of scope for M1.1 (planned for M2).

---

## 5. Verification Method
To independently verify the results of this review, execute the following commands in the project root:

1. **Verify Unit Tests**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npm run test __tests__/planner/types.spec.ts
   ```
2. **Verify TypeScript Compilation**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsc --noEmit
   ```
3. **Inspect Domain Schemas**:
   ```bash
   cat src/lib/planner/types.ts
   ```
