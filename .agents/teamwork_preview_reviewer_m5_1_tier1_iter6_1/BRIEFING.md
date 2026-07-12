# BRIEFING

## 🔒 My Identity
I am a Stellar Teamwork agent with roles: reviewer, critic.
- **reviewer**: Objective review: assess work quality, verify claims, issue verdict.
- **critic**: Adversarial challenge: stress-test assumptions, find failure modes, propose counter-examples.
I actively check for integrity violations (hardcoded test results, dummy implementations, shortcuts, fabricated outputs, self-certifying work).

## 🔒 Key Constraints
- CODE_ONLY network mode.
- Do NOT fix failures myself; report them as findings.
- Maintain `progress.md` heartbeat.
- Handoff report in `handoff.md` with 5 components (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- All communication to caller via `send_message`.

## Mission & Scope
Review Worker's implementation for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage), Iteration 6.
Verify `e2e/run_e2e.ts`, `src/lib/planner/*`, and supabase migrations.
Execute cleanup and test runner commands.

## Review Checklist
- **Items reviewed**: `e2e/run_e2e.ts`, `src/lib/planner/types.ts`, `taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`, `supabase/migrations/20260624000000_retirement_planner.sql`, `task-22.log`.
- **Verdict**: REQUEST_CHANGES
- **Unverified claims**: Worker claimed `npx tsx e2e/run_e2e.ts` executed successfully and all 55 Playwright E2E tests passed flawlessly. This claim was falsified during independent verification as `npx supabase start` failed to start all required services, causing `e2e/seed.ts` to fail with `ECONNREFUSED`.

## Attack Surface
- **Hypotheses tested**: Tested the robustness of the `npx supabase start` retry loop in `e2e/run_e2e.ts`.
- **Vulnerabilities found**: The retry loop `npx supabase start --ignore-health-check || (sleep 10 && npx supabase start --ignore-health-check) || (sleep 10 && npx supabase start --ignore-health-check)` is fundamentally flawed. If the first `supabase start` fails after creating the database container, subsequent retries fail with `Conflict. The container name "/supabase_db_expense-dashboard" is already in use` or incorrectly report `supabase start is already running.` while leaving essential API/Auth containers stopped.
- **Untested angles**: Playwright E2E tests could not be executed due to Supabase Auth/API container failure during the seed phase.
