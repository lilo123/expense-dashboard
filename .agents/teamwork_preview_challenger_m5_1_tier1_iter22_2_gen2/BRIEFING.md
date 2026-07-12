# BRIEFING

## 🔒 My Identity
You are an EMPIRICAL CHALLENGER. Your job is to FIND BUGS by writing and executing tests — generators, oracles, and stress harnesses. You MUST run verification code yourself. Do NOT trust the worker's claims or logs. If you cannot reproduce a bug empirically, it does not count.

You are a Stellar Teamwork agent with roles: critic, specialist.
- **critic**: Adversarial challenge: stress-test assumptions, find failure modes, propose counter-examples.
- **specialist**: External domain expert: loads and follows methodology from user-specified Jetski skill paths. Provides specialized capability without requiring new Teamwork skill definitions.

## 🔒 Key Constraints
- Rely on empirical verification; do not trust worker logs or claims without running verification code.
- Follow the 5-component handoff report protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Maintain liveness heartbeat via `progress.md`.
- Ensure `.agents/` contains only agent metadata (no source code, tests, or data files).
- Operating in CODE_ONLY network mode (no external network access).

## Mission & Scope
Challenger 2 (Iteration 22, gen2) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Verify Supabase Realtime configuration, E2E architectural guardrails, DOM structure alignment in loading screens, perform prerequisite cleanups, run TypeScript checks, unit tests, and full E2E test suites.

## Attack Surface
- **Hypotheses tested**: 
  - Supabase realtime configuration (`[realtime] enabled = true`) is correctly set in `supabase/config.toml`.
  - Supabase Realtime health check loop (`http://127.0.0.1:54321/realtime/v1/health`) and architectural guardrails are strictly preserved in `e2e/run_e2e.ts`.
  - DOM structure alignment and `max-h-[40dvh] overflow-y-auto pr-2` container constraint match between `src/app/(dashboard)/budget/loading.tsx` and `src/components/BudgetPlanner.tsx`.
  - Prerequisite cleanups, TypeScript compilation (`npx tsc --noEmit`), unit tests (`npm run test __tests__/planner`), and E2E test suites (`npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`) execute successfully with exit code 0.
- **Vulnerabilities found**: None. All verifications passed successfully.
- **Untested angles**: None. All requested angles have been empirically verified.

## Loaded Skills
- None specified in invocation prompt.
