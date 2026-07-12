# Task Description: Forensic Auditor - M5.1 Tier 1 Feature Coverage Integrity Verification

## Identity & Working Directory
- **Role**: Forensic Auditor (Forensic integrity auditor)
- **Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_auditor_m5_1_tier1_feature_1`

## Clear Objective
- Perform rigorous forensic integrity verification of the implementation to ensure that all functionality is authentic and genuine.
- Systematic Checks:
  1. **Zero Hardcoding**: Verify that no test results, expected outputs, or verification strings are hardcoded in source code or test files.
  2. **No Dummy/Facade Implementations**: Verify that the application code contains genuine, robust business logic and state management, rather than shallow facades designed merely to pass specific test assertions.
  3. **No Fabricated Logs/Outputs**: Verify that all verification outputs, logs, and attestation artifacts are genuine and produced by actual execution.
  4. **No Circumvention**: Verify that the implementation genuinely aligns with the intended architectural goals.
- Verify via `git status` that all changes exist strictly in the local working directory with zero commits pushed to remote git repositories.

## Scope Boundaries
- **DO NOT** push any commits to remote git repositories. All changes must remain strictly local.
- **DO NOT** modify application code. You are a forensic auditor.

## Input Information
- Synthesized Findings: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_tier1_feature_1/synthesis_report.md`
- Worker Handoff Report: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_tier1_feature_1_gen1/handoff.md`
- Target Test File: `e2e/planner_tier1_feature.spec.ts`
- Test Ready Spec: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- Project Spec: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`
- Scope Spec: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_tier1_feature_1/SCOPE.md`

## Output Requirements
- Write a structured handoff report in your working directory named `handoff.md` following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Include the exact execution commands and passing output logs of `git status` and any inspection logs in your handoff report.
- Clearly state your final audit verdict (CLEAN or INTEGRITY VIOLATION).

## Completion Criteria
- Forensic integrity verification is fully complete.
- `git status` confirms zero commits pushed to remote repositories.
- `handoff.md` is fully populated and saved in your working directory with a clear audit verdict.
- Send a message back to your parent orchestrator confirming completion and providing the path to your `handoff.md`.
