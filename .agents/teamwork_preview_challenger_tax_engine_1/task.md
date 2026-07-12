# Task: M1.2 Tax Engine Empirical Verification & Stress Testing (Challenger 1)

## Objective
Empirically verify the correctness and robustness of `src/lib/planner/taxEngine.ts` by performing solution stress testing and adversarial edge case validation.

## Context
- `taxEngine.ts` is a pure TypeScript business logic engine for US and CA progressive tax brackets, Social Security provisional income thresholds, Long-Term Capital Gains stacking, CA capital gains inclusion rates, OAS clawbacks, and pro-rata basis recovery.
- The engine will be executed across 1,000 parallel Monte Carlo paths in a Web Worker, requiring absolute numerical stability and correctness.

## Tasks
1. Read `src/lib/planner/taxEngine.ts`, `__tests__/planner/taxEngine.spec.ts`, and `src/lib/planner/types.ts`.
2. Examine the existing test suite and verify whether it adequately covers extreme wealth inputs ($10M+), negative/zero income bounds, precise bracket threshold crossings, complex Social Security/OAS benefit phase-outs, and pro-rata withdrawal edge cases (e.g., basis exceeding balance, withdrawal exceeding balance).
3. If necessary, create an adversarial test file `__tests__/planner/adv_taxEngine.spec.ts` containing rigorous stress tests.
4. Execute the following verification commands:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsc --noEmit
   npm run test __tests__/planner
   git status
   ```
5. Confirm 100% passing tests and perfect type safety. Confirm zero commits pushed to remote git repositories.
6. Produce a structured handoff report (`handoff.md`) in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_tax_engine_1`) documenting your empirical validation, test logs, and confirmation of correctness.
