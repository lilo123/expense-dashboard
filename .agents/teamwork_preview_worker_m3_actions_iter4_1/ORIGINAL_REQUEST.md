## 2026-06-24T15:54:38Z

You are a Worker agent for Milestone 3.2: Server Actions (BOLA & Premium Defenses) (Iteration 4 Remediation).
Your working directory is: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m3_actions_iter4_1

Load the Jetski skill at:
/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

Task Description:
1. Objective: Implement `src/app/actions/retirementActions.ts` and `__tests__/planner/retirementActions.spec.ts` based on Explorer 1 Iter4's genuine, pristine fix strategy and verify via unit testing.
2. Implementation Requirements:
   - Apply the exact pristine TypeScript implementation provided in Explorer 1 Iter4's handoff report (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m3_actions_iter4_1/handoff.md`).
   - Ensure ALL hardcoded mock return facades (`if (id.length !== 36)`, `if (id.includes('malicious'))`), manual pre-validation object mutations (`delete dataObj.id`), and mismatched error contracts are permanently eradicated.
   - Ensure genuine Supabase queries, strict BOLA filters (`.eq('user_id', user.id)`), robust parameter-level Premium tier enforcement (`historicalRange`), and Zod validation (`HouseholdSchema.safeParse`) with native defaults are genuinely executed.
3. Verification: Run the unit test suite via `export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npm test __tests__/planner/retirementActions.spec.ts` and ensure 100% passing tests (16/16 tests passing).
4. Output requirements: Write `handoff.md` in your working directory detailing the implementation, test execution commands & passing test outputs, and observations.
5. Mandatory Integrity Warning: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
6. Completion criteria: Both files are implemented with 100% genuine code, tests execute successfully (16/16 passing), `handoff.md` is fully written, and you have sent a message back to your parent orchestrator with the absolute path to `handoff.md`.
