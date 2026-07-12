# Task Description: Reviewer - M5.1 Tier 1 Feature Coverage Verification

## Identity & Working Directory
- **Role**: Reviewer (High-reliability review agent)
- **Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_1_tier1_feature_1`

## Clear Objective
- Independently verify the correctness, completeness, robustness, and interface conformance of the code changes implemented by the Worker in the 9 target files (`QuickCheckWidget.tsx`, `login/page.tsx`, `useRetirementStore.tsx`, `types.ts`, `PlanBuilder.tsx`, `SimulationTab.tsx`, `retirementActions.ts`, `plans/page.tsx`, `plans/[id]/page.tsx`).
- Run `npx tsx e2e/run_e2e.ts` to independently confirm that the E2E test suite executes with absolute success (exit code 0).
- Verify via `git status` that all changes exist strictly in the local working directory with zero commits pushed to remote git repositories.

## Scope Boundaries
- **DO NOT** push any commits to remote git repositories. All changes must remain strictly local.
- **DO NOT** make unnecessary stylistic changes or modify files outside the intended scope.

## Input Information
- Synthesized Findings: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_tier1_feature_1/synthesis_report.md`
- Worker Handoff Report: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_tier1_feature_1_gen1/handoff.md`
- Target Test File: `e2e/planner_tier1_feature.spec.ts`
- Test Ready Spec: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- Project Spec: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`
- Scope Spec: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_tier1_feature_1/SCOPE.md`

## Output Requirements
- Write a structured handoff report in your working directory named `handoff.md` following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Include the exact execution commands and passing output logs of `npx tsx e2e/run_e2e.ts` and `git status` in your handoff report.
- Clearly state your final review verdict (PASS or VETO).

## Completion Criteria
- Code changes are independently verified.
- `npx tsx e2e/run_e2e.ts` executes with absolute success (exit code 0).
- `git status` confirms zero commits pushed to remote repositories.
- `handoff.md` is fully populated and saved in your working directory with a clear verdict.
- Send a message back to your parent orchestrator confirming completion and providing the path to your `handoff.md`.
