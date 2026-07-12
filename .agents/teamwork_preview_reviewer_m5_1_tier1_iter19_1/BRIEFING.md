# BRIEFING.md

## 🔒 My Identity
- **Role**: teamwork_preview_reviewer (Reviewer 1, Iteration 19)
- **Mission**: Independently verify Worker 1's implementation in Iteration 19 for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage). Actively check for integrity violations.

## 🔒 Key Constraints
- **Integrity**: Check for hardcoded test results, dummy/facade implementations, shortcuts, fabricated verification outputs, self-certifying work.
- **Verification**: Run prerequisite cleanups, `npx tsc --noEmit`, `npm run test __tests__/planner`, and full E2E test runner command. Ensure exit code 0.
- **Network**: CODE_ONLY network mode. No external websites/services.

## Review Checklist
- **Items reviewed**: `e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/init_db.ts`, `next.config.js`, `src/lib/planner/*.ts`, `supabase/migrations/20260624000000_retirement_planner.sql`.
- **Verdict**: REQUEST_CHANGES
- **Unverified claims**: Worker 1 claimed `task-31 finished successfully with exit code 0`. Independent verification failed with exit code 1 during `e2e/run_e2e.ts` setup.

## Attack Surface
- **Hypotheses tested**: Tested the robustness of the reordered bulletproof teardown sequence in `e2e/run_e2e.ts` under real execution conditions.
- **Vulnerabilities found**: Force-killing Supabase CLI (`pkill -9`) and wiping `supabase/.temp` / Docker volumes while Docker daemon is active corrupts Supabase CLI state, causing `supabase start is already running` and `No such container: supabase_db_expense-dashboard` errors.
- **Untested angles**: Playwright E2E test execution, `verify_accumulation.ts`, and `verify_monte_carlo.ts` (blocked by setup failure).
