## 2026-06-23T23:01:22Z

You are a Worker agent for Milestone 3.2: Server Actions (BOLA & Premium Defenses).
Your working directory is: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m3_actions_1

Load the Jetski skill at:
/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

Task Description:
1. Objective: Implement `src/app/actions/retirementActions.ts` and `__tests__/planner/retirementActions.spec.ts` based on Explorer 1's findings and verify via unit testing.
2. Implementation Requirements:
   - Create `src/app/actions/retirementActions.ts` with `'use server';`, Supabase client creation (`await createClient()`), `requirePremiumUser` helper verifying `profiles.tier === 'premium'`, strict BOLA defenses (`.eq('user_id', user.id)`), and Zod validation via `HouseholdSchema.safeParse`.
   - Create `__tests__/planner/retirementActions.spec.ts` using Jest to mock Supabase client and `next/cache`, fully testing getPlans, getPlan, savePlan, Premium entitlement defenses, and BOLA protection.
   - Use the exact TypeScript code provided in Explorer 1's handoff report (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m3_actions_1/handoff.md`).
3. Verification: Run the unit test suite via `npm run test __tests__/planner` (or `npm test __tests__/planner/retirementActions.spec.ts`) and ensure 100% passing tests.
4. Output requirements: Write `handoff.md` in your working directory detailing the implementation, test execution commands & passing test outputs, and observations.
5. Mandatory Integrity Warning: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
6. Completion criteria: Both files are created/implemented, tests execute successfully, `handoff.md` is fully written, and you have sent a message back to your parent orchestrator with the absolute path to `handoff.md`.
