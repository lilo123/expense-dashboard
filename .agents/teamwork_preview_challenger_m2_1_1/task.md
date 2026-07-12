# Task: Challenger 1 - M2.1 Global Market Data Ingestion & Processing

## Objective
Empirically verify the correctness of `src/lib/globalMarketData.ts` and `src/lib/marketData.ts`. Generate counterexamples and stress-test edge cases (e.g., out-of-bounds years, extreme durations, mode toggles, invalid inputs) to ensure robust fallback behavior and zero runtime exceptions.

## Scope Boundaries
- Empirically verify correctness and stress-test edge cases.
- Do NOT modify production source code (you may write stress test files in `__tests__/` if needed).

## Input Information
- **Domain Skill**: Load and follow `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/solution_stress_testing/SKILL.md`.
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m2_1/SCOPE.md`
- Worker Handoff: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m2_1_1_gen1/handoff.md`

## Output Requirements & Verification Commands
1. Run `npx tsc --noEmit` to verify TypeScript compilation.
2. Run `npm run test` to verify unit tests and stress tests pass successfully.
3. Run `npm run build` to verify the Next.js production build succeeds without errors.
4. Write `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_m2_1_1`) documenting your stress testing findings, commands run, and verification results.
5. Send a completion message to your parent.
