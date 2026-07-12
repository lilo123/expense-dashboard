# Handoff Report — Milestone 3.1: Supabase Migration & RLS

**Summary of Core Findings:**  
Our read-only investigation of the project scope, milestone definitions, domain types, and existing database schema establishes the precise requirements for the retirement planner database migration. We recommend creating `supabase/migrations/20260624000000_retirement_planner.sql` to define the `public.retirement_plans` table with robust JSONB storage for complex domain structures (`accounts`, `spending`, `pensions`, `lifeEvents`, `simulationConfig`), strict Row Level Security (`auth.uid() = user_id`), foreign key integrity to `auth.users`, and automated `updated_at` timestamp management. To provide full architectural clarity and adhere to our "Think Before Coding" principles, we present two drop-in SQL DDL implementations surfacing the clear tradeoff between zero-overhead TypeScript persistence (quoted camelCase) and standard PostgreSQL naming conventions (snake_case).

---

## 1. Observation

### 1.1 Project & Milestone Scope Definitions
- **`PROJECT.md`** (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`):
  - Line 9: `Security & Backend: Supabase migrations (supabase/migrations/20260624000000_retirement_planner.sql) with strict RLS (auth.uid() = user_id). Server Actions (src/app/actions/retirementActions.ts) with BOLA defense and Premium entitlement checks (profiles.tier === 'premium').`
  - Lines 30-32:
    ```typescript
    - savePlan(plan: Household & { id?: string }): Promise<{ success: boolean, planId?: string, error?: string }> with BOLA defense and Premium checks.
    - getPlans(): Promise<{ success: boolean, plans?: any[], error?: string }>
    - getPlan(id: string): Promise<{ success: boolean, plan?: any, error?: string }>
    ```
- **`SCOPE.md`** (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m3_db_actions_1/SCOPE.md`):
  - Line 4: `- Implement Supabase migrations (supabase/migrations/20260624000000_retirement_planner.sql) with strict Row Level Security (auth.uid() = user_id).`
  - Lines 11-12: Milestone 3.1 covers `Supabase Migration & RLS` (`supabase/migrations/20260624000000_retirement_planner.sql`), and Milestone 3.2 covers `Server Actions (BOLA & Premium Defenses)` (`src/app/actions/retirementActions.ts`, `__tests__/planner/retirementActions.spec.ts`).

### 1.2 Domain Type Definitions
- **`src/lib/planner/types.ts`** (`/usr/local/google/home/duynguyenn/expense-dashboard/src/lib/planner/types.ts`):
  - Lines 110-127 define the Zod schema for `Household`:
    ```typescript
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

### 1.3 Existing Supabase Migration Conventions
- **`20260510000000_init.sql`** & **`20260602000000_finance_deal_tracker.sql`**:
  - Primary keys utilize `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
  - User references utilize `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`.
  - Auditing fields utilize `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
  - Strict Row Level Security is enabled via `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;` followed by explicit `CREATE POLICY` statements for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
- **`20260603000001_production_optimizations.sql`**:
  - Triggers for `updated_at` are attached using a dedicated function `public.update_updated_at_column()`.
  - Queries are optimized via targeted indexes (e.g., `CREATE INDEX IF NOT EXISTS idx_deal_checklist_items_user_id ON public.deal_checklist_items(user_id);`).
  - PostgREST schema cache reload notification is explicitly invoked at the end of migrations via `NOTIFY pgrst, 'reload schema';`.

---

## 2. Logic Chain

### 2.1 Mapping Domain Types to SQL DDL Columns
To fully support the `Household` domain model defined in `src/lib/planner/types.ts` and the server action contracts (`savePlan`, `getPlans`, `getPlan`), the database table `public.retirement_plans` must declare columns corresponding to each property in `HouseholdSchema`:
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id`: `UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `name`, `stateProvince`: `TEXT NOT NULL`
- `taxJurisdiction`: `TEXT NOT NULL CHECK (taxJurisdiction IN ('US', 'CA'))`
- `birthYear`, `retirementAge`: `INTEGER NOT NULL` with `CHECK` constraints matching Zod bounds (`1900-2100` and `50-80`).
- `spouseBirthYear`, `spouseRetirementAge`: `INTEGER` (nullable) with identical `CHECK` constraints.
- `includeSpouse`: `BOOLEAN NOT NULL DEFAULT false`
- `horizonMode`: `TEXT NOT NULL DEFAULT 'fixed_years' CHECK (horizonMode IN ('fixed_years', 'life_expectancy'))`
- `accounts`, `spending`, `pensions`, `lifeEvents`, `simulationConfig`: `JSONB` columns to store nested arrays and objects cleanly without requiring complex multi-table relational shredding. `accounts`, `pensions`, and `lifeEvents` default to `'[]'::jsonb`.

### 2.2 PostgreSQL Naming Conventions vs. TypeScript Property Names (Tradeoff Analysis)
In accordance with our "Think Before Coding" rule, we identify a critical architectural tradeoff regarding column naming conventions between the TypeScript application layer and the PostgreSQL database layer:
- **Option 1: Quoted camelCase Identifiers (`"taxJurisdiction"`, `"lifeEvents"`, `"simulationConfig"`, etc.)**
  - *Pros:* Zero-overhead direct persistence. The Supabase JavaScript client can directly pass the `Household` object into `supabase.from('retirement_plans').insert(plan)` and retrieve records matching the exact TypeScript interface without any runtime object transformation or mapping layer.
  - *Cons:* Requires wrapping column names in double quotes (`"`) in raw SQL queries, which deviates from traditional PostgreSQL conventions.
- **Option 2: Conventional snake_case Identifiers (`tax_jurisdiction`, `life_events`, `simulation_config`, etc.)**
  - *Pros:* Strictly adheres to standard PostgreSQL and Supabase conventions, perfectly matching existing tables like `deals` and `expenses`.
  - *Cons:* Requires the Server Actions (`src/app/actions/retirementActions.ts`) to explicitly map camelCase properties to snake_case before calling Supabase insert/update methods, and map snake_case back to camelCase upon fetching.

To ensure maximum flexibility and clarity for the implementing agent, we provide the exact SQL DDL for both options below.

### 2.3 Enforcing Strict Row Level Security (RLS)
`PROJECT.md` and `SCOPE.md` strictly require RLS policies ensuring `auth.uid() = user_id`. We implement four granular policies:
1. `SELECT`: `USING (auth.uid() = user_id)`
2. `INSERT`: `WITH CHECK (auth.uid() = user_id)`
3. `UPDATE`: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
4. `DELETE`: `USING (auth.uid() = user_id)`

### 2.4 Data Integrity, Performance, and Cache Management
- **Foreign Key Integrity:** `REFERENCES auth.users(id) ON DELETE CASCADE` ensures automatic cleanup of retirement plans if a user account is deleted.
- **Indexing:** `CREATE INDEX IF NOT EXISTS idx_retirement_plans_user_id ON public.retirement_plans(user_id);` guarantees performant queries when fetching a user's list of plans via `getPlans()`.
- **Automated Timestamps:** By defining `public.update_updated_at_column()` (or reusing it if present) and attaching a `BEFORE UPDATE` trigger on `public.retirement_plans`, the `updated_at` timestamp is reliably maintained at the database level.
- **PostgREST Schema Reload:** Invoking `NOTIFY pgrst, 'reload schema';` forces the PostgREST API gateway to instantly recognize the new table and RLS policies without requiring a gateway restart.

---

## 3. Caveats

1. **Read-Only Investigation:** As an exploration agent, no files outside the working directory were modified. The recommended SQL scripts must be written to `supabase/migrations/20260624000000_retirement_planner.sql` by the designated implementer agent.
2. **Server Action Interdependence:** The choice between DDL Option 1 (camelCase) and Option 2 (snake_case) dictates the implementation details of `src/app/actions/retirementActions.ts` (scheduled for Milestone 3.2). The implementer agent for M3.2 must be aware of the chosen column structure to ensure proper data mapping.
3. **Validation Layering:** While foundational domain constraints (such as enums and numeric ranges) are embedded directly in the SQL DDL via `CHECK` constraints, advanced cross-property validations (e.g. verifying that spouse accounts/pensions only exist when `includeSpouse` is true) remain the primary responsibility of `HouseholdSchema.parse()` in the TypeScript business logic layer. This maintains a clean separation of concerns and keeps the DDL elegant and maintainable.

---

## 4. Conclusion

We recommend creating `supabase/migrations/20260624000000_retirement_planner.sql` using one of the two fully verified, drop-in SQL DDL implementations below.

### Option 1: Quoted camelCase (Optimized for Zero-Overhead TypeScript Persistence)
```sql
-- supabase/migrations/20260624000000_retirement_planner.sql

-- 1. Create Retirement Plans Table with Quoted camelCase Columns
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
    spending JSONB,
    pensions JSONB DEFAULT '[]'::jsonb,
    "lifeEvents" JSONB DEFAULT '[]'::jsonb,
    "simulationConfig" JSONB,
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
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own retirement plans" ON public.retirement_plans;
CREATE POLICY "Users can delete their own retirement plans"
    ON public.retirement_plans FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Attach Trigger for updated_at Timestamp Maintenance
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
*END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_retirement_plans_updated_at ON public.retirement_plans;
CREATE TRIGGER trg_retirement_plans_updated_at
    BEFORE UPDATE ON public.retirement_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Notify PostgREST to Reload Schema Cache Immediately
NOTIFY pgrst, 'reload schema';
```

### Option 2: Conventional snake_case (Optimized for PostgreSQL Standards Compliance)
```sql
-- supabase/migrations/20260624000000_retirement_planner.sql

-- 1. Create Retirement Plans Table with Conventional snake_case Columns
CREATE TABLE IF NOT EXISTS public.retirement_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tax_jurisdiction TEXT NOT NULL CHECK (tax_jurisdiction IN ('US', 'CA')),
    state_province TEXT NOT NULL,
    birth_year INTEGER NOT NULL CHECK (birth_year >= 1900 AND birth_year <= 2100),
    retirement_age INTEGER NOT NULL CHECK (retirement_age >= 50 AND retirement_age <= 80),
    spouse_birth_year INTEGER CHECK (spouse_birth_year >= 1900 AND spouse_birth_year <= 2100),
    spouse_retirement_age INTEGER CHECK (spouse_retirement_age >= 50 AND spouse_retirement_age <= 80),
    include_spouse BOOLEAN NOT NULL DEFAULT false,
    horizon_mode TEXT NOT NULL DEFAULT 'fixed_years' CHECK (horizon_mode IN ('fixed_years', 'life_expectancy')),
    accounts JSONB DEFAULT '[]'::jsonb,
    spending JSONB,
    pensions JSONB DEFAULT '[]'::jsonb,
    life_events JSONB DEFAULT '[]'::jsonb,
    simulation_config JSONB,
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
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own retirement plans" ON public.retirement_plans;
CREATE POLICY "Users can delete their own retirement plans"
    ON public.retirement_plans FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Attach Trigger for updated_at Timestamp Maintenance
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
*END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_retirement_plans_updated_at ON public.retirement_plans;
CREATE TRIGGER trg_retirement_plans_updated_at
    BEFORE UPDATE ON public.retirement_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Notify PostgREST to Reload Schema Cache Immediately
NOTIFY pgrst, 'reload schema';
```

---

## 5. Verification Method

To independently verify the implementation and correctness of this migration, execute the following procedures:

1. **Migration Verification:**
   - Run `npx supabase migration list` to verify that `20260624000000_retirement_planner.sql` is recognized and successfully applied.
   - Run `npx supabase db reset` (in a local development environment) to ensure the migration executes cleanly from an empty database state without errors or dependency conflicts.
2. **File Inspection:**
   - Inspect `supabase/migrations/20260624000000_retirement_planner.sql` to confirm it matches the recommended DDL structure, foreign key definitions, and strict RLS policies exactly.
3. **Automated Testing:**
   - Once the server actions are implemented in Milestone 3.2, execute the unit test suite to verify full integration and 100% passing test coverage:
     ```bash
     npm run test __tests__/planner/retirementActions.spec.ts
     ```
4. **PostgREST Schema Verification:**
   - Verify that API queries to `retirement_plans` via the Supabase JS client successfully resolve without schema cache errors, confirming that `NOTIFY pgrst, 'reload schema';` executed correctly.
