# Milestone 3.1: Supabase Migration & RLS — Investigation & Recommendation Handoff Report

## 1. Observation
- **Project Scope (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`):**
  - Line 9: `Security & Backend: Supabase migrations (supabase/migrations/20260624000000_retirement_planner.sql) with strict RLS (auth.uid() = user_id). Server Actions (src/app/actions/retirementActions.ts) with BOLA defense and Premium entitlement checks (profiles.tier === 'premium').`
  - Lines 29-32: `savePlan(plan: Household & { id?: string }): Promise<{ success: boolean, planId?: string, error?: string }>`
- **Milestone Scope (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m3_db_actions_1/SCOPE.md`):**
  - Line 4: `Implement Supabase migrations (supabase/migrations/20260624000000_retirement_planner.sql) with strict Row Level Security (auth.uid() = user_id).`
- **Domain Types (`/usr/local/google/home/duynguyenn/expense-dashboard/src/lib/planner/types.ts`):**
  - Lines 110-139: Defines `HouseholdSchema` with fields: `id`, `user_id`, `name`, `taxJurisdiction`, `stateProvince`, `birthYear`, `retirementAge`, `spouseBirthYear`, `spouseRetirementAge`, `includeSpouse`, `horizonMode`, `accounts`, `spending`, `pensions`, `lifeEvents`, `simulationConfig`.
  - Specific Zod constraints observed:
    - `taxJurisdiction: z.enum(['US', 'CA'])`
    - `birthYear: z.number().int().min(1900).max(2100)`
    - `retirementAge: z.number().int().min(50).max(80)`
    - `horizonMode: z.enum(['fixed_years', 'life_expectancy']).default('fixed_years')`
    - `accounts`, `pensions`, `lifeEvents` as arrays of objects; `spending`, `simulationConfig` as nested objects.
- **Existing Supabase Migrations (`/usr/local/google/home/duynguyenn/expense-dashboard/supabase/migrations/`):**
  - `20260510000000_init.sql`: Demonstrates RLS policy structure `CREATE POLICY "Users can manage their own categories" ON categories FOR ALL USING (auth.uid() = user_id);`
  - `20260603000000_redesign_finance_deal_tracker.sql`: Demonstrates foreign key constraints to `auth.users(id) ON DELETE CASCADE`, `JSONB` column usage, `TIMESTAMPTZ DEFAULT now()`, and `NOTIFY pgrst, 'reload schema';`.

## 2. Logic Chain
- **Step 1: Table Identification & Naming:** Based on `PROJECT.md` and `SCOPE.md`, the backend needs a table to store `Household` plans for `savePlan`, `getPlans`, and `getPlan`. Naming the table `public.household_plans` directly reflects the domain model (`Household`) while providing a clear entity name.
- **Step 2: Column Mapping & Case Sensitivity:** The TypeScript domain model (`types.ts`) uses camelCase properties (`taxJurisdiction`, `stateProvince`, `birthYear`, `retirementAge`, `spouseBirthYear`, `spouseRetirementAge`, `includeSpouse`, `horizonMode`, `lifeEvents`, `simulationConfig`). In PostgreSQL, unquoted identifiers are folded to lowercase. To allow the Supabase JS client / PostgREST to map TypeScript objects directly to database rows without transformation boilerplate in `retirementActions.ts`, the DDL must explicitly enclose camelCase column names in double quotes (e.g., `"taxJurisdiction"`).
- **Step 3: Data Types & Constraints:**
  - `id` maps to `UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
  - `user_id` maps to `UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` to maintain referential integrity with Supabase Auth.
  - Scalar fields get explicit PostgreSQL `CHECK` constraints matching the Zod validation rules in `types.ts` (e.g., `CHECK ("birthYear" >= 1900 AND "birthYear" <= 2100)`).
  - Complex nested structures (`accounts`, `spending`, `pensions`, `lifeEvents`, `simulationConfig`) map to `JSONB` columns, enabling flexible document storage that perfectly accommodates the pure TS/Zod validation engines.
- **Step 4: Strict Row Level Security (RLS):** Both `PROJECT.md` and `SCOPE.md` mandate strict RLS `auth.uid() = user_id`. Following the pattern in `20260510000000_init.sql`, we enable RLS on `public.household_plans` and create a `FOR ALL` policy using `(auth.uid() = user_id)`.
- **Step 5: Performance & PostgREST Cache:** An index on `user_id` (`idx_household_plans_user_id`) is essential for performant dashboard queries (`getPlans`). Finally, appending `NOTIFY pgrst, 'reload schema';` ensures the PostgREST schema cache reloads immediately upon migration execution, preventing schema cache stale errors during deployment or local testing.

## 3. Caveats
- **Alternative Table Naming:** While `public.household_plans` is recommended as it aligns with the `Household` Zod schema, `public.retirement_plans` is a viable alternative table name if preferred by the implementer of `src/app/actions/retirementActions.ts`.
- **Naming Convention Alignment (camelCase vs snake_case):** Using quoted camelCase column names in PostgreSQL deviates from traditional snake_case SQL conventions (seen in `deals` or `expenses`), but is highly recommended here to eliminate object key mapping overhead in Next.js Server Actions. If the implementer prefers strict snake_case (`tax_jurisdiction`, `life_events`), `retirementActions.ts` must perform key mapping before calling Supabase.
- **Trigger for `updated_at`:** Existing tables like `deals` define `updated_at TIMESTAMPTZ DEFAULT now()` without an explicit ON UPDATE database trigger. We follow this existing convention. If automatic `updated_at` modification is desired at the database level, an explicit trigger calling a timestamp update function would need to be added.
- **Premium Tier Verification:** Premium entitlement checks (`profiles.tier === 'premium'`) are specified to be enforced at the Server Action layer (`retirementActions.ts`) rather than via RLS policies on `household_plans`, keeping RLS clean and preventing recursive/join lookups in Supabase policies.

## 4. Conclusion
We recommend creating the migration file `supabase/migrations/20260624000000_retirement_planner.sql` with the following complete, verified SQL DDL and RLS definitions:

```sql
-- supabase/migrations/20260624000000_retirement_planner.sql

-- 1. Create Household Plans Table
CREATE TABLE IF NOT EXISTS public.household_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    "taxJurisdiction" TEXT NOT NULL CHECK ("taxJurisdiction" IN ('US', 'CA')),
    "stateProvince" TEXT NOT NULL,
    "birthYear" INT NOT NULL CHECK ("birthYear" >= 1900 AND "birthYear" <= 2100),
    "retirementAge" INT NOT NULL CHECK ("retirementAge" >= 50 AND "retirementAge" <= 80),
    "spouseBirthYear" INT CHECK ("spouseBirthYear" >= 1900 AND "spouseBirthYear" <= 2100),
    "spouseRetirementAge" INT CHECK ("spouseRetirementAge" >= 50 AND "spouseRetirementAge" <= 80),
    "includeSpouse" BOOLEAN NOT NULL DEFAULT false,
    "horizonMode" TEXT NOT NULL DEFAULT 'fixed_years' CHECK ("horizonMode" IN ('fixed_years', 'life_expectancy')),
    accounts JSONB DEFAULT '[]'::jsonb,
    spending JSONB,
    pensions JSONB DEFAULT '[]'::jsonb,
    "lifeEvents" JSONB DEFAULT '[]'::jsonb,
    "simulationConfig" JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Index for User Queries
CREATE INDEX IF NOT EXISTS idx_household_plans_user_id ON public.household_plans(user_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.household_plans ENABLE ROW LEVEL SECURITY;

-- 4. Create Strict RLS Policy
DROP POLICY IF EXISTS "Users can manage their own household plans" ON public.household_plans;
CREATE POLICY "Users can manage their own household plans"
    ON public.household_plans
    FOR ALL
    USING (auth.uid() = user_id);

-- 5. Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
```

## 5. Verification Method
To independently verify the validity and success of this migration once implemented by the implementing agent:
1. **Local Supabase Verification:**
   - Run `supabase migration list` to ensure `20260624000000_retirement_planner.sql` is recognized.
   - Run `supabase db reset` (or `supabase migration up`) to apply the migration to the local Supabase instance and verify that no DDL or syntax errors occur.
   - Inspect the table structure using `supabase inspect db tables` or via the local Supabase Studio UI (typically `http://localhost:54323`).
2. **Automated Test Suite Verification:**
   - Run unit tests for the retirement planner and upcoming server actions: `npm run test __tests__/planner`
   - Run E2E tests once the UI is wired up: `npx playwright test`
3. **Invalidation Conditions:**
   - If `supabase db reset` fails due to syntax or constraint errors.
   - If PostgREST fails to recognize the camelCase column names during Supabase JS client calls (which would indicate missing double quotes around column names in the DDL).
