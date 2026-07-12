# BRIEFING — 2026-07-04T08:36:51Z

## Mission
Investigate `e2e/run_e2e.ts` and the codebase, analyze the root causes of Supabase connection refusals (`ECONNREFUSED 127.0.0.1:54321`), and recommend a concrete, bulletproof fix strategy for Milestone 5.1 (Tier 1 E2E Test Pass).

## 🔒 My Identity
- Archetype: Explorer
- Roles: `teamwork_preview_explorer`
- Working directory: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter4_2`
- Original parent: `a2dfdb1c-4cd3-448f-b6c1-9f62b94fa3c3`
- Milestone: M5.1 (Tier 1 E2E Test Pass - Feature Coverage)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Eliminate ALL Supabase failure modes (container conflicts, lock/pid files, corrupted backup restorations, and API gateway configuration loss)
- Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`)
- Ensure `try...catch` around Playwright test execution remains removed
- Verify other underlying E2E test failures once Playwright runs genuinely

## Current Parent
- Conversation ID: `a2dfdb1c-4cd3-448f-b6c1-9f62b94fa3c3`
- Updated: 2026-07-04T08:36:51Z

## Investigation State
- **Explored paths**: `e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/*.spec.ts`, `e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`, `playwright.config.ts`, `PROJECT.md`, `TEST_READY.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`
- **Key findings**: 
  1. `e2e/run_e2e.ts` purges `supabase/.temp` (destroying API gateway configs) and uses `npx supabase start --ignore-health-check` followed by arbitrary `docker start` commands, breaking Kong dependency startup order and causing `ECONNREFUSED`.
  2. `pkill -9 -f next` is successfully replaced by `fuser -k 3000/tcp`.
  3. `try...catch` around Playwright test execution is successfully removed, ensuring genuine error propagation.
  4. Post-build `docker stop` and `docker start` in `e2e/run_e2e.ts` (lines 108, 116) represent a secondary underlying E2E failure mode by forcibly restarting containers out of dependency order.
- **Unexplored areas**: None. Comprehensive E2E test suite inspection completed.

## Key Decisions Made
- Recommend exact surgical changes to `setup()` and `run()` in `e2e/run_e2e.ts` to remove `supabase/.temp` deletion, remove `--ignore-health-check`, and eliminate disruptive `docker start`/`docker stop` commands.

## Artifact Index
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter4_2/ORIGINAL_REQUEST.md` — Stores the original user request
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter4_2/BRIEFING.md` — Situational awareness and investigation state
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter4_2/progress.md` — Liveness heartbeat and progress tracking
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter4_2/handoff.md` — 5-Component Handoff Report with concrete fix strategy
