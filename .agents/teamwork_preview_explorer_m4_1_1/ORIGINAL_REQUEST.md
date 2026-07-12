## 2026-07-03T21:46:48Z

You are Explorer 1 for Milestone 4 (M4: UI Inputs & Toggles Implementation).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m4_1_1`.
Read `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`, `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m4_1/SCOPE.md`, and `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/ORIGINAL_REQUEST.md`.

Your specific focus is `src/app/calculator/CalculatorParams.tsx` and `src/SimulationProvider.tsx`.
Investigate the existing code and determine the exact changes needed to implement:
1. Global Market Data Toggle (`us` vs `global`).
2. Accumulation Phase & Timeline Calculation Toggle (`Retirement Period Only` vs `Retirement & Accumulation Period`). In `Retirement Period Only`, disable and grey out Retirement Age, Current Age, and Additional Yearly Contributions fields. In `Retirement & Accumulation Period`, enable them and pass them to the simulation config.
3. Simulation Mode Toggle (`Historical Backtesting` vs `Scrambled Monte Carlo`).

Do NOT implement the changes. Produce a structured handoff report (`handoff.md` in your working directory) with verified evidence chains, exact file paths, observation, logic chain, caveats, and conclusion (recommended fix strategy). When done, send a message to your parent.
