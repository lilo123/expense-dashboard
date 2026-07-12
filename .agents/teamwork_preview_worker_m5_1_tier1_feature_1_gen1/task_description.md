# Task Description: Worker - M5.1 Tier 1 Feature Coverage Implementation (Gen 1 Replacement)

## Identity & Working Directory
- **Role**: Worker (Versatile worker with loadable domain expertise, gen 1 replacement)
- **Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_tier1_feature_1_gen1`
- **Domain Skill**: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Clear Objective
- Resume work from predecessor's last known state: all 9 files (`QuickCheckWidget.tsx`, `login/page.tsx`, `useRetirementStore.tsx`, `types.ts`, `PlanBuilder.tsx`, `SimulationTab.tsx`, `retirementActions.ts`, `plans/page.tsx`, `plans/[id]/page.tsx`) were successfully updated by your predecessor to align with `e2e/planner_tier1_feature.spec.ts` and `synthesis_report.md`.
- Inspect the code changes to ensure correctness and verify that the critical RSC `"use client";` directive in `useRetirementStore.tsx` and BOLA form injection structure in `PlanBuilder.tsx` are correctly implemented.
- Run `npx tsx e2e/run_e2e.ts` to verify that all tests pass successfully with absolute success (exit code 0).
- Verify via `git status` that all changes exist strictly in the local working directory with zero commits pushed to remote git repositories.

## Scope Boundaries
- **DO NOT** push any commits to remote git repositories. All changes must remain strictly local.
- **DO NOT** break existing architectural patterns or introduce unnecessary packages/libraries.

## Input Information
- Synthesized Findings: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_tier1_feature_1/synthesis_report.md`
- Target Test File: `e2e/planner_tier1_feature.spec.ts`
- Test Ready Spec: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- Project Spec: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`
- Scope Spec: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_tier1_feature_1/SCOPE.md`

## Output Requirements
- Write a structured handoff report in your working directory named `handoff.md` following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Include the exact execution commands and passing output logs of `npx tsx e2e/run_e2e.ts` and `git status` in your handoff report.

## Completion Criteria
- Code changes are fully verified.
- `npx tsx e2e/run_e2e.ts` executes with absolute success (exit code 0).
- `git status` confirms zero commits pushed to remote repositories.
- `handoff.md` is fully populated and saved in your working directory.
- Send a message back to your parent orchestrator confirming completion and providing the path to your `handoff.md`.
