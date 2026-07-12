# Task: M1.2 Tax Engine Exploration

## Objective
Explore the requirements and design for `src/lib/planner/taxEngine.ts` and its unit tests `__tests__/planner/taxEngine.spec.ts`.

## Context
- `src/lib/planner/types.ts` contains the Zod schemas and TypeScript domain types (e.g. `Household`, `Account`).
- The tax engine must be a pure TypeScript business logic engine implementing progressive tax brackets for US and CA jurisdictions, handling different income types (ordinary income, capital gains, tax-deferred withdrawals vs taxable account capital gains vs tax-free withdrawals).
- Must adhere to the interface contracts defined in `PROJECT.md` and `SCOPE.md`.

## Tasks
1. Read `src/lib/planner/types.ts`, `PROJECT.md`, and `SCOPE.md`.
2. Investigate the requirements for US and CA progressive tax calculation, including standard deductions/basic personal amounts, federal brackets, and treatment of capital gains vs ordinary income.
3. Propose a robust, pure functional architecture for `taxEngine.ts` and a comprehensive test strategy for `taxEngine.spec.ts`.
4. Produce a structured handoff report (`handoff.md`) in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_tax_engine_2`) with verified evidence chains and concrete recommendations.
