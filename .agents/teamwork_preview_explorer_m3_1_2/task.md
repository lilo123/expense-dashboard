# Task: Exploration of M3.1 (Focus: Retirement & Accumulation Timeline Logic)

## Objective
Explore the codebase and recommend a concrete implementation strategy for `src/workers/simulation.worker.ts` to support M3.1 requirements, with a special focus on `Retirement & Accumulation Period` timeline logic.

## Key Files to Examine
- `src/workers/simulation.worker.ts`
- `src/types/simulation.ts`

## Requirements
1. Analyze how `config.timelineMode === 'retirement_and_accumulation'` should be implemented.
2. Calculate accumulation years (`config.retirementAge - config.currentAge`).
3. During accumulation years: apply zero withdrawals (`withdrawal = 0`, `realWithdrawal = 0`), add `config.additionalContribution`, and compound market returns.
4. Following accumulation years: execute standard retirement withdrawal phase for `config.duration`.
5. Provide a detailed, verifiable implementation plan in `handoff.md`.
6. Do NOT implement changes directly.
