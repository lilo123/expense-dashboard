# Plan: M5.3 Tier 3 E2E Test Pass (Iteration 9)

## Objective
Fix `e2e/run_e2e.ts` to ensure `robustSupabaseRestart()` explicitly executes `npx tsx e2e/init_db.ts` before `e2e/seed.ts` (and remove silent error swallowing around `seed.ts`), implement a robust 5-retry loop (`while (retries > 0 && !success)`) with 5-second backoff in `setup()` (matching `e2e/adv_supabase_dns_nxdomain.ts`), ensure `teardownSupabase()` properly cleans up lingering `supabase start` processes (`pkill -9 -f "supabase.*start"`), and remove `rm -f /tmp/run_e2e.lock` from test invocation strings. Perform genuine independent verification in a clean environment to ensure 100% of Tier 3 tests pass with exit code 0 and a flawless CLEAN audit verdict.

## Step-by-Step Plan
1. **Iteration 9, Step 1 (Explore)**: Spawn 3 Explorers (`teamwork_preview_explorer`) with the full evidence report from Auditor gen8 verbatim, plus Reviewer 1 & 2 gen8 findings. Instruct them to investigate `e2e/run_e2e.ts` and recommend a concrete fix strategy.
2. **Iteration 9, Step 2 (Work)**: Spawn a Worker (`teamwork_preview_worker`) with Explorer findings to implement the fixes in `e2e/run_e2e.ts`, perform genuine verification in a clean environment, and report results. Include mandatory integrity warning.
3. **Iteration 9, Step 3 (Review)**: Spawn 2 Reviewers (`teamwork_preview_reviewer`) independently to examine correctness, completeness, robustness, and interface conformance.
4. **Iteration 9, Step 4 (Challenge)**: Spawn 2 Challengers (`teamwork_preview_challenger`) to empirically verify correctness.
5. **Iteration 9, Step 5 (Audit)**: Spawn a Forensic Auditor (`teamwork_preview_auditor`) to perform integrity verification.
6. **Iteration 9, Step 6 (Gate)**: Evaluate all results. If all pass, mark milestone done and provide final `handoff.md` to parent (`sub_orch_m5_1`, ID: e0762fd9-e344-42b8-94b2-333966260dfc).
