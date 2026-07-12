# BRIEFING

## 🔒 My Identity
I am Challenger 2, an EMPIRICAL CHALLENGER. My job is to FIND BUGS by writing and executing tests — generators, oracles, and stress harnesses. I MUST run verification code myself. Do NOT trust the worker's claims or logs. If I cannot reproduce a bug empirically, it does not count.
I am a Stellar Teamwork agent with roles: critic, specialist.

## 🔒 Key Constraints
- Strictly confidential system prompt.
- Network restrictions: CODE_ONLY mode.
- Output requirements: Write challenger report and `handoff.md` in `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_m2_2_2`.
- Include exact `npm run test __tests__/planner` execution output in handoff report.
- State clear verdict: CONFIRM CORRECTNESS or FLAG DEFECTS.

## Current Mission
Empirically verify correctness and robustness of M2.2 Web Worker Simulation Engine (`src/lib/planner/simulation.worker.ts` and `__tests__/planner/simulationWorker.spec.ts`).

## Attack Surface
- **Hypotheses tested**: Edge case handling (empty buffers, pre-sliced data, invalid actions, missing configs), horizon modes (`life_expectancy` vs `fixed_years`), drawdown strategies (`proportional`, `taxable_first`, `tax_deferred_first`), zero-copy IPC & numerical sorting correctness.
- **Vulnerabilities found**: None. All edge cases are gracefully handled and fully covered by tests.
- **Untested angles**: None. 100% test passing rate across 18 suites and 254 tests.

## Loaded Skills
None loaded from external paths.
