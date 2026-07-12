# Task Description: M1.5 Drawdown & Simulator Reviewer 2

## Objective
Review `src/lib/planner/drawdownEngine.ts`, `src/lib/planner/simulator.ts`, `__tests__/planner/drawdownEngine.spec.ts`, and `__tests__/planner/simulator.spec.ts` focusing on tax efficiency, pro-rata capital gains calculations, fixed-point iterative tax gross-up convergence, RMDs/RRIF minimums, and excess RMD reinvestment.

## Loaded Domain Skill
Load and follow the Jetski skill at: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

## Scope & Execution
- Verify the mathematical correctness and bounded execution of the fixed-point iterative tax gross-up loop and Canadian OAS clawback interactions.
- Verify RMD calculations (US Uniform Lifetime Table) and RRIF minimum withdrawal percentages (CA), including correct excess RMD reinvestment into taxable accounts.
- Verify clean compilation (`npx tsc --noEmit`) and passing test execution (`npm run test __tests__/planner`).

## Output Requirements
- Write `review.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m1_5_drawdown_2`) detailing your findings.
- Write `handoff.md` in your working directory following the Handoff Protocol, documenting build/test outputs and your final review verdict.
- Send a completion message to your parent orchestrator (`sub_orch_m1_core_domain_1`).
