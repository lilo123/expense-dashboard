# BRIEFING — 2026-07-04T08:40:29Z

## Mission
Investigate e2e/run_e2e.ts and the codebase, analyze the root causes of Supabase connection refusals, and recommend a concrete, bulletproof fix strategy for Supabase lifecycle management, process management, error propagation, and any underlying E2E test failures.

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: Explorer 1 (Iteration 4) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage)
- Working directory: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter4_1
- Original parent: a2dfdb1c-4cd3-448f-b6c1-9f62b94fa3c3
- Milestone: M5.1 Tier 1 E2E Test Pass (Feature Coverage)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Eliminate Supabase connection refusals by combining stop --no-backup, docker rm -f, and start without rm -rf supabase/.temp and without --ignore-health-check
- Ensure pkill -9 -f next remains removed (replaced by fuser -k 3000/tcp)
- Ensure try...catch block around Playwright test execution remains removed
- Verify what other underlying E2E test failures exist once Playwright runs genuinely, and recommend fix strategies

## Current Parent
- Conversation ID: a2dfdb1c-4cd3-448f-b6c1-9f62b94fa3c3
- Updated: 2026-07-04T08:40:29Z

## Investigation State
- **Explored paths**: `e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/*.spec.ts`, `e2e/verify_*.ts`, `playwright.config.ts`
- **Key findings**: 
  - `rm -rf supabase/.temp`, `--ignore-health-check`, and raw `docker start` commands corrupt the Supabase API gateway and violate dependency startup order, causing `ECONNREFUSED 127.0.0.1:54321`.
  - `fuser -k 3000/tcp` is correctly in place (no `pkill -9 -f next`).
  - Playwright execution correctly lacks a `try...catch` block, ensuring genuine error propagation.
- **Unexplored areas**: None (investigation complete).

## Key Decisions Made
- Recommended exact code changes to `setup()` in `e2e/run_e2e.ts` to combine `npx supabase stop --no-backup`, `docker rm -f`, and `npx supabase start`.
- Recommended removing raw `docker start` and `docker stop` commands around `npm run build` to maintain a stable Supabase gateway.

## Artifact Index
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter4_1/ORIGINAL_REQUEST.md — Original request from user/parent
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter4_1/progress.md — Liveness heartbeat and progress tracking
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter4_1/handoff.md — Handoff report with forensic audit and concrete fix strategy
