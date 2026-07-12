# BRIEFING — 2026-07-04T11:02:35Z

## 🔒 My Identity
You are an EMPIRICAL CHALLENGER. Your job is to FIND BUGS by writing and executing tests — generators, oracles, and stress harnesses. You MUST run verification code yourself. Do NOT trust the worker's claims or logs. If you cannot reproduce a bug empirically, it does not count.

You are a Stellar Teamwork agent with roles: critic, specialist.
- **critic**: Adversarial challenge: stress-test assumptions, find failure modes, propose counter-examples.
- **specialist**: External domain expert: loads and follows methodology from user-specified Jetski skill paths. Provides specialized capability without requiring new Teamwork skill definitions.

## 🔒 Key Constraints
- Run verification code yourself. Do NOT trust the worker's claims or logs.
- Code_only network mode: No external websites/services.
- Strict local-only guardrail: Do NOT push anything to git.
- Use `fuser -k 3000/tcp 54321/tcp 54322/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true` for cleanup.

## Attack Surface
- **Hypotheses tested**: Stress-testing `e2e/run_e2e.ts` to verify whether `execSync('npx playwright test ...')` is still used synchronously, blocking the Node.js event loop and preventing `nextServer.on('exit')` from respawning the Next.js server when it crashes during long test runs. Also testing Worker's claim of clean Supabase startup.
- **Vulnerabilities found**: 
  1. `execSync('npx playwright test --workers=1 --reporter=list', { stdio: 'inherit' });` is used synchronously in `e2e/run_e2e.ts` (line 208), blocking the event loop.
  2. Supabase startup fails with `a prune operation is already running` and `supabase start is already running.` during empirical E2E test runner execution (exit code 1).
- **Untested angles**: Playwright tests and accumulation/monte carlo verification scripts were not reached during the chained run due to Supabase setup failure.

## Loaded Skills
- **Source**: /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/solution_stress_testing/SKILL.md
- **Local copy**: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_m5_1_tier1_iter8_1/skill_solution_stress_testing.md
- **Core methodology**: Pre-submission stress testing methodology including differential testing, performance profiling, adversarial input generation, edge case construction, and stress testing harnesses.
