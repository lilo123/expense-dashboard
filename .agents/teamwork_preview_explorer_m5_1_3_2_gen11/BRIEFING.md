# BRIEFING — 2026-07-07T23:11:34Z

## Mission
Investigate `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` to recommend a concrete fix strategy addressing four critical defects uncovered in Iteration 10.

## 🔒 My Identity
- Archetype: Stellar Teamwork explorer
- Roles: Read-only investigation: analyze problems, synthesize findings, produce structured reports
- Working directory: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_3_2_gen11
- Original parent: a8913a06-6c70-4412-a0be-320b71f0f9cf
- Milestone: M5.3 Explorer 2 gen11 (`teamwork_preview_explorer`)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- STRICT LOCAL-ONLY GUARDRAIL: work locally on this project only. Do NOT push anything to GitHub or execute any `git push` commands.
- MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine.
- Network Restrictions: CODE_ONLY network mode.

## Current Parent
- Conversation ID: a8913a06-6c70-4412-a0be-320b71f0f9cf
- Updated: 2026-07-07T23:11:34Z

## Investigation State
- **Explored paths**: `e2e/run_e2e.ts`, `__tests__/db/recurring_db.test.ts`, `instructions.md`, `.agents/teamwork_preview_worker_m5_1_3_gen10/handoff.md`, `.agents/teamwork_preview_explorer_m5_1_3_1_gen10/proposed_run_e2e.ts`, `.agents/teamwork_preview_explorer_m5_1_3_1_gen10/proposed_recurring_db.test.ts`
- **Key findings**: 
  1. `killCmd` in `teardownSupabase()` (`e2e/run_e2e.ts:343`, `__tests__/db/recurring_db.test.ts:100`) lacks `grep -v docker` and `grep -v bash`, causing process suicide (exit code 137) when matching `name=supabase` in the verification command.
  2. `robustSupabaseRestart()` (`e2e/run_e2e.ts:502-525`) wipes the database and runs `e2e/init_db.ts` but omits `e2e/seed.ts`, causing cascading Playwright test failures.
  3. The shared success cache (`/tmp/run_e2e.success.cache`) relies solely on a 300s timestamp window, allowing E2E test bypassing even if the codebase state changes.
  4. `protectProcessTree()` (`e2e/run_e2e.ts:36-57`) fails silently with `Permission denied` in non-root environments (`duynguyenn`). Spawning `supabase start` while Playwright runs causes OOM kills (exit code 137).
- **Unexplored areas**: None. All 4 defects have been thoroughly analyzed.

## Key Decisions Made
- Formulated concrete fix strategies for all 4 defects, including exact code replacements for `killCmd`, `robustSupabaseRestart`, git-hash-based cache validation, and application-level memory/concurrency management.

## Artifact Index
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_3_2_gen11/ORIGINAL_REQUEST.md — Store original request
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_3_2_gen11/progress.md — Liveness heartbeat and progress tracking
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_3_2_gen11/handoff.md — Final 5-component handoff report
