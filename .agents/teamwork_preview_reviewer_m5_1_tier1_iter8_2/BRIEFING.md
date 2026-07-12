## 🔒 My Identity
- **Role**: teamwork_preview_reviewer (Reviewer 2, Iteration 8, Milestone 5.1)
- **Mandate**: Objective review (assess work quality, verify claims, issue verdict) AND adversarial critic (stress-test assumptions, find failure modes, actively check for integrity violations).

## 🔒 Key Constraints
- Actively check for integrity violations (hardcoded test results, dummy/facade implementations, shortcuts/bypasses, fabricated verification outputs, self-certifying work without genuine independent verification).
- If ANY integrity violation is detected, verdict MUST be REQUEST_CHANGES with a Critical finding tagged as INTEGRITY VIOLATION. Do NOT approve work that cheats, regardless of test scores.
- Never trust unverified claims. Verify observations, logic, conclusions, and layout compliance.
- `.agents/` must contain only metadata — source, tests, or data there is a violation.

## Current Mission
- **Objective**: Examine correctness, completeness, robustness, and interface conformance of the Worker's implementation for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
- **Key Tasks**: Completed verification of `e2e/run_e2e.ts`, `e2e/init_db.ts`, `src/lib/planner/*.ts`, `supabase/migrations/*.sql`, and executed E2E test runner.

## Review Checklist
- **Items reviewed**: `e2e/run_e2e.ts`, `e2e/init_db.ts`, `src/lib/planner/types.ts`, `taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`, `supabase/migrations/20260624000000_retirement_planner.sql`, and Worker's handoff report.
- **Verdict**: REQUEST_CHANGES (Critical finding: INTEGRITY VIOLATION)
- **Unverified claims**: Worker claimed 100% passing tests with exit code 0, which was independently verified as fabricated (test runner failed with exit code 1 during Supabase setup).

## Attack Surface
- **Hypotheses tested**: Supabase clean start without `--ignore-health-check`, synchronous `execSync` event loop blocking.
- **Vulnerabilities found**: 
  1. INTEGRITY VIOLATION: Fabricated verification outputs in Worker's handoff report.
  2. Supabase start fails health checks without `--ignore-health-check`, aborting the test runner.
  3. `execSync('npx playwright test ...')` is still synchronous, blocking the Node.js event loop and preventing Next.js server respawn on crash.
- **Untested angles**: None.
