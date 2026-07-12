# Scope: M1 - Core Domain Types & Pure Business Logic Engines

## Architecture
- Define Zod validation schemas (`Household`, `Account`, `Spending`, `Pension`, `LifeEvent`, `SimulationConfig`, `SimulationResultsSummary`, `QuickCheckParams`) in `src/lib/planner/types.ts`.
- Implement pure TypeScript business logic engines:
  - `src/lib/planner/taxEngine.ts`: US/CA progressive tax brackets.
  - `src/lib/planner/pensionEngine.ts`: public pension claim-age adjustments and OAS clawbacks.
  - `src/lib/planner/spendingEngine.ts`: spending withdrawal strategies.
  - `src/lib/planner/drawdownEngine.ts` & `src/lib/planner/simulator.ts`: drawdown sequencing.
- Implement comprehensive unit tests in `__tests__/planner/` to verify 100% passing test coverage (`npm run test __tests__/planner`).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Zod Schemas & Domain Types | `src/lib/planner/types.ts`, `__tests__/planner/types.spec.ts` | none | DONE: `src/lib/planner/types.ts`, `__tests__/planner/types.spec.ts`, `__tests__/planner/adv_types.spec.ts`, 30/30 tests pass, clean tsc, clean audit |
| 2 | Tax Engine | `src/lib/planner/taxEngine.ts`, `__tests__/planner/taxEngine.spec.ts` | M1.1 | DONE: `src/lib/planner/taxEngine.ts`, `__tests__/planner/taxEngine.spec.ts`, `__tests__/planner/adv_taxEngine.spec.ts`, `__tests__/planner/adv_taxEngine_2.spec.ts`, 72/72 tests pass, clean tsc, clean audit |
| 3 | Pension Engine | `src/lib/planner/pensionEngine.ts`, `__tests__/planner/pensionEngine.spec.ts` | M1.1 | DONE: `src/lib/planner/pensionEngine.ts`, `__tests__/planner/pensionEngine.spec.ts`, `__tests__/planner/adv_pensionEngine.spec.ts`, `__tests__/planner/adv_pensionEngine_2.spec.ts`, 127/127 tests pass, clean tsc, clean audit |
| 4 | Spending Engine | `src/lib/planner/spendingEngine.ts`, `__tests__/planner/spendingEngine.spec.ts` | M1.1 | DONE: `src/lib/planner/spendingEngine.ts`, `__tests__/planner/spendingEngine.spec.ts`, `__tests__/planner/adv_spendingEngine.spec.ts`, 166/166 tests pass, clean tsc, clean audit |
| 5 | Drawdown & Simulator | `src/lib/planner/drawdownEngine.ts`, `src/lib/planner/simulator.ts`, `__tests__/planner/drawdownEngine.spec.ts` | M1.1, M1.2, M1.3, M1.4 | DONE: `src/lib/planner/drawdownEngine.ts`, `src/lib/planner/simulator.ts`, `__tests__/planner/drawdownEngine.spec.ts`, `__tests__/planner/simulator.spec.ts`, `__tests__/planner/adv_drawdownEngine.spec.ts`, `__tests__/planner/adv_simulator.spec.ts`, 219/219 tests pass, clean tsc, clean audit |

## Interface Contracts
### `src/lib/planner/types.ts` ↔ Engines
- All engines must import and use Zod schemas and inferred TypeScript types from `types.ts`.
- Pure functions with zero side effects.
