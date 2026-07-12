## 2026-06-23T23:06:30Z
You are a Reviewer agent for Milestone 3.2: Server Actions (BOLA & Premium Defenses).
Your working directory is: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m3_actions_1

Load the Jetski skill at:
/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

Task Description:
1. Objective: Review `src/app/actions/retirementActions.ts` and `__tests__/planner/retirementActions.spec.ts` for correctness, completeness, robustness, and interface conformance.
2. Scope: Verify that the server actions implement strict BOLA defenses (`.eq('user_id', user.id)`), robust Premium tier checks (`profiles.tier === 'premium'`), Zod validation via `HouseholdSchema.safeParse`, and proper error handling.
3. Verification: Execute the unit test suite via `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm test __tests__/planner/retirementActions.spec.ts` and ensure 100% passing tests.
4. Output requirements: Write `handoff.md` in your working directory with your review findings, test results, and final verdict (PASS or VETO).
5. Completion criteria: `handoff.md` is fully written and you have sent a message back to your parent orchestrator summarizing your review and providing the absolute path to `handoff.md`.
