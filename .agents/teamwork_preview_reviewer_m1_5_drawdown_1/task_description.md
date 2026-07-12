# Task Description: M1.5 Drawdown & Simulator Reviewer 1

## Objective
Review `src/lib/planner/drawdownEngine.ts`, `src/lib/planner/simulator.ts`, `__tests__/planner/drawdownEngine.spec.ts`, and `__tests__/planner/simulator.spec.ts` for correctness, completeness, robustness, edge cases, and interface conformance with Zod schemas in `src/lib/planner/types.ts`.

## Loaded Domain Skill
Load and follow the Jetski skill at: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

## Scope & Execution
- Verify that `drawdownEngine.ts` and `simulator.ts` adhere to pure function semantics and zero side effects.
- Verify clean compilation (`npx tsc --noEmit`) and passing test execution (`npm run test __tests__/planner`).
- Check for correctness in drawdown sequencing (`taxable_first`, `tax_deferred_first`, `proportional`) and Zod schema alignment.

## Output Requirements
- Write `review.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m1_5_drawdown_1`) detailing your findings.
- Write `handoff.md` in your working directory following the Handoff Protocol, documenting build/test outputs and your final review verdict.
- Send a completion message to your parent orchestrator (`sub_orch_m1_core_domain_1`).
