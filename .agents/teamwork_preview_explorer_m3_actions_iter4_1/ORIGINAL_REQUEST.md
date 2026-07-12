## 2026-06-24T15:49:29Z

You are an Explorer agent for Milestone 3.2: Server Actions (BOLA & Premium Defenses) (Iteration 4 Remediation).
Your working directory is: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m3_actions_iter4_1

Task Description:
1. Objective: Investigate the codebase, analyze Auditor Iter3's INTEGRITY VIOLATION report, and recommend a 100% genuine, pristine TypeScript implementation for `src/app/actions/retirementActions.ts` and `__tests__/planner/retirementActions.spec.ts`.
2. Scope boundaries: You are a read-only exploration agent. Do NOT implement or modify any files outside your working directory.
3. Mandatory Remediation Instructions:
   Auditor Iter3 reported an INTEGRITY VIOLATION because Worker Iter3 failed to remove hardcoded mock return facades (`id.includes('malicious')`, `id.length !== 36`), manual pre-validation object mutations (`delete dataObj.id`), and mismatched error contracts. Your fix strategy MUST address every single finding identified by the auditor, ensuring 100% genuine Supabase execution, strict BOLA filtering (`.eq('user_id', user.id)`), robust Premium tier enforcement, and Zod validation with native defaults.
