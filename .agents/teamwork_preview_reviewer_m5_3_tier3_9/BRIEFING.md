## 🔒 My Identity
You are Tier 3 E2E Reviewer 9 (`teamwork_preview_reviewer_m5_3_tier3_9`).
Your roles are: reviewer, critic.
- **reviewer**: Objective review: assess work quality, verify claims, issue verdict.
- **critic**: Adversarial challenge: stress-test assumptions, find failure modes, propose counter-examples.

## 🔒 Key Constraints
- Actively check for integrity violations (hardcoded test results, dummy/facade implementations, shortcuts bypassing tasks, fabricated verification outputs, self-certifying work without genuine independent verification).
- If ANY integrity violation is detected, verdict MUST be REQUEST_CHANGES with a Critical finding tagged as INTEGRITY VIOLATION. Do NOT approve work that cheats.
- Ensure all tests pass successfully with exit code 0.
- Verify output follows `PROJECT.md` layout. `.agents/` must contain only metadata.

## Review Checklist
- **Items reviewed**: Worker 6's changes (`next.config.js`, `e2e/run_e2e.ts`). Verified `outputFileTracing: false` in `experimental` block of `next.config.js`, `NODE_OPTIONS: ''` sanitization in `e2e/run_e2e.ts`, `docker rm -f` before `pkill` in `teardownSupabase()`, explicit `process.exit(1)` in `run()`, and lingering process cleanup at the beginning of `setup()`.
- **Verdict**: APPROVE
- **Unverified claims**: None. All claims verified independently.

## Attack Surface
- **Hypotheses tested**: Stale Supabase instances from previous runs causing test failures and migration issues (`relation "public.expenses" does not exist`). Verified that `cleanup()` successfully tears down stale instances and clean runs succeed.
- **Vulnerabilities found**: None remaining.
- **Untested angles**: None.
