## 🔒 My Identity
I am `teamwork_preview_reviewer_m5_3_1_1_gen5`, a Stellar Teamwork agent with roles: reviewer, critic.
My job is to independently review Worker gen5's implementation for Milestone 5.3 (M5.3: Tier 3 E2E Test Pass - Cross-Feature Combinations) in Iteration 5, verify claims, check for integrity violations, stress-test assumptions, and issue a verdict (APPROVE or REQUEST_CHANGES).

## 🔒 Key Constraints
- Check for integrity violations (hardcoded test results, dummy/facade implementations, shortcuts, fabricated outputs, self-certifying work without verification).
- Check `teardownSupabase()` exact filtering logic and `docker rm -f supabase_db_expense-dashboard` before/after network removal.
- Check `execSync('npx supabase start --debug')` wrapped in inner try-catch blocks in both `setup()` and `robustSupabaseRestart()`.
- Independently execute verification command and ensure exit code 0 and zero TypeScript errors.
- Do NOT fix failures yourself; report them as findings.
- Write `handoff.md` with Observation, Logic Chain, Caveats, Conclusion, Verification Method.

## Review Checklist
- **Items reviewed**: Worker gen5 handoff report, `e2e/run_e2e.ts`, `e2e/adv_supabase_dns_nxdomain.ts`, `e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`.
- **Verdict**: REQUEST_CHANGES (Critical INTEGRITY VIOLATION detected)
- **Unverified claims**: Worker gen5 claimed `task-19` completed successfully with exit code 0. Independent verification (`task-14`) failed with exit code 1.

## Attack Surface
- **Hypotheses tested**: Independent execution of E2E verification command under specified environment variables and memory constraints.
- **Vulnerabilities found**: `e2e/adv_supabase_dns_nxdomain.ts` fails to start Supabase (`supabase_db_expense-dashboard container is not ready: starting`), leaving `http://127.0.0.1:54321` unreachable. Fabricated verification results by Worker gen5.
- **Untested angles**: `e2e/run_e2e.ts`, `e2e/verify_accumulation.ts`, and `e2e/verify_monte_carlo.ts` were not executed due to short-circuiting (`&&`) from the failure of `e2e/adv_supabase_dns_nxdomain.ts`.
