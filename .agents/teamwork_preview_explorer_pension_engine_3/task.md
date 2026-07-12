# Task: M1.3 Pension Engine Exploration

## Objective
Explore the requirements and design for `src/lib/planner/pensionEngine.ts` and its unit tests `__tests__/planner/pensionEngine.spec.ts`.

## Context
- `src/lib/planner/types.ts` contains the Zod schemas and TypeScript domain types (e.g. `Household`, `Pension`).
- The pension engine must be a pure TypeScript business logic engine implementing public pension claim-age adjustments (US Social Security early claim penalties / delayed retirement credits, Canadian CPP early/delayed adjustments, Canadian OAS delayed adjustments) and OAS clawback logic.
- Must adhere to the interface contracts defined in `PROJECT.md` and `SCOPE.md`.

## Tasks
1. Read `src/lib/planner/types.ts`, `PROJECT.md`, and `SCOPE.md`.
2. Investigate the statutory rules and mathematical formulas for:
   - **US Social Security**: Full/Normal Retirement Age (NRA) based on birth year, early claiming penalties (down to age 62), and delayed retirement credits (up to age 70).
   - **Canadian CPP**: Standard start age 65, early claiming reduction (0.6% per month down to age 60), and delayed claiming increase (0.7% per month up to age 70).
   - **Canadian OAS**: Standard start age 65, delayed claiming increase (0.6% per month up to age 70), and OAS clawback thresholds (~$90,997 net income base).
   - **Defined Benefit**: Flat or inflation-adjusted base amounts starting at a specified `startAge`.
3. Propose a robust, pure functional architecture for `pensionEngine.ts` and a comprehensive test strategy for `pensionEngine.spec.ts`.
4. Produce a structured handoff report (`handoff.md`) in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_pension_engine_3`) with verified evidence chains and concrete recommendations.
