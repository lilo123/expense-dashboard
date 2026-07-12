## 2026-06-23T22:52:08Z
You are a Reviewer agent for Milestone 3.1: Supabase Migration & RLS.
Your working directory is: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m3_migration_2

Load the Jetski skill at:
/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

Task Description:
1. Objective: Review the implemented Supabase migration file `supabase/migrations/20260624000000_retirement_planner.sql` for correctness, completeness, robustness, and interface conformance with `src/lib/planner/types.ts`.
2. Scope: Check that the table `public.retirement_plans` defines all necessary columns, uses quoted camelCase matching the `Household` Zod schema, sets proper scalar types, CHECK constraints, JSONB defaults, strict RLS policies (`auth.uid() = user_id`), index on `user_id`, update trigger, and PostgREST reload notification.
3. Verification: Inspect the migration file thoroughly. Note if `npx supabase` is unavailable in the environment, and conduct meticulous syntactic and structural review.
4. Output requirements: Write `handoff.md` in your working directory with your review findings and final verdict (PASS or VETO).
5. Completion criteria: `handoff.md` is fully written and you have sent a message back to your parent orchestrator summarizing your review and providing the absolute path to `handoff.md`.
