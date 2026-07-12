# BRIEFING — 2026-07-07T07:16:44Z

## Mission
Investigate `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` to recommend a concrete fix strategy for Worker Gen 4 that addresses Supabase reachability timeouts, container dependency ordering, daemon collisions, profile deletion, and standalone `npm test` database dependency failures for M5.2.

## 🔒 My Identity
- Archetype: Explorer 3 (`teamwork_preview_explorer_m5_2_3_gen4`)
- Roles: Read-only investigation, problem analysis, fix strategy recommendation
- Working directory: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_2_3_gen4`
- Original parent: `sub_orch_m5_1_2` (ID: `4a89333e-c013-48bf-9176-fec25b4ad161`)
- Milestone: M5.2 (Tier 2 E2E Test Pass - Boundary & Corner Cases)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement changes yourself.
- STRICT LOCAL-ONLY GUARDRAIL: Work locally on this project only. Do NOT push anything to GitHub or execute any `git push` commands.

## Current Parent
- Conversation ID: `4a89333e-c013-48bf-9176-fec25b4ad161`
- Updated: 2026-07-07T07:17:49Z

## Investigation State
- **Explored paths**: `e2e/run_e2e.ts`, `__tests__/db/recurring_db.test.ts`, `PROJECT.md`, `TEST_READY.md`, `SCOPE.md`, `.agents/teamwork_preview_auditor_m5_2_1_gen3/handoff.md`, `.agents/teamwork_preview_reviewer_m5_2_1_gen3/handoff.md`
- **Key findings**: 
  1. `e2e/run_e2e.ts` (lines 86-98) enforces a strict 30-second timeout (`checkRetries = 30`) during `setup()`, causing premature teardowns and retry storms when Supabase containers take >30s to initialize on cold boots.
  2. `__tests__/db/recurring_db.test.ts` (lines 11-15) unconditionally connects to `postgresql://postgres:postgres@127.0.0.1:25432/postgres` in `beforeAll()`, causing standalone `npm test` to fail with `connect ECONNREFUSED 127.0.0.1:25432` when Supabase is not running.
  3. `e2e/run_e2e.ts` uses `--ignore-health-check` in `npx supabase start`, breaking container dependency ordering and causing Supabase Realtime to crash (`Failed to detect IP version for DB_HOST: nxdomain`).
  4. `e2e/run_e2e.ts` uses an inner retry loop `(without teardown)` that collides with orphaned lockfiles (`supabase start is already running`).
  5. `e2e/run_e2e.ts` `teardownSupabase()` executes `docker network prune -f`, which collides with `npx supabase start` (`Error response from daemon: a prune operation is already running`, `exit 143`).
  6. `e2e/run_e2e.ts` `teardownSupabase()` executes `rm -rf $HOME/.supabase`, deleting the Supabase CLI profile configuration (`open .../.supabase/profile: no such file or directory`).
- **Unexplored areas**: None (root causes fully identified).

## Key Decisions Made
- Recommend removing `--ignore-health-check` from `npx supabase start`.
- Recommend removing `docker network prune -f` and `rm -rf $HOME/.supabase` from `teardownSupabase()`.
- Recommend eliminating the inner retry loop in `e2e/run_e2e.ts` `setup()` and `robustSupabaseRestart()`, ensuring `teardownSupabase()` executes synchronously before any retry of `npx supabase start`.
- Recommend increasing `checkRetries` in `e2e/run_e2e.ts` to `120`.
- Recommend wrapping `client.connect()` in `__tests__/db/recurring_db.test.ts` with a try/catch block and using a `dbConnected` flag to gracefully skip test execution and hooks when Supabase Postgres is unreachable during standalone `npm test`.

## Artifact Index
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_2_3_gen4/ORIGINAL_REQUEST.md` — Original request from caller
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_2_3_gen4/BRIEFING.md` — Situational awareness and investigation state
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_2_3_gen4/handoff.md` — Structured handoff report with concrete fix strategy for Worker Gen 4
