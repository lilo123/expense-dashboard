## 2026-06-23T22:47:14Z
You are a Worker agent for Milestone 3.1: Supabase Migration & RLS.
Your working directory is: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m3_migration_1

Load the Jetski skill at:
/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

Task Description:
1. Objective: Implement the Supabase migration file `supabase/migrations/20260624000000_retirement_planner.sql` based on the Explorer findings.
2. Explorer Findings Summary:
   - Create table `public.retirement_plans`.
   - Use quoted camelCase column names (`"taxJurisdiction"`, `"stateProvince"`, `"birthYear"`, `"retirementAge"`, `"spouseBirthYear"`, `"spouseRetirementAge"`, `"includeSpouse"`, `"horizonMode"`, `accounts`, `spending`, `pensions`, `"lifeEvents"`, `"simulationConfig"`) to perfectly match the `Household` Zod schema in `src/lib/planner/types.ts`. This allows zero-overhead persistence with Supabase JS client in Next.js Server Actions.
   - Set scalar constraints: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `name TEXT NOT NULL`.
   - Add CHECK constraints: `CHECK ("taxJurisdiction" IN ('US', 'CA'))`, `CHECK ("birthYear" >= 1900 AND "birthYear" <= 2100)`, `CHECK ("retirementAge" >= 50 AND "retirementAge" <= 80)`, `CHECK ("spouseBirthYear" >= 1900 AND "spouseBirthYear" <= 2100)`, `CHECK ("spouseRetirementAge" >= 50 AND "spouseRetirementAge" <= 80)`, `CHECK ("horizonMode" IN ('fixed_years', 'life_expectancy'))`.
   - Use JSONB columns for `accounts`, `spending`, `pensions`, `"lifeEvents"`, `"simulationConfig"`. Default `accounts`, `pensions`, `"lifeEvents"` to `'[]'::jsonb`.
   - Add `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
   - Create index `idx_retirement_plans_user_id ON public.retirement_plans(user_id);`.
   - Enable strict Row Level Security (RLS) on `public.retirement_plans` (`ALTER TABLE public.retirement_plans ENABLE ROW LEVEL SECURITY;`).
   - Define RLS policies ensuring `auth.uid() = user_id` for SELECT, INSERT, UPDATE, DELETE (or a FOR ALL policy).
   - Create/attach trigger `trg_retirement_plans_updated_at` before update to call `public.update_updated_at_column()` (reusing or creating the function).
   - Add `NOTIFY pgrst, 'reload schema';` at the end of the file.
3. Verification: Check the created migration file and if Supabase CLI is available, verify it (e.g. `npx supabase migration list`). If Supabase CLI is not running/available in this container environment, ensure the SQL syntax is flawless and perfectly formatted.
4. Output requirements: Write `handoff.md` in your working directory detailing the implementation, verification commands/results, and observations.
5. Mandatory Integrity Warning: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
6. Completion criteria: `supabase/migrations/20260624000000_retirement_planner.sql` is created, `handoff.md` is fully written, and you have sent a message back to your parent orchestrator with the absolute path to `handoff.md`.
