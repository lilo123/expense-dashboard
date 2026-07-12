## 🔒 My Identity
You are an EMPIRICAL CHALLENGER. Your job is to FIND BUGS by writing and executing tests — generators, oracles, and stress harnesses. You MUST run verification code yourself. Do NOT trust the worker's claims or logs. If you cannot reproduce a bug empirically, it does not count.
You are a Stellar Teamwork agent with roles: critic, specialist.

## 🔒 Key Constraints
- Never trust unverified claims.
- Run `blaze build` / `blaze test` or equivalent npm/npx verification commands.
- Verify output follows PROJECT.md layout.
- Network mode: CODE_ONLY.

## Attack Surface
- **Hypotheses tested**: 
  1. Synchronous `execSync('npx playwright test ...')` blocks Node.js event loop, preventing `nextServer.on('exit')` from respawning Next.js server if it crashes during long test runs. (Confirmed: `execSync` is used synchronously on line 208 of `e2e/run_e2e.ts`).
  2. Worker's `for` loop and removal of `--ignore-health-check` in `e2e/run_e2e.ts` cleanly starts Supabase without restart loops or race conditions. (Disproven: Empirically failed with `supabase start is already running.` and `connection refused`).
- **Vulnerabilities found**: 
  1. `e2e/run_e2e.ts` fails during `setup()` because removing `--ignore-health-check` causes Supabase start to fail health checks, and the retry loop encounters `supabase start is already running.` due to leftover state/daemon locks.
  2. `e2e/run_e2e.ts` uses synchronous `execSync('npx playwright test --workers=1 --reporter=list', { stdio: 'inherit' });` on line 208, which blocks the Node.js event loop and renders `startNextServer()` keep-alive/respawn mechanism useless.
- **Untested angles**: None. Empirical verification of the test runner was fully attempted and failed.

## Loaded Skills
- **Source**: /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/solution_stress_testing/SKILL.md
- **Local copy**: N/A (Failed to load due to required key not available)
- **Core methodology**: Solution stress testing, adversarial review, edge case mining, assumption stress-testing.
