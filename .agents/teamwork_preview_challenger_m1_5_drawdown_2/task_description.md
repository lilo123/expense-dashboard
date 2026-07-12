# Task Description: M1.5 Drawdown & Simulator Challenger 2

## Objective
Empirically verify `src/lib/planner/drawdownEngine.ts` and `src/lib/planner/simulator.ts` by writing adversarial stress test cases in `__tests__/planner/adv_simulator.spec.ts`. Focus on multi-path Monte Carlo percentile aggregation (`p10`, `p50`, `p90`), `successRate` edge cases, `runQuickCheckSimulation` determinism, and exact Zod contract adherence (`SimulationResultsSummarySchema.parse`).

## Loaded Domain Skill
Load and follow the Jetski skill at: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/solution_stress_testing/SKILL.md`

## Scope & Execution
- Create `__tests__/planner/adv_simulator.spec.ts` containing adversarial unit tests covering multi-path sorting, percentile extraction with odd/even path counts, extreme market return matrices, expectedReturnOverride precedence, and QuickCheck params edge cases.
- Run `npx tsc --noEmit` and `npm run test __tests__/planner` to ensure clean build and 100% passing tests across all baseline and adversarial suites.
- If bugs are uncovered in `simulator.ts`, fix them to ensure all tests pass perfectly.

## Output Requirements
- Write `stress_test.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_m1_5_drawdown_2`) detailing your adversarial test cases and findings.
- Write `handoff.md` in your working directory following the Handoff Protocol, documenting passing build/test outputs.
- Send a completion message to your parent orchestrator (`sub_orch_m1_core_domain_1`).
