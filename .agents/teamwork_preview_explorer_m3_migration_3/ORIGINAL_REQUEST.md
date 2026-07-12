## 2026-06-23T22:42:55Z
You are an Explorer agent for Milestone 3.1: Supabase Migration & RLS.
Your working directory is: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m3_migration_3

Task Description:
1. Objective: Investigate the codebase and recommend the exact SQL DDL and RLS policies for `supabase/migrations/20260624000000_retirement_planner.sql`.
2. Scope boundaries: You are a read-only exploration agent. Do NOT implement or modify any files outside your working directory.
3. Input information:
   - Project scope: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md
   - Milestone scope: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m3_db_actions_1/SCOPE.md
   - Domain Types: /usr/local/google/home/duynguyenn/expense-dashboard/src/lib/planner/types.ts
   - Existing Supabase migrations and schema definitions (investigate the `supabase/` directory to understand existing tables like `profiles`, `auth.users`, etc.).
4. Output requirements: Produce a structured handoff report `handoff.md` in your working directory containing your analysis, recommended DDL table schema (storing household plans, including JSONB columns for accounts, spending, pensions, lifeEvents, simulationConfig, etc.), strict RLS policies (`auth.uid() = user_id`), and verified evidence chains.
5. Completion criteria: `handoff.md` is fully written and you have sent a message back to your parent orchestrator summarizing your findings and providing the absolute path to `handoff.md`.
