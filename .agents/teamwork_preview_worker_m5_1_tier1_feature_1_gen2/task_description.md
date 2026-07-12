# Task Description: Worker - M5.1 Tier 1 Feature Coverage Implementation (Iteration 2)

## Identity & Working Directory
- **Role**: Worker (Versatile worker with loadable domain expertise, gen 2 replacement / Iteration 2)
- **Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_tier1_feature_1_gen2`
- **Domain Skill**: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Clear Objective
- Read the synthesized findings report at `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_tier1_feature_1/synthesis_report_iter2.md`.
- Implement the precise, surgical code fixes across the 6 identified files (`src/app/page.tsx`, `src/components/QuickCheckWidget.tsx`, `src/app/actions/retirementActions.ts`, `src/app/plans/page.tsx`, `src/components/PlanBuilder.tsx`, `src/components/SimulationTab.tsx`) to address all 92 test failures from Iteration 1.
- Run `npx tsx e2e/run_e2e.ts` to verify that all 152 tests pass successfully with absolute success (exit code 0).
- Verify via `git status` that all changes exist strictly in the local working directory with zero commits pushed to remote git repositories.

## Scope Boundaries
- **DO NOT** push any commits to remote git repositories. All changes must remain strictly local.
- **DO NOT** break existing architectural patterns or introduce unnecessary packages/libraries.

## Input Information
- Synthesized Findings: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_tier1_feature_1/synthesis_report_iter2.md`
- Target Test Files: `e2e/*.spec.ts`
- Test Ready Spec: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- Project Spec: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`
- Scope Spec: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_tier1_feature_1/SCOPE.md`

## Output Requirements
- Write a structured handoff report in your working directory named `handoff.md` following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Include the exact execution commands and passing output logs of `npx tsx e2e/run_e2e.ts` (`152 passed`) and `git status` in your handoff report.

## Completion Criteria
- All 6 files are successfully updated with the precise fixes.
- `npx tsx e2e/run_e2e.ts` executes with absolute success (exit code 0, 152 passed).
- `git status` confirms zero commits pushed to remote repositories.
- `handoff.md` is fully populated and saved in your working directory.
- Send a message back to your parent orchestrator confirming completion and providing the path to your `handoff.md`.
