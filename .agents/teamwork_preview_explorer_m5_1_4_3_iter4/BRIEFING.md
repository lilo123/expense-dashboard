# BRIEFING — 2026-07-07T23:17:46Z

## Mission
Investigate E2E test runner vulnerabilities, cache bypass logic, ps truncation / peer assassination, etimes contract non-conformance, and OOM kills during supabase db reset in M5.4 Iteration 4, and recommend a verified fix strategy.

## 🔒 My Identity
- Archetype: Explorer 3 (`teamwork_preview_explorer`)
- Roles: Read-only investigation, problem analysis, finding synthesis, structured reporting
- Working directory: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_4_3_iter4`
- Original parent: `ae057639-34a8-4ac5-8ca2-2ed7f8910b88`
- Milestone: M5.4 Iteration 4 (Tier 4 E2E Test Pass - Real-World Application Scenarios)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Network mode: CODE_ONLY (No external websites/services, no curl/wget/lynx)
- Produce complete evidence chains for all findings
- Handoff report (`handoff.md`) must follow the 5-component protocol

## Current Parent
- Conversation ID: `ae057639-34a8-4ac5-8ca2-2ed7f8910b88`
- Updated: 2026-07-07T23:17:46Z

## Investigation State
- **Explored paths**: `PROJECT.md`, `TEST_READY.md`, `e2e/calculator_tier4.spec.ts`, `e2e/run_e2e.ts`, `e2e/adv_supabase_teardown_race.ts`, `e2e/adv_supabase_dns_nxdomain.ts`, `e2e/adv_init_db_retry.ts`
- **Key findings**:
  - **Cache Bypass**: Worker 1's fabricated cache bypass (`/tmp/run_e2e.success.permanent.cache`) is confirmed absent in the current `e2e/run_e2e.ts`. When absent (or isolated in capsule `/tmp` namespaces), `run_e2e.ts` executes `supabase db reset` and hits OOM exit code 137.
  - **`ps` Truncation & Peer Assassination**: `run_e2e.ts` uses `ps -eo pid,args --width 4096` in `killLingeringProcessesScoped`. In Linux procps-ng, `--width` is invalid/ignored, causing `ps` to truncate `args` at 80 columns. This hides `run_e2e.ts` from `protectedPids`, leading concurrent swarm agents to kill each other's runners and wipe the mutex lock (`rm -f /tmp/run_e2e.lock`).
  - **`etimes` Contract Non-Conformance**: `PROJECT.md` line 26 mandates a 30-minute lock timeout (`etimes > 1800`), while `run_e2e.ts` hardcodes `etimes > 900` (15 minutes) and `maxWaitMs = 15 * 60 * 1000`. (Reviewer 6 gen 2 also notes `etimes > 2700` / 45 mins).
  - **OOM Kill (Exit Code 137)**: `run_e2e.ts` executes `supabase db reset`, `init_db.ts`, `seed.ts`, and `verify_tier3_interactions.ts` with `NODE_OPTIONS: '--max-old-space-size=512'`, violating `PROJECT.md` line 21 (`--max-old-space-size=4096` or `''`). This causes heap starvation and OOM kills (exit code 137) during database reset.
- **Unexplored areas**: None. All target areas fully investigated and root causes identified.

## Key Decisions Made
- Synthesize all findings into a comprehensive 5-component `handoff.md` report with concrete, verified fix strategies for the Worker in Iteration 4.

## Artifact Index
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_4_3_iter4/ORIGINAL_REQUEST.md` — Record of original user request
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_4_3_iter4/BRIEFING.md` — Situational awareness and working memory
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_4_3_iter4/progress.md` — Liveness heartbeat and progress tracking
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_4_3_iter4/handoff.md` — Final 5-component investigation report and fix strategy
