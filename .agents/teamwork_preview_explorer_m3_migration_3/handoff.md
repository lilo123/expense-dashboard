# Handoff Report — Milestone 3.1: Supabase Migration & RLS

**Summary of Core Findings:** Our read-only investigation of the domain types (`src/lib/planner/types.ts`), project scope (`PROJECT.md`, `SCOPE.md`), and existing Supabase migrations confirms the exact schema requirements for storing household retirement plans. We recommend creating a `public.retirement_plans` table featuring explicit scalar columns for household attributes, JSONB columns for complex array/object structures (`accounts`, `spending`, `pensions`, `lifeEvents`, `simulationConfig`), strict Row Level Security policies (`auth.uid() = user_id`), an `updated_at` trigger function, an index on `user_id`, and PostgREST schema cache reloading.

---

## 1. Observation

### Observation 1.1: Project & Milestone Scope Requirements
- **Source:** `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md` (lines 9, 16, 30-32) and `.agents/sub_orch_m3_db_actions_1/SCOPE.md` (lines 4, 11, 15-18).
- **Verbatim Content:**
  - `PROJECT.md`, line 9: `Security & Backend: Supabase migrations (supabase/migrations/20260624000000_retirement_planner.sql) with strict RLS (auth.uid() = user_id).`
  - `SCOPE.md`, line 4: `Implement Supabase migrations (supabase/migrations/20260624000000_retirement_planner.sql) with strict Row Level Security (auth.uid() = user_id).`
  - `SCOPE.md`, lines 15-18:
    ```typescript
    ### `src/app/actions/retirementActions.ts` ↔ Frontend Components
    - `savePlan(plan: Household & { id?: string }): Promise<{ success: boolean, planId?: string, error?: string }>` with BOLA defense and Premium checks.
    - `getPlans(): Promise<{ success: boolean, plans?: any[], error?: string }>`
    - `getPlan(id: string): Promise<{ success: boolean, plan?: any, error?: string }>`
    ```

### Observation 1.2: Domain Types & Zod Schemas
- **Source:** `/usr/local/google/home/duynguyenn/expense-dashboard/src/lib/planner/types.ts` (lines 110-140).
- **Verbatim Content:**
  ```typescript
  // 6. Household Schema
  export const HouseholdSchema = z.object({
    id: z.string().optional(),
    user_id: z.string().optional(),
    name: z.string().min(1, "Household name is required"),
    taxJurisdiction: z.enum(['US', 'CA']),
    stateProvince: z.string().min(1, "State or province is required"),
    birthYear: z.number().int().min(1900).max(2100),
    retirementAge: z.number().int().min(50).max(80),
    spouseBirthYear: z.number().int().min(1900).max(2100).optional(),
    spouseRetirementAge: z.number().int().min(50).max(80).optional(),
    includeSpouse: z.boolean().default(false),
    horizonMode: z.enum(['fixed_years', 'life_expectancy']).default('fixed_years'),
    accounts: z.array(AccountSchema).optional(),
    spending: SpendingSchema.optional(),
    pensions: z.array(PensionSchema).optional(),
    lifeEvents: z.array(LifeEventSchema).optional(),
    simulationConfig: SimulationConfigSchema.optional(),
  })
  ```

### Observation 1.3: Existing Supabase Migration Conventions
- **Source:** `supabase/migrations/20260602000000_finance_deal_tracker.sql` (lines 2-59) and `supabase/migrations/20260603000000_redesign_finance_deal_tracker.sql` (lines 4-17, 130).
- **Verbatim Content:**
  - Foreign key and cascade pattern: `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - Indexing pattern: `CREATE INDEX IF NOT EXISTS idx_deals_user_id ON public.deals(user_id);`
  - RLS enabling pattern: `ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;`
  - RLS policies pattern:
    ```sql
    CREATE POLICY "Users can view their own deals" ON public.deals FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Users can create their own deals" ON public.deals FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can update their own deals" ON public.deals FOR UPDATE USING (auth.uid() = user_id);
    CREATE POLICY "Users can delete their own deals" ON public.deals FOR DELETE USING (auth.uid() = user_id);
    ```
  - Trigger pattern:
    ```sql
    CREATE OR REPLACE FUNCTION public.set_deals_updated_at() RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
    CREATE TRIGGER trg_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.set_deals_updated_at();
    ```
  - Schema cache reload pattern: `NOTIFY pgrst, 'reload schema';`

### Observation 1.4: Server Actions DB Interaction Pattern
- **Source:** `/usr/local/google/home/duynguyenn/expense-dashboard/src/app/actions/deals.ts` (lines 33-38, 62-76).
- **Verbatim Content:**
  - Queries leverage the Supabase JS client directly against the underlying tables (`.from('deals').select(...)`, `.from('deals').insert(...)`). The table column names match the data schema properties being inserted.

---

## 2. Logic Chain

1. **Table Identification & Naming:** Based on Observation 1.1, the target migration file is `supabase/migrations/20260624000000_retirement_planner.sql`. The server actions contract (`savePlan`, `getPlans`, `getPlan`) manages household retirement plans. To align cleanly with the file naming convention (`retirement_planner.sql`) and domain context, the table should be named `public.retirement_plans` (with `public.household_plans` as an acceptable alternative).
2. **Column Definitions & Data Type Mapping:** Based on Observation 1.2 (`HouseholdSchema`), the table must store all properties of a household plan. We map these directly to PostgreSQL DDL:
   - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `user_id`: `UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` (linking to Supabase Auth users table as seen in Observation 1.3).
   - `name`: `TEXT NOT NULL`
   - `taxJurisdiction`: `TEXT NOT NULL CHECK ("taxJurisdiction" IN ('US', 'CA'))`
   - `stateProvince`: `TEXT NOT NULL`
   - `birthYear`: `INTEGER NOT NULL CHECK ("birthYear" >= 1900 AND "birthYear" <= 2100)`
   - `retirementAge`: `INTEGER NOT NULL CHECK ("retirementAge" >= 50 AND "retirementAge" <= 80)`
   - `spouseBirthYear`: `INTEGER CHECK ("spouseBirthYear" >= 1900 AND "spouseBirthYear" <= 2100)`
   - `spouseRetirementAge`: `INTEGER CHECK ("spouseRetirementAge" >= 50 AND "spouseRetirementAge" <= 80)`
   - `includeSpouse`: `BOOLEAN NOT NULL DEFAULT false`
   - `horizonMode`: `TEXT NOT NULL DEFAULT 'fixed_years' CHECK ("horizonMode" IN ('fixed_years', 'life_expectancy'))`
   - `accounts`: `JSONB DEFAULT '[]'::jsonb`
   - `spending`: `JSONB DEFAULT '{}'::jsonb`
   - `pensions`: `JSONB DEFAULT '[]'::jsonb`
   - `lifeEvents`: `JSONB DEFAULT '[]'::jsonb`
   - `simulationConfig`: `JSONB DEFAULT '{}'::jsonb`
   - `created_at` & `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT now()`
3. **Case Sensitivity & Seamless JS Client Integration:** In PostgreSQL, unquoted identifiers are folded to lowercase. Since the Zod schema in Observation 1.2 uses camelCase (e.g., `taxJurisdiction`, `stateProvince`, `lifeEvents`, `simulationConfig`), defining the PostgreSQL columns with double quotes (e.g., `"taxJurisdiction"`) preserves the exact camelCase casing. As seen in Observation 1.4, this allows the Supabase JS client in Server Actions (`src/app/actions/retirementActions.ts`) to insert and select Zod-validated objects directly without needing intermediate object key transformation or mapping layers.
4. **Row Level Security (RLS):** Based on Observation 1.1 and Observation 1.3, strict RLS is required. We must enable RLS (`ALTER TABLE public.retirement_plans ENABLE ROW LEVEL SECURITY;`) and create distinct policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`, each verifying `auth.uid() = user_id`.
5. **Performance & Data Integrity Guardrails:** Based on Observation 1.3, we must add a `user_id` index (`idx_retirement_plans_user_id`) to optimize query lookups per user, define an `updated_at` trigger function (`set_retirement_plans_updated_at`), and append `NOTIFY pgrst, 'reload schema';` to instantly refresh the PostgREST API cache upon migration execution.

---

## 3. Caveats

- **Table Naming Preference:** We have recommended `public.retirement_plans` as the primary table name due to its strong alignment with `20260624000000_retirement_planner.sql`, `useRetirementStore.tsx`, and `retirementActions.ts`. However, if the M3.2 implementer prefers `public.household_plans` (derived from "storing household plans"), the DDL table name and trigger/index names can be trivially updated to `public.household_plans`. Both are fully compatible with the requirements.
- **Casing Strategy Alternative (camelCase vs snake_case):** We have quoted camelCase columns (`"taxJurisdiction"`, `"stateProvince"`, `"birthYear"`, `"retirementAge"`, `"spouseBirthYear"`, `"spouseRetirementAge"`, `"includeSpouse"`, `"horizonMode"`, `"lifeEvents"`, `"simulationConfig"`) to provide zero-cost mapping to `HouseholdSchema`. If the backend engineering convention strictly dictates snake_case for PostgreSQL columns (e.g., `tax_jurisdiction`, `life_events`), the implementer may define them in snake_case. However, doing so will require the M3.2 Server Actions implementer to explicitly map camelCase keys to snake_case before calling `.insert()` / `.update()` and map them back when calling `.select()`. Preserving camelCase via quotes avoids this overhead entirely.
- **Scope Limitations:** As a read-only Explorer agent operating under CODE_ONLY network rules, we have not created or executed the migration file directly. The implementation of `supabase/migrations/20260624000000_retirement_planner.sql` is reserved for the designated implementation agent.

---

## 4. Conclusion

We recommend the following exact SQL DDL and RLS policies for `supabase/migrations/20260624000000_retirement_planner.sql`:

```sql
-- ============================================================================
-- Migration: 20260624000000_retirement_planner.sql
-- Description: Creates retirement_plans table with strict RLS and JSONB columns
-- ============================================================================

-- 1. Create Retirement Plans Table
CREATE TABLE IF NOT EXISTS public.retirement_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    "taxJurisdiction" TEXT NOT NULL CHECK ("taxJurisdiction" IN ('US', 'CA')),
    "stateProvince" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL CHECK ("birthYear" >= 1900 AND "birthYear" <= 2100),
    "retirementAge" INTEGER NOT NULL CHECK ("retirementAge" >= 50 AND "retirementAge" <= 80),
    "spouseBirthYear" INTEGER CHECK ("spouseBirthYear" >= 1900 AND "spouseBirthYear" <= 2100),
    "spouseRetirementAge" INTEGER CHECK ("spouseRetirementAge" >= 50 AND "spouseRetirementAge" <= 80),
    "includeSpouse" BOOLEAN NOT NULL DEFAULT false,
    "horizonMode" TEXT NOT NULL DEFAULT 'fixed_years' CHECK ("horizonMode" IN ('fixed_years', 'life_expectancy')),
    accounts JSONB DEFAULT '[]'::jsonb,
    spending JSONB DEFAULT '{}'::jsonb,
    pensions JSONB DEFAULT '[]'::jsonb,
    "lifeEvents" JSONB DEFAULT '[]'::jsonb,
    "simulationConfig" JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Index on user_id for Performant Lookups
CREATE INDEX IF NOT EXISTS idx_retirement_plans_user_id ON public.retirement_plans(user_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.retirement_plans ENABLE ROW LEVEL SECURITY;

-- 4. Create Strict RLS Policies (auth.uid() = user_id)
DROP POLICY IF EXISTS "Users can view their own retirement plans" ON public.retirement_plans;
CREATE POLICY "Users can view their own retirement plans"
    ON public.retirement_plans FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own retirement plans" ON public.retirement_plans;
CREATE POLICY "Users can create their own retirement plans"
    ON public.retirement_plans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own retirement plans" ON public.retirement_plans;
CREATE POLICY "Users can update their own retirement plans"
    ON public.retirement_plans FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own retirement plans" ON public.retirement_plans;
CREATE POLICY "Users can delete their own retirement plans"
    ON public.retirement_plans FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Create Trigger for Automatically Updating updated_at Timestamp
CREATE OR REPLACE FUNCTION public.set_retirement_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_retirement_plans_updated_at ON public.retirement_plans;
CREATE TRIGGER trg_retirement_plans_updated_at
    BEFORE UPDATE ON public.retirement_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.set_retirement_plans_updated_at();

-- 6. Reload PostgREST Schema Cache Immediately
NOTIFY pgrst, 'reload schema';
```

---

## 5. Verification Method

To independently verify the recommendations and future implementation of this migration, execute the following validation steps:

1. **File Inspection:** Verify that `supabase/migrations/20260624000000_retirement_planner.sql` is created exactly as specified in the Conclusion section.
2. **Local Schema Verification:** Run the Supabase CLI local status/migration checks (if a local Supabase instance is active) to ensure the migration applies cleanly without SQL syntax errors or constraint violations:
   ```bash
   supabase migration list
   supabase db reset
   ```
3. **Unit & Integration Test Execution:** After the implementation agent completes M3.1 and M3.2, execute the core planner unit test suite to verify 100% passing test coverage and verify that Server Actions interact seamlessly with the newly created table structure:
   ```bash
   npm run test __tests__/planner
   ```
4. **Invalidation Conditions:** The conclusion would be invalidated if the Zod schemas in `src/lib/planner/types.ts` are structurally modified (e.g., adding/removing mandatory fields or renaming properties) or if the project architecture shifts away from Supabase Auth (`auth.users`) for user identification.
