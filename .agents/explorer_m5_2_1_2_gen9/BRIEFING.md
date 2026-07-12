# BRIEFING — 2026-07-07T22:35:19Z

## Mission
Investigate `e2e/run_e2e.ts` and formulate a bulletproof fix strategy for self-terminating teardown (`fuser -k`), failure masking (`npx tsx`), shared result cache (`/tmp/run_e2e.success.cache`), stale lock pruning thresholds (`etimes > 7200`), and neutralized `ensureSupabaseHealthTimeout()`.

## 🔒 My Identity
- Archetype: Explorer
- Roles: Explorer 2 Gen 9 (`explorer_m5_2_1_2_gen9`)
- Working directory: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/explorer_m5_2_1_2_gen9`
- Original parent: `sub_orch_m5_1_2` (`146cbac2-ff6c-49f8-9aac-45a3340c272f`)
- Milestone: M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Network restrictions: CODE_ONLY network mode (no external websites, curl, wget, etc.)
- Strict adherence to Handoff Protocol (5-component report)
- `.agents/` must contain only metadata

## Current Parent
- Conversation ID: `146cbac2-ff6c-49f8-9aac-45a3340c272f`
- Updated: 2026-07-07T22:35:19Z

## Investigation State
- **Explored paths**: `e2e/run_e2e.ts`, `__tests__/db/recurring_db.test.ts`, `supabase/config.toml`, `PROJECT.md`, `TEST_READY.md`, `.agents/sub_orch_m5_1_2/SCOPE.md`, `.agents/reviewer_m5_2_1_1_gen8/handoff.md`, `.agents/reviewer_m5_2_1_2_gen8/handoff.md`, `.agents/challenger_m5_2_1_2_gen8/handoff.md`, `.agents/challenger_m5_2_1_1_gen8_rep/handoff.md`, `.agents/challenger_m5_2_1_2_gen8_rep/handoff.md`, `.agents/auditor_m5_2_1_gen8_rep/handoff.md`
- **Key findings**: 
  1. `fuser -k` in `teardownSupabase()` kills `run_e2e.ts` and `jest` because `fetch()`/`pg.Client` open sockets on ports 54321/25432.
  2. `npx tsx` masks `SIGKILL` terminations and exits with code 0, fabricating false test passes.
  3. Shared result cache (`/tmp/run_e2e.success.cache`) acts as a shortcut/facade bypassing genuine test execution.
  4. Stale lock pruning threshold is hardcoded to `etimes > 7200` (2 hours) instead of `etimes > 900` (15 mins), causing queue deadlocks.
  5. `ensureSupabaseHealthTimeout()` was neutralized, leaving `supabase/config.toml` vulnerable to configuration drift.
- **Unexplored areas**: None. Comprehensive evidence chain established.

## Key Decisions Made
- Formulated a bulletproof remediation design for the next Worker to implement across `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts`.

## Artifact Index
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/explorer_m5_2_1_2_gen9/ORIGINAL_REQUEST.md` — Stores incoming requests and messages
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/explorer_m5_2_1_2_gen9/progress.md` — Liveness heartbeat and progress tracking
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/explorer_m5_2_1_2_gen9/handoff.md` — Final 5-component handoff report
