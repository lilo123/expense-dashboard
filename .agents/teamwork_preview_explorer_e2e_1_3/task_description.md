# Task Description: E2E Test Infra Explorer 3

## Objective
Investigate the codebase at `/usr/local/google/home/duynguyenn/expense-dashboard` to design a comprehensive opaque-box test suite (`TEST_INFRA.md`) and automated verification scripts (`e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`) derived from user requirements in `ORIGINAL_REQUEST.md`. Recommend a concrete implementation strategy for `TEST_INFRA.md` (following the 4-tier methodology with at least 38 test cases across the 3 main features: Global Market Data Toggle, Accumulation Phase & Timeline Toggle, Simulation Mode Toggle) and the two verification scripts.

## Scope Boundaries
Do NOT implement the changes or create/modify any source code or project files directly. Only investigate, analyze, and recommend the fix/implementation strategy.

## Input Information
- Project root: `/usr/local/google/home/duynguyenn/expense-dashboard`
- `PROJECT.md`: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- `SCOPE.md`: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_e2e_1/SCOPE.md`
- `ORIGINAL_REQUEST.md`: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_e2e_1/ORIGINAL_REQUEST.md`
- Existing E2E test runner: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`

## Output Requirements
Write a structured handoff report (`handoff.md`) in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_e2e_1_3`) containing Observation, Logic Chain, Caveats, Conclusion, and Verification Method.

## Completion Criteria
`handoff.md` is fully populated with concrete architectural recommendations and test case designs for `TEST_INFRA.md`, `e2e/verify_accumulation.ts`, and `e2e/verify_monte_carlo.ts`, and a completion message is sent to the parent.
