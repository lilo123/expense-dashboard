# Task: M1.3 Pension Engine Independent Review 2

## Objective
Independently examine `src/lib/planner/pensionEngine.ts` and `__tests__/planner/pensionEngine.spec.ts` for correctness, completeness, robustness, and interface conformance with `src/lib/planner/types.ts`.

## Context
- `pensionEngine.ts` must be a pure TypeScript business logic engine implementing statutory rules for US Social Security (early claim penalties / delayed retirement credits), Canadian CPP (early/delayed adjustments), Canadian OAS (delayed adjustments, clawback logic), and Defined Benefit pensions.
- Must have zero side effects, no external database calls, and no store state hooks.

## Tasks
1. Read `src/lib/planner/pensionEngine.ts`, `__tests__/planner/pensionEngine.spec.ts`, and `src/lib/planner/types.ts`.
2. Inspect the implementation of US Social Security NRA calculation, early claim penalties (`5/900`, `5/1200`), delayed retirement credits (`2/300`), Canadian CPP early/delayed adjustments (`0.006`, `0.007`), Canadian OAS delayed adjustments (`0.006`), OAS clawback rules above $90,997, Defined Benefit pensions, and household aggregation (`calculateAllPensions`).
3. Execute the following verification commands:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsc --noEmit
   npm run test __tests__/planner
   git status
   ```
4. Confirm 100% passing tests and perfect type safety. Confirm zero commits pushed to remote git repositories.
5. Produce a structured handoff report (`handoff.md`) in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_pension_engine_2`) detailing your findings, verification outputs, and explicit review verdict (PASS or VETO).
