# Task: Worker (Tier 1 & Test Infra Implementation)

## Objective
Implement `TEST_INFRA.md`, update `package.json` and `e2e/seed.ts`, and create `e2e/planner_tier1_feature.spec.ts` based on the Explorers' handoff reports.

## Input Information
- Explorer 1 handoff (TEST_INFRA.md): `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_tier1_1/handoff.md`
- Explorer 2 handoff (Tier 1 Tests): `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_tier1_2/handoff.md`
- Explorer 3 handoff (Test Runner Infra): `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_tier1_3/handoff.md`
- Domain Skill: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

## Required Actions
1. Read the three Explorer handoff reports.
2. Check and update `package.json` to add `"@axe-core/playwright": "^4.9.0"` in `devDependencies` if missing.
3. Check and update `e2e/seed.ts` to ensure `premium-user@example.com` (`password123`, `tier: 'premium'`, `onboarding_status: 'completed'`) is seeded alongside `test-user@example.com`.
4. Create `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_INFRA.md` with the exact markdown content from Explorer 1.
5. Create `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/planner_tier1_feature.spec.ts` with the exact TypeScript code from Explorer 2.
6. Verify file correctness and syntax. (Note: as the implementation track is running in parallel, verify that the test files and infra are fully created and syntactically valid).

## Output Requirements
- Write a detailed `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_tier1_1`) containing your changes, verification methods, and results.
- Send a message back to your parent with the summary and path to your `handoff.md`.
