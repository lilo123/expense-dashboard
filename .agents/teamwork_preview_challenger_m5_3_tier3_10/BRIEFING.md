# BRIEFING

## 🔒 My Identity
You are an EMPIRICAL CHALLENGER. Your job is to FIND BUGS by writing and executing tests — generators, oracles, and stress harnesses. You MUST run verification code yourself. Do NOT trust the worker's claims or logs. If you cannot reproduce a bug empirically, it does not count.

You are a Stellar Teamwork agent with roles: critic, specialist.
- **critic**: Adversarial challenge: stress-test assumptions, find failure modes, propose counter-examples.
- **specialist**: External domain expert: loads and follows methodology from user-specified Jetski skill paths.

## 🔒 Key Constraints
- Run verification code yourself. Do NOT trust worker claims/logs.
- Follow Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Maintain `progress.md` as liveness heartbeat.
- Maintain `BRIEFING.md` for situational awareness.
- Never write source code, tests, or data to `.agents/`.

## Attack Surface
- **Hypotheses tested**: 
  - Verified Worker 6's implementation of Tier 3 E2E tests, Supabase teardown contract, Next.js OOM fixes, and process collision prevention in `next.config.js` and `e2e/run_e2e.ts`.
  - Stress-tested the E2E test runner execution via `task-20` (`export PATH=... && ... && exec npx tsx e2e/run_e2e.ts`).
- **Vulnerabilities found**: 
  - **Concurrent Process Elimination War & Masked Failure Vulnerability**: Worker 6 implemented a lingering `run_e2e` process cleanup in `setup()` (`e2e/run_e2e.ts` lines 53-68) that kills all other `run_e2e` processes on the machine with `kill -9`. In a shared environment where multiple automated test runners (`pts/3`, `pts/4`, `pts/5`) execute concurrently, a newly started `run_e2e.ts` process in another terminal abruptly kills an ongoing `run_e2e.ts` process (`task-20`) while it is waiting for `init_db.ts`. Because `task-20` was invoked via `exec npx tsx e2e/run_e2e.ts`, `npx` exits with code 0 when its child `tsx e2e/run_e2e.ts` is killed with `kill -9`. This causes `task-20` to report `The command completed successfully.` even though the test runner was terminated mid-execution before running `npm test`, `e2e/seed.ts`, `npm run build`, or `playwright test`.
- **Untested angles**: None. All angles fully investigated and empirically verified.

## Loaded Skills
- **Source**: /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/solution_stress_testing/SKILL.md
- **Local copy**: skill_solution_stress_testing.md (Note: depot path unavailable in environment, following Teamwork baseline adversarial review & stress testing methodology)
- **Core methodology**: Verifying solution correctness, generating counterexamples, and stress-testing edge cases.
