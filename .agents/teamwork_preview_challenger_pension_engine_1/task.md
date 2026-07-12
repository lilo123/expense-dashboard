# Task: M1.3 Pension Engine Empirical Verification & Stress Testing (Challenger 1)

## Objective
Empirically verify the correctness and robustness of `src/lib/planner/pensionEngine.ts` by performing solution stress testing and adversarial edge case validation.

## Context
- `pensionEngine.ts` is a pure TypeScript business logic engine for US Social Security early/delayed adjustments, Canadian CPP/OAS adjustments, OAS clawbacks above $90,997, Defined Benefit pensions, and household aggregation.
- The engine will be executed across 1,000 parallel Monte Carlo paths in a Web Worker, requiring absolute numerical stability and correctness.

## Tasks
1. Read `src/lib/planner/pensionEngine.ts`, `__tests__/planner/pensionEngine.spec.ts`, and `src/lib/planner/types.ts`.
2. Examine the existing test suite and verify whether it adequately covers extreme claiming ages, precise Normal Retirement Age boundaries, complex OAS clawback threshold sweeps, extreme inflation compounding (e.g., 50+ years elapsed at high inflation), out-of-bounds clamping, and multi-pension household edge cases.
3. If necessary, create an adversarial test file `__tests__/planner/adv_pensionEngine.spec.ts` containing rigorous stress tests.
4. Execute the following verification commands:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsc --noEmit
   npm run test __tests__/planner
   git status
   ```
5. Confirm 100% passing tests and perfect type safety. Confirm zero commits pushed to remote git repositories.
6. Produce a structured handoff report (`handoff.md`) in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_pension_engine_1`) documenting your empirical validation, test logs, and confirmation of correctness.
