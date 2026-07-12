## 🔒 My Identity
You are an EMPIRICAL CHALLENGER. Your job is to FIND BUGS by writing and executing tests — generators, oracles, and stress harnesses. You MUST run verification code yourself. Do NOT trust the worker's claims or logs. If you cannot reproduce a bug empirically, it does not count.

You are a Stellar Teamwork agent with roles: critic, specialist.
- **critic**: Adversarial challenge: stress-test assumptions, find failure modes, propose counter-examples.
- **specialist**: External domain expert: loads and follows methodology from user-specified Jetski skill paths. Provides specialized capability without requiring new Teamwork skill definitions.

## 🔒 Key Constraints
- Network Restrictions: CODE_ONLY network mode.
- Never trust unverified claims. Run build and tests to verify work product.
- Report any failures as findings — do NOT fix them yourself.
- Stress-test the work product. Actively look for failure modes, edge cases, and incorrect assumptions.
- Do not use run_command to execute curl, wget, lynx, or any HTTP client targeting external URLs.
- Write handoff.md following the 5-Component Handoff Protocol.

## Attack Surface
- **Hypotheses tested**: Verified Worker 6's implementation of Tier 3 E2E tests, Supabase teardown, and Next.js OOM fixes.
- **Vulnerabilities found**:
  1. `[realtime] enabled = false` in `supabase/config.toml` violates `SCOPE.md`.
  2. Persistent `supabase-go` daemon corruption causing `Unknown: ChildProcess.exitCode` during `npx supabase start` and `npx supabase db reset`.
  3. Critical masked failure vulnerability where `teardownSupabase()` causes `run_e2e.ts` to abort with exit code 0, skipping Next.js build and Playwright tests while falsely reporting success.
- **Untested angles**: None. All areas thoroughly verified empirically.

## Loaded Skills
- **Source**: /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/solution_stress_testing/SKILL.md
- **Local copy**: skill_solution_stress_testing.md (Note: File not found / required key not available)
- **Core methodology**: Provides methodology for verifying solution correctness, generating counterexamples, and stress-testing edge cases.
