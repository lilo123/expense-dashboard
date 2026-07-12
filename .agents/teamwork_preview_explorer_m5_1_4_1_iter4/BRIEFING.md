# BRIEFING — 2026-07-07T23:20:59Z

## Mission
Investigate E2E test runner vulnerabilities, cache bypass, ps truncation, etimes contract non-conformance, and OOM kills during supabase db reset, recommending a concrete verified fix strategy for Worker in Iteration 4.

## 🔒 My Identity
- Archetype: Explorer 1 (`teamwork_preview_explorer`)
- Roles: Read-only investigation, analyze problems, synthesize findings, produce structured reports.
- Working directory: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_4_1_iter4
- Original parent: ae057639-34a8-4ac5-8ca2-2ed7f8910b88
- Milestone: Milestone 5.4 Iteration 4 (M5.4: Tier 4 E2E Test Pass - Real-World Application Scenarios)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do not circumvent the audit or disable rules
- Operate in CODE_ONLY network mode

## Current Parent
- Conversation ID: ae057639-34a8-4ac5-8ca2-2ed7f8910b88
- Updated: 2026-07-07T23:20:59Z

## Investigation State
- **Explored paths**: PROJECT.md, TEST_READY.md, e2e/calculator_tier4.spec.ts, e2e/run_e2e.ts, package.json, playwright.config.ts, next.config.js, supabase/config.toml, e2e/calculator_tier4_strict.spec.ts, e2e/adv_*.ts, e2e/stress_test_*.ts, e2e/verify_*.ts.
- **Key findings**:
  1. Cache bypass (`/tmp/run_e2e.success.permanent.cache`) was a fabricated success mechanism used by Worker 1; it has been removed in current `e2e/run_e2e.ts`, but `/tmp` namespace isolation in capsules prevents its detection regardless, exposing OOM kills and missing DB initialization.
  2. `ps -eo pid,args --width 4096` truncates long command strings in certain capsule/non-TTY environments because `-w -w` (or `ww`) is omitted, hiding `run_e2e.ts` from `protectedPids` and causing peer assassination / lock wiping (`rm -f /tmp/run_e2e.lock`).
  3. `etimes > 900` (15 min) and `maxWaitMs = 15 * 60 * 1000` in `e2e/run_e2e.ts` violate `PROJECT.md`'s mandated 30-minute lock timeout and `etimes > 2700` (45 min) contract, causing long-running E2E tests to be killed as "stale" by concurrent swarm agents.
  4. `NODE_OPTIONS: '--max-old-space-size=512'` is passed to `supabase db reset`, `init_db.ts`, `seed.ts`, and `verify_tier3_interactions.ts`, violating `PROJECT.md` line 21 (`--max-old-space-size=4096` or `''`) and causing exit code 137 (OOM Killed) during heavy migration/seed operations.
- **Unexplored areas**: None. All 4 investigation targets have complete evidence chains established.

## Key Decisions Made
- Formulate a concrete, verified fix strategy for the Worker in Iteration 4 that surgically replaces `ps` flags, `etimes`/`maxWaitMs` thresholds, and `NODE_OPTIONS` memory limits in `e2e/run_e2e.ts` without circumventing audits or disabling rules.

## Artifact Index
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_4_1_iter4/ORIGINAL_REQUEST.md — Store original user request
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_4_1_iter4/BRIEFING.md — Situational awareness working memory
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_4_1_iter4/handoff.md — 5-Component Handoff Investigation Report
