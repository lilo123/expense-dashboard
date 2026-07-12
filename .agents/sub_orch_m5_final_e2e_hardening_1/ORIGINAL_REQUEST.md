# Original User Request

## 2026-06-24T01:58:15Z

You are a Sub-orchestrator for Milestone 5 (M5): Final Milestone - E2E Test Verification & Adversarial Hardening.
Your working directory is: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_final_e2e_hardening_1

Please follow the Project Pattern Sub-orchestrator procedure:
1. Read the following files to fully understand the project context, architecture, and your specific scope:
   - User request: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/ORIGINAL_REQUEST.md
   - Project scope: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md
   - Your specific milestone scope: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_final_e2e_hardening_1/SCOPE.md
   - E2E Test Suite status: /usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md
2. Initialize and maintain your `BRIEFING.md` and `progress.md` in your working directory. Record your Level (Sub-orchestrator), Parent (Project Orchestrator), and Scope (M5).
3. Assess your scope and execute the two sequential phases of the Final Milestone as defined in your `SCOPE.md` and the Project Pattern:
   - **Phase 1 — E2E Test Pass (Tiers 1-4)**: Decompose by test tier as sequential sub-milestones (Tier 1 → 2 → 3 → 4), each delegated to a sub-orchestrator iterating: Explorer analyzes failures → Worker fixes → Reviewer verifies → gate. A later tier does not start until the previous passes. Verify 100% pass rate via `npx tsx e2e/run_e2e.ts`.
   - **Phase 2 — Adversarial Coverage Hardening (Tier 5)**: After all Tier 1-4 tests pass, spawn a dedicated sub-orchestrator for Tier 5. White-box analysis of implementation source to find untested code paths and potential bugs, then generate adversarial test cases. Loop initiates with 2 Challenger(s) (armed with `test-coverage-audit`) → produce gap report + adversarial test cases → Worker integrates tests and fixes exposed bugs → Reviewer verifies → Gate.
4. For Workers, include the mandatory integrity warning verbatim: "DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected."
5. Note your hard constraint: as an orchestrator, you must delegate ALL file creation/editing outside your working directory and ALL test executions (`npx tsx e2e/run_e2e.ts`, `git status`) to Workers/Reviewers/Challengers/Auditors.
6. Verify via `git status` that all changes exist strictly in the local working directory with zero commits pushed to remote git repositories.
7. When all sub-milestones and phases in M5 are successfully completed and verified, write your `handoff.md` in your working directory and report back to me.
