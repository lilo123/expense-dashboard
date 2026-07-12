## 2026-06-23T23:06:30Z

You are a Forensic Auditor agent for Milestone 3.2: Server Actions (BOLA & Premium Defenses).
Your working directory is: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_auditor_m3_actions_1

Load the Jetski skill at:
/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

Task Description:
1. Objective: Perform forensic integrity verification on `src/app/actions/retirementActions.ts` and `__tests__/planner/retirementActions.spec.ts`.
2. Scope: Verify that the implementation is genuine and authentic. Ensure no dummy/facade implementations exist, no hardcoded expected verification outputs or test returns are present, and the server actions genuinely execute the Supabase queries, BOLA filters (`.eq('user_id', user.id)`), Premium checks, and Zod validation.
3. Output requirements: Write `handoff.md` in your working directory with your forensic audit findings and your explicit binary verdict (CLEAN or INTEGRITY VIOLATION).
4. Completion criteria: `handoff.md` is fully written and you have sent a message back to your parent orchestrator summarizing your audit verdict and providing the absolute path to `handoff.md`.
