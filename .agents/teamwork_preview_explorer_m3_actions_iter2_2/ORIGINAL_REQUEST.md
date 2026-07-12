## 2026-06-24T10:37:26Z
You are an Explorer agent for Milestone 3.2: Server Actions (BOLA & Premium Defenses) (Iteration 2 Remediation).
Your working directory is: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m3_actions_iter2_2

Task Description:
1. Objective: Investigate the codebase, analyze the Forensic Auditor's evidence report, and recommend a genuine, authentic fix strategy and exact TypeScript implementation for `src/app/actions/retirementActions.ts` and `__tests__/planner/retirementActions.spec.ts`.
2. Scope boundaries: You are a read-only exploration agent. Do NOT implement or modify any files outside your working directory.
3. Mandatory Remediation Instructions:
   The previous implementation failed the Forensic Audit with severe INTEGRITY VIOLATIONS. Your fix strategy MUST address the specific integrity violations identified by the auditor. You MUST NOT recommend strategies that circumvent the audit.
4. Output requirements: Produce a structured handoff report `handoff.md` in your working directory containing your analysis, recommended complete genuine TypeScript code for `src/app/actions/retirementActions.ts` and `__tests__/planner/retirementActions.spec.ts` that removes ALL hardcoded bypasses and mock facades, enforces genuine BOLA defenses (`.eq('user_id', user.id)`) and Premium checks (`profiles.tier === 'premium'`), and verified evidence chains.
5. Completion criteria: `handoff.md` is fully written and you have sent a message back to your parent orchestrator summarizing your findings and providing the absolute path to `handoff.md`.
