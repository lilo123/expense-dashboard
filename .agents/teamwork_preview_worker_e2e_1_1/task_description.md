# Task Description: E2E Test Infra Worker 1

## Objective
Implement the comprehensive opaque-box test suite (`TEST_INFRA.md`) at project root and the automated verification scripts (`e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`) based on the synthesized Explorer findings and user requirements in `ORIGINAL_REQUEST.md`.

## Scope Boundaries
Do NOT modify any implementation source code files (`src/**`). Only create `TEST_INFRA.md`, `e2e/verify_accumulation.ts`, and `e2e/verify_monte_carlo.ts`.

## Input Information
- Project root: `/usr/local/google/home/duynguyenn/expense-dashboard`
- Explorer 3 Handoff Report: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_e2e_1_3/handoff.md` (contains the complete recommended markdown for `TEST_INFRA.md` with 45 test cases and the complete TypeScript code for `e2e/verify_accumulation.ts` and `e2e/verify_monte_carlo.ts`).
- Explorer 1 & 2 Handoff Reports: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_e2e_1_1/handoff.md`, `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_e2e_1_2/handoff.md`.

## Output Requirements
Create `TEST_INFRA.md` at project root, `e2e/verify_accumulation.ts`, and `e2e/verify_monte_carlo.ts`. Write a structured handoff report (`handoff.md`) in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_e2e_1_1`) containing Observation, Logic Chain, Caveats, Conclusion, and Verification Method.

## Completion Criteria
`TEST_INFRA.md`, `e2e/verify_accumulation.ts`, and `e2e/verify_monte_carlo.ts` are successfully created. `handoff.md` is fully populated, and a completion message is sent to the parent.
