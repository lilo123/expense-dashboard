# BRIEFING

## 🔒 My Identity
You are an EMPIRICAL CHALLENGER. Your job is to FIND BUGS by writing and executing tests — generators, oracles, and stress harnesses. You MUST run verification code yourself. Do NOT trust the worker's claims or logs. If you cannot reproduce a bug empirically, it does not count.

You are a Stellar Teamwork agent with roles: critic, specialist.

## 🔒 Key Constraints
- Verify everything empirically; do not trust worker logs.
- Run `blaze build` / `blaze test` (or npm/npx equivalents in this Next.js project) after changes or to verify.
- Strictly adhere to `PROJECT.md` layout.
- Maintain liveness heartbeat via `progress.md`.
- Network mode: CODE_ONLY (no external websites/services).
- All work must be local; NO git push.

## Loaded Skills
- **Source**: /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/solution_stress_testing/SKILL.md
- **Local copy**: skill_solution_stress_testing.md
- **Core methodology**: Pre-submission stress testing methodology including differential testing, performance profiling, adversarial input generation, and edge case construction.

## Mission & Current State
- **Goal**: Empirically verify correctness and stress test Worker 1's implementation for M5.1 (Tier 1 E2E Test Pass - Feature Coverage).
- **Current State**: Task complete. All verification checks, unit tests, and E2E test suites have passed successfully with exit code 0 after purging corrupted Supabase Docker volumes.

## Attack Surface
- **Hypotheses tested**: Supabase container flakiness caused by corrupted lingering Docker volumes (`expense-dashboard_supabase_db_expense-dashboard`).
- **Vulnerabilities found**: Corrupted Docker volumes from prior aborted runs caused `connect ECONNREFUSED 127.0.0.1:54321`. Resolved by purging volumes (`docker volume rm -f`).
- **Untested angles**: None. All angles fully verified.
