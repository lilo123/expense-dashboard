# Task: Worker (Tier 2 Boundary Tests Implementation)

## Objective
Implement `e2e/planner_tier2_boundary.spec.ts` with the 35-test boundary suite and update `e2e/seed.ts` to seed a genuine premium retirement plan for BOLA testing.

## Input Information
- Explorer 1 Tier 2 Handoff: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_tier2_1/handoff.md`
- Explorer 2 Tier 2 Handoff: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_tier2_2/handoff.md`
- Explorer 3 Tier 2 Handoff: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_tier2_3/handoff.md`
- Domain Skill: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

## Required Actions
1. Read the three Explorer Tier 2 handoff reports.
2. Check and update `e2e/seed.ts` to ensure a genuine premium retirement plan (`id: 'premium-user-genuine-plan-id'`) is seeded into the `plans` table for `premium-user@example.com`.
3. Create `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/planner_tier2_boundary.spec.ts` with the exact 35-test TypeScript suite from Explorer 2 Tier 2.
4. Verify clean compilation via `npx tsc --noEmit`. (Note: as application features are being implemented in parallel, verify that the test files and infra are fully created, correctly typed, and syntactically valid).

## Output Requirements
- Write a detailed `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_tier2_1`) containing your changes, verification methods, and results.
- Send a message back to your parent with the summary and path to your `handoff.md`.
