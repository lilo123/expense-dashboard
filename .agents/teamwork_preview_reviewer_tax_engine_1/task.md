# Task: M1.2 Tax Engine Independent Review 1

## Objective
Independently examine `src/lib/planner/taxEngine.ts` and `__tests__/planner/taxEngine.spec.ts` for correctness, completeness, robustness, and interface conformance with `src/lib/planner/types.ts`.

## Context
- `taxEngine.ts` must be a pure TypeScript business logic engine implementing progressive tax brackets for US and CA jurisdictions, handling different income types (ordinary income, capital gains, tax-deferred withdrawals vs taxable account capital gains vs tax-free withdrawals) and pro-rata basis recovery.
- Must have zero side effects, no external database calls, and no store state hooks.

## Tasks
1. Read `src/lib/planner/taxEngine.ts`, `__tests__/planner/taxEngine.spec.ts`, and `src/lib/planner/types.ts`.
2. Inspect the implementation of US Social Security provisional income rules, Long-Term Capital Gains stacking, CA Basic Personal Amounts, CA capital gains inclusion rates, OAS clawback rules, and `calculateProRataCapitalGain`.
3. Execute the following verification commands:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsc --noEmit
   npm run test __tests__/planner
   git status
   ```
4. Confirm 100% passing tests and perfect type safety. Confirm zero commits pushed to remote git repositories.
5. Produce a structured handoff report (`handoff.md`) in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_tax_engine_1`) detailing your findings, verification outputs, and explicit review verdict (PASS or VETO).
