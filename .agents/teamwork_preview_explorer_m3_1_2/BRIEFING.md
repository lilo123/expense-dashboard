# BRIEFING — 2026-07-03T21:19:30Z

## Mission
Explore the codebase and recommend a concrete implementation strategy for `src/workers/simulation.worker.ts` to support M3.1 requirements, with a special focus on `Retirement & Accumulation Period` timeline logic.

## 🔒 My Identity
- Archetype: Stellar Teamwork explorer
- Roles: Explorer 2 for Milestone 3.1 (M3.1: Implement Accumulation & Monte Carlo)
- Working directory: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m3_1_2`
- Original parent: 6b7a5c2c-6849-40f4-8906-87a1b0974900
- Milestone: M3.1: Implement Accumulation & Monte Carlo

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Pay special attention to `Retirement & Accumulation Period` timeline logic (accumulation years `config.retirementAge - config.currentAge`, zero withdrawals `withdrawal = 0`, `realWithdrawal = 0`, adding `config.additionalContribution`, compounding market returns during accumulation, transitioning to retirement withdrawal phase for `config.duration`)
- Ensure correct handling of all M3.1 requirements (Market Data Mode, Timeline Toggle, Simulation Mode Toggle / Scrambled Monte Carlo)
- Network restrictions: CODE_ONLY network mode.

## Current Parent
- Conversation ID: 6b7a5c2c-6849-40f4-8906-87a1b0974900
- Updated: not yet

## Investigation State
- **Explored paths**: `PROJECT.md`, `SCOPE.md`, `task.md`, `src/workers/simulation.worker.ts`, `src/types/simulation.ts`, `src/lib/marketData.ts`, `src/lib/globalMarketData.ts`, `src/schemas/simulationSchema.ts`
- **Key findings**: 
  1. `simulation.worker.ts` currently only simulates retirement years (`config.duration`) and defaults to US market data.
  2. For `timelineMode === 'retirement_and_accumulation'`, `totalDuration` must be `accumulationYears + config.duration`. During accumulation (`t <= accumulationYears`), withdrawals must be 0, `config.additionalContribution` added, and `previousWithdrawal` preserved for retirement start.
  3. For `simulationMode === 'monte_carlo'`, exactly 1,000 runs must be generated using Mulberry32 PRNG (seeded for reproducibility), sampling from `getAllMarketData(config.marketDataMode)`.
  4. Spending metrics (volatility, min/max spend bins, averages) must be scoped to retirement years (`t > accumulationYears`) to prevent skewing by zero-withdrawal accumulation years.
- **Unexplored areas**: None. All required files and logic paths fully analyzed.

## Key Decisions Made
- Formulate a complete, drop-in implementation plan for `src/workers/simulation.worker.ts` that unifies Historical and Monte Carlo modes while correctly segmenting Accumulation and Retirement phases.

## Artifact Index
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m3_1_2/ORIGINAL_REQUEST.md` — Store original user request
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m3_1_2/progress.md` — Liveness heartbeat and progress tracking
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m3_1_2/BRIEFING.md` — Situational awareness working memory
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m3_1_2/handoff.md` — 5-component handoff report with concrete implementation strategy
