# BRIEFING

## 🔒 My Identity
- **Role**: teamwork_preview_reviewer (High-reliability review agent) / Tier 3 E2E Reviewer 8
- **Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_3_tier3_8`
- **Parent Agent**: Sub-orchestrator (`34c20a6d-1c72-4e2c-946e-5c30cda5bb80`)

## 🔒 Key Constraints
- Actively check for integrity violations (hardcoded test results, dummy/facade implementations, shortcuts bypassing intended task, fabricated verification outputs/logs, self-certifying work without genuine independent verification).
- If any integrity violation is detected, verdict MUST be REQUEST_CHANGES with a Critical finding tagged as INTEGRITY VIOLATION.
- Do NOT approve work that cheats, regardless of test scores.
- Maintain liveness heartbeat via `progress.md`.
- Network mode: CODE_ONLY.

## Mission
1. Read `PROJECT.md`, `.agents/sub_orch_m5_3_tier3/SCOPE.md`, `TEST_READY.md`, and `.agents/teamwork_preview_worker_m5_3_tier3_4/handoff.md`.
2. Review Worker 4's implementation of the concrete fix strategy (pinning `npx --no-install supabase` and standardizing teardown sequences) across `e2e/run_e2e.ts`, `e2e/adv_supabase_teardown_race.ts`, `e2e/adv_supabase_lifecycle.ts`, `e2e/test_supabase_pkill.ts`, `e2e/test_pkill.ts`, and `e2e/test_fuser.ts`.
3. Verify correctness, completeness, robustness, and interface conformance.
4. Execute the full E2E test runner command defined in `TEST_READY.md`.
5. Verify that all tests pass successfully with exit code 0.
6. Write structured handoff report (`handoff.md`) in working directory following Handoff Protocol.
7. Send completion message to parent.

## Review Checklist
- **Items reviewed**: `PROJECT.md`, `SCOPE.md`, `TEST_READY.md`, Worker 4 handoff, `e2e/run_e2e.ts`, `e2e/adv_supabase_teardown_race.ts`, `e2e/adv_supabase_lifecycle.ts`, `e2e/test_supabase_pkill.ts`, `e2e/test_pkill.ts`, `e2e/test_fuser.ts`, and all verification scripts.
- **Verdict**: REQUEST_CHANGES
- **Unverified claims**: All claims verified. Tests passed (`task-35`), but `e2e/run_e2e.ts` violates `SCOPE.md` teardown sequence contract (`pkill` before `docker rm -f` instead of after).

## Attack Surface
- **Hypotheses tested**: Tested whether `e2e/run_e2e.ts` teardown sequence matches `SCOPE.md` contract and adversarial test scripts.
- **Vulnerabilities found**: Confirmed failure to standardize teardown sequence in `e2e/run_e2e.ts`, leaving it vulnerable to `supabase-go` daemon corruption and race conditions.
- **Untested angles**: None. Full E2E test suite executed successfully in `task-35`.
