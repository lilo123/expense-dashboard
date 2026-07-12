# Task Description: M1.5 Drawdown & Simulator Challenger 1

## Objective
Empirically verify `src/lib/planner/drawdownEngine.ts` and `src/lib/planner/simulator.ts` by writing adversarial stress test cases in `__tests__/planner/adv_drawdownEngine.spec.ts`. Focus on drawdown sequencing edge cases, severe market losses, account depletion boundaries, zero spending needs, and extreme inflation/growth rates.

## Loaded Domain Skill
Load and follow the Jetski skill at: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/solution_stress_testing/SKILL.md`

## Scope & Execution
- Create `__tests__/planner/adv_drawdownEngine.spec.ts` containing adversarial unit tests covering RMD edge cases, extreme tax circularity, complete portfolio depletion, and exact immutability/conservation of wealth invariants.
- Run `npx tsc --noEmit` and `npm run test __tests__/planner` to ensure clean build and 100% passing tests across all baseline and adversarial suites.
- If bugs are uncovered in `drawdownEngine.ts`, fix them to ensure all tests pass perfectly.

## Output Requirements
- Write `stress_test.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_m1_5_drawdown_1`) detailing your adversarial test cases and findings.
- Write `handoff.md` in your working directory following the Handoff Protocol, documenting passing build/test outputs.
- Send a completion message to your parent orchestrator (`sub_orch_m1_core_domain_1`).
