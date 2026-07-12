# Task Description: M1.5 Drawdown & Simulator Forensic Auditor

## Objective
Perform forensic integrity verification on `src/lib/planner/drawdownEngine.ts`, `src/lib/planner/simulator.ts`, and all associated test files in `__tests__/planner/`.

## Loaded Domain Skill
Load and follow the Jetski skill at: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/test_coverage_audit/SKILL.md`

## Scope & Execution
- Verify that all implementations are genuine, fully authentic, and robust.
- Perform rigorous checks to ensure there is NO cheating, NO hardcoded test results, NO dummy/facade implementations, and NO circumvention of the intended task.
- Run `npx tsc --noEmit` and `npm run test __tests__/planner` to confirm clean compilation and genuine passing tests.

## Output Requirements
- Write `audit_report.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_auditor_m1_5_drawdown_1`) detailing your forensic checks and findings.
- Write `handoff.md` in your working directory following the Handoff Protocol, explicitly stating your binary verdict (CLEAN or INTEGRITY VIOLATION).
- Send a completion message to your parent orchestrator (`sub_orch_m1_core_domain_1`).
