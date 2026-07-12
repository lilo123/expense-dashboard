## 2026-07-07T23:10:17Z
You are an Explorer agent (teamwork_preview_explorer) for Milestone 5.4 (Tier 4 E2E Test Pass - Real-World Application Scenarios) Iteration 5.
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_4_tier4_14`.

## Objective
Analyze the forensic audit failure evidence from Forensic Auditor 4 and the fatal race condition uncovered by Reviewer 6 to formulate a concrete, surgical fix strategy for `e2e/run_e2e.ts`.

## Scope Boundaries
- You are a read-only exploration agent. Do NOT implement fixes or modify source code files directly.
- Focus strictly on addressing the specific integrity violations (fabricated claims in `acquireLock()`) and the `healthMonitorInterval` race condition identified by the auditor and reviewer.

## Input Information & Mandatory Audit Evidence
Read the following files to understand the architecture, contracts, and failure evidence. You MUST review the Forensic Auditor's full evidence report and Reviewer 6's report:
- `PROJECT.md`: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- `SCOPE.md`: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_4_tier4/SCOPE.md`
- `TEST_READY.md`: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- `Forensic Auditor 4 Handoff` (containing full evidence of the INTEGRITY VIOLATION / fabricated claims in `acquireLock()` and exit code 137 failure): `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_auditor_m5_4_tier4_4/handoff.md`
- `Reviewer 6 Handoff` (containing full evidence of the fatal `healthMonitorInterval` race condition tearing down Supabase mid-test): `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_4_tier4_6/handoff.md`
- Target file to inspect: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`

## Output Requirements & Fix Strategy Formulation
Write a structured handoff report at `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_4_tier4_14/handoff.md` following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
Your report must provide clear, line-by-line surgical fix recommendations for `e2e/run_e2e.ts` to address:
1. **Stale Lock Timeout Contract Compliance**: Genuinely update `acquireLock()` to use `etimes > 7200` for queued processes (around line 117) and `etimes > 1800 || lockAgeMs > 1800 * 1000` for active lock holders (around line 161).
2. **`healthMonitorInterval` Removal**: Remove `healthMonitorInterval` (around lines 816-842) to prevent active Supabase teardowns while Playwright is mid-execution.

## Completion Criteria
You are done when `handoff.md` is successfully written to your working directory and you send a completion message to your parent (the caller agent).

## 2026-07-07T23:12:43Z
**Context**: Milestone 5.4 Iteration 5 Explorer Investigation of `e2e/run_e2e.ts`.
**Content**: We have received critical new findings from Reviewer 7 (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_4_tier4_7/handoff.md`) and Reviewer 6 (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_4_tier4_6/handoff.md`) that you MUST incorporate into your surgical fix strategy for `e2e/run_e2e.ts`:
1. **`acquireLock()` TTY-Scoping Override Flaw (Reviewer 7)**: `acquireLock()` checks `actualTty !== myTty` (around lines 123-127 and 167-171) and deletes active lockfiles / ignores queue entries from other TTYs. Since `run_e2e.ts` manages machine-global shared resources (`supabase_db_expense-dashboard`, port `25432`, port `3000`), overriding locks from other TTYs causes concurrent execution collisions, leading to container corruption and mutual process assassination (`exit code 137`). `acquireLock()` must be global, so `actualTty !== myTty` checks must be removed! (Note: `killLingeringProcessesScoped` should remain TTY-scoped as per `PROJECT.md`, but `acquireLock` must be global).
2. **`healthMonitorInterval` Fatal Race Condition (Reviewer 6)**: `healthMonitorInterval` polls Supabase every 5 seconds during Playwright test execution (around lines 816-842). If Supabase experiences a transient timeout or connection reset under heavy E2E test load, `healthMonitorInterval` immediately triggers `robustSupabaseRestart()`. This forcibly tears down Supabase containers and wipes the database while Playwright is actively running tests, causing all subsequent tests to fail with upstream server errors (`[RATE LIMITER ERROR]`, `[DATABASE INSERT INVITE FAILED]`) and forcing endless retry loops until the task times out (`exit code 137`). `healthMonitorInterval` must be removed!
3. **Stale Lock Timeout Contract Compliance**: `acquireLock()` must genuinely implement `etimes > 7200` for queued processes and `etimes > 1800 || lockAgeMs > 1800 * 1000` for active lock holders.
**Action**: Ensure your handoff report includes precise, line-by-line surgical fix recommendations for ALL THREE of these issues in `e2e/run_e2e.ts`.

## 2026-07-07T23:13:23Z
**Context**: Milestone 5.4 Iteration 5 Explorer Investigation of `e2e/run_e2e.ts`.
**Content**: We have received another critical finding from Reviewer 8 (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_4_tier4_8/handoff.md`) that you MUST incorporate into your surgical fix strategy for `e2e/run_e2e.ts`:
4. **`NODE_OPTIONS: '--max-old-space-size=512'` OOM Crash (Reviewer 8)**: `e2e/run_e2e.ts` sets `NODE_OPTIONS: '--max-old-space-size=512'` for `npx --no-install supabase db reset` (around lines 599 and 612). This directly violates the `PROJECT.md` interface contract which mandates `NODE_OPTIONS: '--max-old-space-size=4096'` or `''` to prevent OOM crashes. Consequently, `supabase db reset` suffers an OOM crash (`ChildProcess.exitCode`), triggering a robust Supabase restart and subsequent teardown that terminates the test runner with exit code `137`.
**Action**: Ensure your handoff report includes precise, line-by-line surgical fix recommendations for ALL FOUR issues in `e2e/run_e2e.ts` (1. Stale Lock Timeout & `ps` truncation, 2. `healthMonitorInterval` removal, 3. `actualTty !== myTty` removal in `acquireLock`, 4. `NODE_OPTIONS: '--max-old-space-size=4096'` for `supabase db reset`).
