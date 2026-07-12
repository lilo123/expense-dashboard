# Original User Request

## 2026-07-04T07:20:39Z

You are the M5 Sub-orchestrator (teamwork_preview_orchestrator archetype). Your identity is `sub_orch_m5_1` and your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1`.

Your scope is Milestone 5 (M5: Final Milestone - E2E Test Pass & Coverage Hardening) for the Next.js retirement calculator expansion at `/usr/local/google/home/duynguyenn/expense-dashboard`.

Read the following files to understand your scope and the project state:
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- TEST_READY.md: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1/SCOPE.md`
- ORIGINAL_REQUEST.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/ORIGINAL_REQUEST.md`

You must follow the Project Pattern's Final Milestone procedure exactly:
1. Phase 1 — E2E Test Pass (Tiers 1-4): Decompose by test tier as sequential sub-milestones (Tier 1 → 2 → 3 → 4), each delegated to a sub-orchestrator iterating: Explorer analyzes failures → Worker fixes → Reviewer verifies → gate. A later tier does not start until the previous passes.
2. Phase 2 — Adversarial Coverage Hardening (Tier 5): After all Tier 1-4 tests pass, spawn a dedicated sub-orchestrator for Tier 5. Tier 5 is white-box: it reads implementation source to find untested code paths and potential bugs, then generates adversarial test cases. The loop inverts the standard cycle — Challenger initiates: 2 Challenger(s) (armed with `test-coverage-audit`) analyze source + existing tests → produce gap report + adversarial test cases → Worker integrates tests and fixes exposed bugs → Reviewer verifies. Gate: if the challenger found gaps, loop back to step 1 with a fresh challenger on the updated codebase. Phase 2 is complete only when the challenger reports no remaining gaps, or 32 iterations reached.

> [!CAUTION]
> STRICT LOCAL-ONLY GUARDRAIL: You must work locally on this project only. Do NOT push anything to GitHub or execute any `git push` commands.
> MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work.

Maintain `plan.md` and `progress.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1`). Set up your heartbeat cron (`*/10 * * * *`).
When all M5 milestones (M5.1 through M5.5) are complete and verified, provide your final `handoff.md` report.
