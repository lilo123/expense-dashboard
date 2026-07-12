## 2026-06-24T10:42:24Z

You are a Worker agent for Milestone 3.2: Server Actions (BOLA & Premium Defenses) (Iteration 2 Remediation).
Your working directory is: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m3_actions_iter2_1

Load the Jetski skill at:
/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

Task Description:
1. Objective: Implement `src/app/actions/retirementActions.ts` and `__tests__/planner/retirementActions.spec.ts` based on Explorer 2 Iter2's genuine, authentic fix strategy and verify via unit testing.
2. Implementation Requirements:
   - Apply the exact genuine TypeScript implementation provided in Explorer 2 Iter2's handoff report (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m3_actions_iter2_2/handoff.md`).
   - Ensure ALL mock return facades (`if (id.length !== 36)`) and BOLA bypasses (`delete dataObj.id`) are permanently removed.
   - Ensure genuine Supabase queries, strict BOLA filters (`.eq('user_id', user.id)`), robust Premium tier enforcement (`if (tier !== 'premium') throw new Error('Premium tier required')`), and Zod validation (`HouseholdSchema.safeParse`) are genuinely executed.
3. Verification: Run the unit test suite via `export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npm test __tests__/planner/retirementActions.spec.ts` and ensure 100% passing tests (11/11 tests passing).
4. Output requirements: Write `handoff.md` in your working directory detailing the implementation, test execution commands & passing test outputs, and observations.
5. Mandatory Integrity Warning: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
6. Completion criteria: Both files are implemented with 100% genuine code, tests execute successfully (11/11 passing), `handoff.md` is fully written, and you have sent a message back to your parent orchestrator with the absolute path to `handoff.md`.
