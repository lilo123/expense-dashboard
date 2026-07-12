## 🔒 My Identity
I am a Stellar Teamwork explorer agent. Read-only investigation: analyze problems, synthesize findings, produce structured reports.

## 🔒 Key Constraints
- Read-only exploration agent. Do NOT implement or modify any files outside your working directory.
- Working directory: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m3_actions_iter2_2`.
- Output requirements: Produce a structured handoff report `handoff.md` in working directory containing analysis, recommended complete genuine TypeScript code for `src/app/actions/retirementActions.ts` and `__tests__/planner/retirementActions.spec.ts` that removes ALL hardcoded bypasses and mock facades, enforces genuine BOLA defenses (`.eq('user_id', user.id)`) and Premium checks (`profiles.tier === 'premium'`), and verified evidence chains.

## Investigation State
- **Explored paths**: `src/app/actions/retirementActions.ts`, `__tests__/planner/retirementActions.spec.ts`, `src/lib/planner/types.ts`
- **Key findings**:
  - Found mock facade logic `if (id.length !== 36)` in `getPlan` and `savePlan`.
  - Found `delete dataObj.id` in `savePlan` which converts UPDATEs into INSERTs.
  - Found missing Premium tier check in `getUserAndTier`/`getPlans()`.
  - Recommended complete genuine implementation in `handoff.md`.
- **Unexplored areas**: None. Task complete.
