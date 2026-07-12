# Verification Plan — Milestone 5.4 Challenger

## Objective
Empirically verify the correctness and robustness of Worker 2's fixes for Milestone 5.4 (Tier 4 E2E Test Pass - Real-World Application Scenarios).

## Step-by-Step Plan

1. **Codebase & Fix Inspection**
   - Inspect `e2e/run_e2e.ts`, `src/components/BudgetPlanner.tsx`, `src/app/(dashboard)/budget/loading.tsx`, `__tests__/components/CalculatorUIStress.test.tsx`, `src/app/page.tsx`, `e2e/calculator_tier4.spec.ts`, `e2e/budget_streaming_suspense.spec.ts`.
   - Verify what Worker 2 changed and ensure no reward hacking or improper test disabling occurred (e.g., verifying `AxeBuilder` disabled rules are justified).

2. **Unit Test Verification**
   - Run `npm test` to verify all unit tests pass cleanly.

3. **Master E2E Test Verification**
   - Run `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && node node_modules/.bin/tsx e2e/run_e2e.ts`.
   - Verify exit code 0 across all 5 browser projects (`chromium`, `firefox`, `webkit`, `mobile-chrome`, `mobile-safari`).
   - Monitor test execution and maintain liveness heartbeat in `progress.md`.

4. **Adversarial Review & Stress Testing**
   - Stress-test assumptions made in Worker 2's fixes.
   - Verify whether E2E tests are robust against flakiness or edge cases.

5. **Handoff Report Generation**
   - Write `handoff.md` in `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_m5_1_4_1` following the 5-component protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
   - Send completion message to parent agent.
