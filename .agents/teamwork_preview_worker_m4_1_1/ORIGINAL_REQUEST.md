## 2026-07-03T21:51:34Z
You are Worker 1 for Milestone 4 (M4: UI Inputs & Toggles Implementation).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m4_1_1`.
Read `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`, `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m4_1/SCOPE.md`, `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/ORIGINAL_REQUEST.md`, and the 3 Explorer handoff reports:
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m4_1_1/handoff.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m4_1_2/handoff.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m4_1_3/handoff.md`

Load the domain skill at: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement the exact changes recommended in the Explorer handoff reports:
1. `src/app/calculator/CalculatorParams.tsx`: Add Market Data Source toggle, Simulation Mode toggle, Timeline & Accumulation toggle, and Accumulation inputs (`currentAge`, `retirementAge`, `additionalContribution`) with disabled/greying out logic.
2. `src/app/calculator/views/DataAssumptionsView.tsx`: Import `useSimulation` and `getAllMarketData`, and dynamically update `historicalDataRows` based on `config?.marketDataMode`.
3. `src/app/calculator/views/SummaryView.tsx`, `PortfolioValueView.tsx`, `AvailableSpendingView.tsx`, `SimulationsListView.tsx`: Implement `isMonteCarlo` checks to switch labels/headers and prevent tooltip overflow in Recharts by slicing arrays.

When implementation is complete, execute and verify the following commands pass successfully:
- `npx tsc --noEmit`
- `npm run test`
- `npm run build`
- `npx tsx e2e/verify_accumulation.ts`
- `npx tsx e2e/verify_monte_carlo.ts`
- `npx tsx e2e/run_e2e.ts`

Document all commands, execution outputs, and results in your handoff report (`handoff.md` in your working directory). When done, send a message to your parent.
