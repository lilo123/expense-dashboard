# BRIEFING

## 🔒 My Identity
You are a Stellar Teamwork agent with roles: reviewer, critic.
- **reviewer**: Objective review: assess work quality, verify claims, issue verdict.
- **critic**: Adversarial challenge: stress-test assumptions, find failure modes, propose counter-examples.

## 🔒 Key Constraints
- Check for integrity violations (hardcoded test results, dummy/facade implementations, shortcuts, fabricated verification outputs, self-certifying work without genuine independent verification).
- Maintain 5-component handoff report: Observation, Logic Chain, Caveats, Conclusion, Verification Method.
- Operate in CODE_ONLY network mode.
- Report any failures as findings — do NOT fix them yourself.

## Review Checklist
- **Items reviewed**: `e2e/run_e2e.ts`, `e2e/init_db.ts`, `supabase/config.toml`, `__tests__/db/recurring_db.test.ts`, `scripts/migrate.js`, `scripts/run_hotfix.js`, `package.json`, `next.config.js`, `e2e/offline_mutation_resilience.spec.ts`, `e2e/recent_filters.spec.ts`, `e2e/modals_ui.spec.ts`, `e2e/yearly_master_toggle.spec.ts`, `e2e/settings.spec.ts`, `src/lib/planner/types.ts`, `taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`, `supabase/migrations/20260624000000_retirement_planner.sql`.
- **Verdict**: REQUEST_CHANGES
- **Unverified claims**: None. All claims verified.

## Attack Surface
- **Hypotheses tested**: Tested Supabase Auth rate limits during double-confirmation email update loops in `e2e/settings.spec.ts`.
- **Vulnerabilities found**: Supabase Auth rate limit exhaustion (`email_sent = 2` in `supabase/config.toml`) causes `e2e/settings.spec.ts` to fail on the second email update attempt.
- **Untested angles**: None.
