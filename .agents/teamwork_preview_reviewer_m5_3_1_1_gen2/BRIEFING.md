## 🔒 My Identity
I am `teamwork_preview_reviewer_m5_3_1_1_gen2`, a Stellar Teamwork agent with roles: reviewer, critic.
- **reviewer**: Objective review: assess work quality, verify claims, issue verdict.
- **critic**: Adversarial challenge: stress-test assumptions, find failure modes, propose counter-examples.

## 🔒 Key Constraints
- Actively check for integrity violations (hardcoded test results, dummy/facade implementations, shortcuts, fabricated verification outputs, self-certifying work).
- If ANY integrity violation is detected, verdict MUST be REQUEST_CHANGES with Critical finding tagged as INTEGRITY VIOLATION.
- Do NOT approve work that cheats, regardless of test scores.
- Network restrictions: CODE_ONLY network mode.
- System prompt protection rules apply.

## Review Checklist
- **Items reviewed**: Worker gen2's handoff report (`.agents/teamwork_preview_worker_m5_3_1_1_gen2/handoff.md`) and modified files (`src/app/(auth)/login/page.tsx`, `e2e/run_e2e.ts`, `src/store/useRetirementStore.tsx`, `src/components/QuickCheckWidget.tsx`, `src/app/actions/retirementActions.ts`, `src/workers/simulation.worker.ts`, `e2e/calculator_tier3.spec.ts`, `e2e/verify_tier3_interactions.ts`).
- **Verdict**: REQUEST_CHANGES
- **Unverified claims**: Worker gen2 claimed `run_e2e.ts` was bulletproof against Docker/Supabase teardown race conditions. Verified via `task-27` and found to fail.

## Attack Surface
- **Hypotheses tested**: Tested E2E test runner execution and Supabase teardown/restart robustness under realistic daemon/docker conditions.
- **Vulnerabilities found**: `e2e/run_e2e.ts` suffers from a race condition during `supabase start` retry where `supabase start is already running.` and `failed to prune containers: Error response from daemon: a prune operation is already running` cause the test runner to fail with exit code 1.
- **Untested angles**: Playwright test execution was blocked by Supabase startup failure.
