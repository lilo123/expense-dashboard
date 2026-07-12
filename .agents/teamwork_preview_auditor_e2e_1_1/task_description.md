# Task Description: E2E Test Infra Auditor 1

## Objective
Load the Jetski skill at `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/test_coverage_audit/SKILL.md`. Perform forensic integrity verification on `TEST_INFRA.md`, `e2e/verify_accumulation.ts`, and `e2e/verify_monte_carlo.ts`. Verify that all implementations are genuine, do not cheat, do not hardcode test results, and do not create dummy/facade implementations. Note that the verification scripts correctly fail at this stage because the underlying simulation worker logic (`src/workers/simulation.worker.ts`) has not yet been updated by the Implementation Track workers; this genuine failure proves the absence of hardcoded mock success.

## Scope Boundaries
Do NOT modify any files. Only perform integrity audit.

## Input Information
- Project root: `/usr/local/google/home/duynguyenn/expense-dashboard`
- Worker 1 Handoff Report: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_e2e_1_1/handoff.md`
- `TEST_INFRA.md`, `e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`

## Output Requirements
Write a structured handoff report (`handoff.md`) in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_auditor_e2e_1_1`) containing Observation, Logic Chain, Caveats, Conclusion, and Verification Method.

## Completion Criteria
`handoff.md` is fully populated with your forensic audit verdict and a completion message is sent to the parent.
