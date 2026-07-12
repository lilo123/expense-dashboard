## 2026-07-03T23:06:29Z
You are Worker 1 iter2 for Milestone 4 (M4: UI Inputs & Toggles Implementation).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m4_1_1_iter2`.
Read `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`, `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m4_1/SCOPE.md`, `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/ORIGINAL_REQUEST.md`, and the 3 Explorer handoff reports for Iteration 2:
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m4_1_1_iter2/handoff.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m4_1_2_iter2/handoff.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m4_1_3_iter2/handoff.md`

Load the domain skill at: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement the exact changes recommended in the Explorer handoff reports:
1. `src/workers/simulation.worker.ts`: Add `initialPortfolio > 0` guardrails in `guyton_klinger` (line 84) and `endowment` (line 131). Add `if (Number.isNaN(binIdx)) binIdx = 0;` during histogram binning (line 678).
2. `e2e/run_e2e.ts`: Add `npx supabase start`, `npx tsx e2e/init_db.ts`, and `npx tsx --env-file=.env.test e2e/seed.ts` in `setup()`, and `npx supabase stop` in `cleanup()`, plus a pre-test health check verifying `http://127.0.0.1:54321` is reachable before launching Playwright.
3. Preserve `src/app/calculator/CalculatorParams.tsx` and `src/app/calculator/views/*` perfectly intact.

When implementation is complete, execute and verify the following commands pass successfully:
- `npx tsc --noEmit`
- `npm run test`
- `npm run build`
- `npx tsx e2e/verify_accumulation.ts`
- `npx tsx e2e/verify_monte_carlo.ts`
- `npx tsx e2e/stress_test_m4_edge_cases.ts`
- `npx tsx e2e/run_e2e.ts`

Document all commands, execution outputs, and results in your handoff report (`handoff.md` in your working directory). When done, send a message to your parent.
