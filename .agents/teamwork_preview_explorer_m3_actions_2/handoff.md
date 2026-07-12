# Milestone 3.2: Server Actions (BOLA & Premium Defenses) — Handoff Report

## Executive Summary
This report provides a comprehensive architectural investigation and exact TypeScript recommendations for implementing the retirement planner Server Actions (`src/app/actions/retirementActions.ts`) and their corresponding unit tests (`__tests__/planner/retirementActions.spec.ts`). The design incorporates robust Broken Object Level Authorization (BOLA) defenses, Premium Tier verification, Zod schema validation, and comprehensive Jest unit testing in strict alignment with established project patterns.

---

## 1. Observation

During our read-only investigation of the codebase, we directly observed the following patterns, structures, and implementations:

1. **Existing Server Action Patterns (`src/app/actions/*.ts`)**:
   - `list_dir` on `src/app/actions` revealed existing actions: `admin.ts`, `budget.ts`, `compliance.ts`, `deals.ts`, `profile.ts`, `rates.ts`, `recurring.ts`, `siri.ts`.
   - All Server Action files begin with the `'use server';` directive.
   - Supabase client instantiation is universally performed via:
     ```typescript
     import { createClient } from '@/utils/supabase/server';
     // ... inside async action ...
     const supabase = await createClient();
     ```
   - Standard response formatting in `profile.ts` and `budget.ts` utilizes a serializable object structure:
     ```typescript
     Promise<{ success: boolean; data?: T; error?: string; message?: string }>
     ```
   - Standard error handling catches exceptions, logs them with a distinct prefix `console.error('[SERVER ACTION <name> FAILURE]:', ...)`, and returns a user-friendly fallback error message such as:
     `"Uh oh, the system tripped up! Don't worry, your data is safe. Let's try that again."`

2. **Premium Tier Verification (`src/app/actions/deals.ts`)**:
   - In `src/app/actions/deals.ts`, premium tier authorization is enforced via a helper function (`requirePremiumUser`) that fetches the user session and then queries the `profiles` table:
     ```typescript
     const { data: authData, error: authError } = await supabase.auth.getUser();
     if (authError || !authData?.user) throw new Error('Unauthorized');

     const { data: profile, error: profileError } = await supabase
       .from('profiles')
       .select('tier')
       .eq('id', authData.user.id)
       .single();

     if (profileError || profile?.tier !== 'premium') { ... }
     ```

3. **Data Schema & Quoted camelCase Columns (`src/lib/planner/types.ts`)**:
   - `view_file` on `src/lib/planner/types.ts` confirmed the `HouseholdSchema` Zod definition and `Household` type.
   - `HouseholdSchema` specifies `id` and `user_id` as optional string fields, while all domain-specific properties use camelCase: `taxJurisdiction`, `stateProvince`, `birthYear`, `retirementAge`, `spouseBirthYear`, `spouseRetirementAge`, `includeSpouse`, `horizonMode`, `accounts`, `spending`, `pensions`, `lifeEvents`, `simulationConfig`.
   - This matches the prompt specification that `public.retirement_plans` uses quoted camelCase columns matching `Household`.

4. **Unit Testing Framework & Mocking Conventions (`__tests__/actions/*.test.ts`)**:
   - `view_file` on `__tests__/actions/budget.test.ts` and `__tests__/actions/deals.test.ts` confirmed the testing framework is **Jest** (`describe`, `beforeEach`, `it`, `expect`, `jest.mock`).
   - Mocking conventions for Supabase Server Client and Next.js Cache are standardized as:
     ```typescript
     jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));
     jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
     ```
   - `deals.test.ts` demonstrates how to mock `supabase.from()` across multiple tables (`profiles`, `deals`, etc.) using a conditional mock implementation that returns distinct chainable query objects.

5. **Code Search for Existing References**:
   - `code_search` for `savePlan`, `getPlan`, `getPlans`, and `retirementActions` confirmed that no prior implementations or references exist in `src/` or `__tests__/`.

---

## 2. Logic Chain

1. **Supabase Client Instantiation**:
   - *Observation*: Every existing Server Action creates the Supabase client via `createClient()` from `@/utils/supabase/server`.
   - *Inference*: `src/app/actions/retirementActions.ts` must import and await `createClient()` inside each action to guarantee correct Next.js Server Component / Server Action context handling.

2. **Premium Tier Verification Architecture**:
   - *Observation*: `deals.ts` inspects `profiles.tier` by querying the `profiles` table where `id = auth.uid()`.
   - *Inference*: `retirementActions.ts` should implement a reusable `verifyPremiumUser` helper function. Rather than throwing uncaught errors, this helper should return `{ user?: User; error?: string }` to align with the graceful `{ success: false, error: '...' }` response pattern seen in `profile.ts` and `budget.ts`.

3. **BOLA (Broken Object Level Authorization) Defenses**:
   - *Observation*: `deals.ts` and `budget.ts` enforce ownership by appending `.eq('user_id', user.id)` to queries and mutations.
   - *Inference*: To provide bulletproof BOLA protection:
     - `getPlans()` must query `.from('retirement_plans').select('*').eq('user_id', user.id)`.
     - `getPlan(id)` must query `.from('retirement_plans').select('*').eq('id', id).eq('user_id', user.id).single()`.
     - `savePlan(plan)` must verify the session `user.id`. When updating an existing plan (`plan.id` is present), it must explicitly append `.eq('id', plan.id).eq('user_id', user.id)` to the update query. When inserting a new plan, it must explicitly set `user_id: user.id` in the payload, completely overriding any client-provided `user_id`.

4. **Zod Validation & camelCase Column Alignment**:
   - *Observation*: `HouseholdSchema` defines exact camelCase properties matching `public.retirement_plans`. `deals.ts` uses `DealSchema.safeParse(data)` prior to database insertion.
   - *Inference*: `savePlan(plan: Household)` must execute `HouseholdSchema.safeParse(plan)`. Upon successful validation, it extracts the validated data and constructs a payload containing the exact camelCase keys required by PostgREST/Supabase for `public.retirement_plans`.

5. **Next.js Cache Revalidation**:
   - *Observation*: Existing actions invoke `revalidatePath` and wrap it in a try/catch block (e.g. `profile.ts`) to prevent unmocked static generation context warnings during unit testing or build phases.
   - *Inference*: `savePlan` should execute `revalidatePath('/planner', 'layout')` and `revalidatePath('/dashboard', 'layout')` within a try/catch block upon successful insert/update.

6. **Comprehensive Jest Unit Testing**:
   - *Observation*: `deals.test.ts` uses conditional `supabase.from` mocking to test multi-table workflows (`profiles` tier check + domain table query).
   - *Inference*: `__tests__/planner/retirementActions.spec.ts` must define a robust `setupMockSupabase` helper to accurately simulate auth states, profile tier results, and `retirement_plans` query/mutation results. It must test unauthorized access, standard tier rejection, BOLA filtering on get/update, Zod validation failures, and successful mutations.

---

## 3. Caveats

1. **Read-Only Exploration Scope**: As an Explorer agent operating in CODE_ONLY mode, no files were created or modified outside the agent's working directory. The exact TypeScript implementations are provided below for the Implementer agent to apply directly.
2. **Database Schema Assumptions**: The underlying PostgreSQL table `public.retirement_plans` is assumed to exist with columns perfectly matching the quoted camelCase properties of `HouseholdSchema` as stated in the task prompt.
3. **Static Generation Context**: `revalidatePath` calls are wrapped in try/catch blocks as observed in `src/app/actions/profile.ts` to prevent runtime warnings during static generation and unit testing.

---

## 4. Conclusion

Below are the recommended, production-ready TypeScript implementations for `src/app/actions/retirementActions.ts` and `__tests__/planner/retirementActions.spec.ts`.

### A. Recommended Implementation for `src/app/actions/retirementActions.ts`

```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { Household, HouseholdSchema } from '@/lib/planner/types';

/**
 * Helper function to verify user authentication and Premium tier status.
 */
async function verifyPremiumUser(supabase: any): Promise<{ user?: { id: string; email?: string }; error?: string }> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return { error: 'Unauthorized' };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error('[verifyPremiumUser] Profile DB Error:', profileError);
      return { error: 'Service temporarily unavailable' };
    }

    if (profile?.tier !== 'premium') {
      return { error: 'Premium tier required' };
    }

    return { user: authData.user };
  } catch (err: unknown) {
    console.error('[verifyPremiumUser] Unexpected Error:', err instanceof Error ? err.message : err);
    return { error: 'Service temporarily unavailable' };
  }
}

/**
 * Fetches all retirement plans owned by the authenticated premium user.
 * Enforces BOLA defense via explicit user_id filtering.
 */
export async function getPlans(): Promise<{ success: boolean; data?: Household[]; error?: string }> {
  const supabase = await createClient();
  const { user, error: authError } = await verifyPremiumUser(supabase);
  
  if (authError || !user) {
    return { success: false, error: authError || 'Unauthorized' };
  }

  try {
    const { data, error } = await supabase
      .from('retirement_plans')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;

    return { success: true, data: data as Household[] };
  } catch (err: unknown) {
    console.error('[SERVER ACTION getPlans FAILURE]:', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to fetch retirement plans.' };
  }
}

/**
 * Fetches a specific retirement plan by ID.
 * Enforces BOLA defense via explicit id and user_id filtering.
 */
export async function getPlan(id: string): Promise<{ success: boolean; data?: Household; error?: string }> {
  const supabase = await createClient();
  const { user, error: authError } = await verifyPremiumUser(supabase);
  
  if (authError || !user) {
    return { success: false, error: authError || 'Unauthorized' };
  }

  if (!id) {
    return { success: false, error: 'Plan ID is required.' };
  }

  try {
    const { data, error } = await supabase
      .from('retirement_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;

    if (!data) {
      return { success: false, error: 'Retirement plan not found or unauthorized.' };
    }

    return { success: true, data: data as Household };
  } catch (err: unknown) {
    console.error('[SERVER ACTION getPlan FAILURE]:', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to fetch retirement plan. Unauthorized or plan not found.' };
  }
}

/**
 * Inserts or updates a retirement plan.
 * Validates payload via HouseholdSchema.
 * Enforces BOLA defense by setting user_id on insert and verifying id + user_id on update.
 */
export async function savePlan(plan: Household): Promise<{ success: boolean; data?: Household; error?: string }> {
  const supabase = await createClient();
  const { user, error: authError } = await verifyPremiumUser(supabase);
  
  if (authError || !user) {
    return { success: false, error: authError || 'Unauthorized' };
  }

  const parsedResult = HouseholdSchema.safeParse(plan);
  if (!parsedResult.success) {
    console.error('[SERVER ACTION savePlan VALIDATION ERROR]:', parsedResult.error.format());
    return { success: false, error: 'Invalid retirement plan data.' };
  }

  const planData = parsedResult.data;
  
  // Construct payload matching quoted camelCase columns in public.retirement_plans
  const payload = {
    name: planData.name,
    taxJurisdiction: planData.taxJurisdiction,
    stateProvince: planData.stateProvince,
    birthYear: planData.birthYear,
    retirementAge: planData.retirementAge,
    spouseBirthYear: planData.spouseBirthYear,
    spouseRetirementAge: planData.spouseRetirementAge,
    includeSpouse: planData.includeSpouse,
    horizonMode: planData.horizonMode,
    accounts: planData.accounts ?? [],
    spending: planData.spending ?? undefined,
    pensions: planData.pensions ?? [],
    lifeEvents: planData.lifeEvents ?? [],
    simulationConfig: planData.simulationConfig ?? undefined,
    user_id: user.id,
  };

  try {
    if (planData.id) {
      // UPDATE existing plan with strict BOLA filtering
      const { data: updatedData, error: updateError } = await supabase
        .from('retirement_plans')
        .update(payload)
        .eq('id', planData.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError || !updatedData) {
        console.error('[SERVER ACTION savePlan UPDATE ERROR]:', updateError);
        return { success: false, error: 'Failed to update retirement plan. Unauthorized or plan not found.' };
      }

      try {
        revalidatePath('/planner', 'layout');
        revalidatePath('/dashboard', 'layout');
      } catch {
        // Ignore static generation context unmocked warnings during unit testing
      }

      return { success: true, data: updatedData as Household };
    } else {
      // INSERT new plan
      const { data: insertedData, error: insertError } = await supabase
        .from('retirement_plans')
        .insert([payload])
        .select()
        .single();

      if (insertError || !insertedData) {
        console.error('[SERVER ACTION savePlan INSERT ERROR]:', insertError);
        return { success: false, error: 'Failed to create retirement plan.' };
      }

      try {
        revalidatePath('/planner', 'layout');
        revalidatePath('/dashboard', 'layout');
      } catch {
        // Ignore static generation context unmocked warnings during unit testing
      }

      return { success: true, data: insertedData as Household };
    }
  } catch (err: unknown) {
    console.error('[SERVER ACTION savePlan FAILURE]:', err instanceof Error ? err.message : err);
    return { 
      success: false, 
      error: 'Uh oh, the system tripped up! Don\'t worry, your data is safe. Let\'s try that again.' 
    };
  }
}
```

---

### B. Recommended Implementation for `__tests__/planner/retirementActions.spec.ts`

```typescript
import { getPlans, getPlan, savePlan } from '@/app/actions/retirementActions';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { Household } from '@/lib/planner/types';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

describe('Retirement Server Actions (BOLA & Premium Defenses)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper to set up Supabase client mock with conditional multi-table behavior.
   */
  const setupMockSupabase = (
    user: { id: string } | null = { id: 'user-premium-123' },
    tier: 'standard' | 'premium' | null = 'premium',
    planResult: any = { data: null, error: null },
    profileError: any = null
  ) => {
    const chainable: any = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(() => Promise.resolve(planResult)),
      then: function (resolve: any, reject: any) {
        if (planResult && planResult.error && planResult.error.forceReject) {
          return Promise.reject(planResult.error).catch(reject);
        }
        return Promise.resolve(planResult).then(resolve);
      },
    };

    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue(
          user ? { data: { user }, error: null } : { data: { user: null }, error: new Error('Auth error') }
        ),
      },
      from: jest.fn().mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: tier ? { tier } : null,
                  error: profileError,
                }),
              }),
            }),
          };
        }
        return chainable;
      }),
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    return { mockSupabase, chainable };
  };

  const validHousehold: Household = {
    name: 'Smith Family Plan',
    taxJurisdiction: 'US',
    stateProvince: 'CA',
    birthYear: 1980,
    retirementAge: 65,
    includeSpouse: false,
    horizonMode: 'fixed_years',
  };

  describe('Authentication & Premium Tier Defenses', () => {
    it('should return Unauthorized if no user session exists', async () => {
      setupMockSupabase(null);

      const resPlans = await getPlans();
      expect(resPlans.success).toBe(false);
      expect(resPlans.error).toBe('Unauthorized');

      const resPlan = await getPlan('plan-123');
      expect(resPlan.success).toBe(false);
      expect(resPlan.error).toBe('Unauthorized');

      const resSave = await savePlan(validHousehold);
      expect(resSave.success).toBe(false);
      expect(resSave.error).toBe('Unauthorized');
    });

    it('should return Premium tier required if user is on standard tier', async () => {
      setupMockSupabase({ id: 'user-std-123' }, 'standard');

      const resPlans = await getPlans();
      expect(resPlans.success).toBe(false);
      expect(resPlans.error).toBe('Premium tier required');

      const resPlan = await getPlan('plan-123');
      expect(resPlan.success).toBe(false);
      expect(resPlan.error).toBe('Premium tier required');

      const resSave = await savePlan(validHousehold);
      expect(resSave.success).toBe(false);
      expect(resSave.error).toBe('Premium tier required');
    });

    it('should handle profile database errors gracefully during tier verification', async () => {
      setupMockSupabase({ id: 'user-123' }, null, {}, new Error('Profile DB error'));

      const resPlans = await getPlans();
      expect(resPlans.success).toBe(false);
      expect(resPlans.error).toBe('Service temporarily unavailable');
    });
  });

  describe('getPlans() - BOLA Defenses', () => {
    it('should fetch retirement plans successfully for a premium user with proper BOLA user_id filtering', async () => {
      const mockData = [validHousehold];
      const { chainable, mockSupabase } = setupMockSupabase({ id: 'user-premium-123' }, 'premium', { data: mockData, error: null });

      const res = await getPlans();
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockData);
      expect(mockSupabase.from).toHaveBeenCalledWith('retirement_plans');
      expect(chainable.select).toHaveBeenCalledWith('*');
      expect(chainable.eq).toHaveBeenCalledWith('user_id', 'user-premium-123');
    });

    it('should return error if fetching plans fails', async () => {
      setupMockSupabase({ id: 'user-premium-123' }, 'premium', { data: null, error: new Error('DB Error') });

      const res = await getPlans();
      expect(res.success).toBe(false);
      expect(res.error).toBe('Failed to fetch retirement plans.');
    });
  });

  describe('getPlan(id) - BOLA Defenses', () => {
    it('should fetch a specific retirement plan successfully with BOLA id and user_id filtering', async () => {
      const { chainable, mockSupabase } = setupMockSupabase({ id: 'user-premium-123' }, 'premium', { data: validHousehold, error: null });

      const res = await getPlan('plan-123');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(validHousehold);
      expect(mockSupabase.from).toHaveBeenCalledWith('retirement_plans');
      expect(chainable.select).toHaveBeenCalledWith('*');
      expect(chainable.eq).toHaveBeenCalledWith('id', 'plan-123');
      expect(chainable.eq).toHaveBeenCalledWith('user_id', 'user-premium-123');
    });

    it('should return error if plan ID is missing', async () => {
      setupMockSupabase({ id: 'user-premium-123' }, 'premium');

      const res = await getPlan('');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Plan ID is required.');
    });

    it('should return error if plan is not found or belongs to another user (BOLA protection)', async () => {
      setupMockSupabase({ id: 'user-premium-123' }, 'premium', { data: null, error: null });

      const res = await getPlan('plan-other-user');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Retirement plan not found or unauthorized.');
    });
  });

  describe('savePlan(plan) - BOLA Defenses & Zod Validation', () => {
    it('should return validation error if Household data is invalid', async () => {
      setupMockSupabase({ id: 'user-premium-123' }, 'premium');

      const invalidHousehold = { ...validHousehold, name: '' }; // name min(1) violated
      const res = await savePlan(invalidHousehold as Household);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid retirement plan data.');
    });

    it('should insert a new retirement plan successfully and call revalidatePath', async () => {
      const insertedPlan = { ...validHousehold, id: 'new-plan-123', user_id: 'user-premium-123' };
      const { chainable, mockSupabase } = setupMockSupabase({ id: 'user-premium-123' }, 'premium', { data: insertedPlan, error: null });

      const res = await savePlan(validHousehold);
      expect(res.success).toBe(true);
      expect(res.data).toEqual(insertedPlan);
      expect(mockSupabase.from).toHaveBeenCalledWith('retirement_plans');
      expect(chainable.insert).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith('/planner', 'layout');
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard', 'layout');
    });

    it('should update an existing retirement plan successfully with BOLA id and user_id filtering and call revalidatePath', planTest => {
      const existingPlan: Household = { ...validHousehold, id: 'existing-plan-123' };
      const { chainable, mockSupabase } = setupMockSupabase({ id: 'user-premium-123' }, 'premium', { data: existingPlan, error: null });

      savePlan(existingPlan).then(res => {
        expect(res.success).toBe(true);
        expect(res.data).toEqual(existingPlan);
        expect(mockSupabase.from).toHaveBeenCalledWith('retirement_plans');
        expect(chainable.update).toHaveBeenCalled();
        expect(chainable.eq).toHaveBeenCalledWith('id', 'existing-plan-123');
        expect(chainable.eq).toHaveBeenCalledWith('user_id', 'user-premium-123');
        expect(revalidatePath).toHaveBeenCalledWith('/planner', 'layout');
        expect(revalidatePath).toHaveBeenCalledWith('/dashboard', 'layout');
        planTest();
      });
    });

    it('should fail to update if plan belongs to another user or does not exist (BOLA protection)', async () => {
      const existingPlan: Household = { ...validHousehold, id: 'existing-plan-123' };
      setupMockSupabase({ id: 'user-premium-123' }, 'premium', { data: null, error: new Error('Not found') });

      const res = await savePlan(existingPlan);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Failed to update retirement plan. Unauthorized or plan not found.');
    });

    it('should catch unhandled exceptions and return empathetic fallback error', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockRejectedValue(new Error('Fatal Connection Error')),
        },
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const res = await savePlan(validHousehold);
      expect(res.success).toBe(false);
      expect(res.error).toContain('system tripped up');
    });
  });
});
```

---

## 5. Verification Method

To independently verify the functionality and correctness of the recommended implementations once applied by the Implementer agent:

1. **File Inspection**:
   - Verify that `src/app/actions/retirementActions.ts` and `__tests__/planner/retirementActions.spec.ts` exist with the exact code provided above.

2. **Run Unit Tests**:
   - Execute Jest against the newly created test specification:
     ```bash
     npm test __tests__/planner/retirementActions.spec.ts
     ```
     (Alternatively, use `npx jest __tests__/planner/retirementActions.spec.ts`).
   - Ensure all test suites pass with 100% success rate.

3. **Verify Build & Type Safety**:
   - Execute the Next.js TypeScript build check:
     ```bash
     npm run build
     ```
   - Ensure no TypeScript compilation errors or Next.js Server Action packaging errors occur.

4. **Invalidation Conditions**:
   - The verification holds true unless the underlying database schema for `public.retirement_plans` is altered (e.g. converting camelCase column names to snake_case) or if `HouseholdSchema` in `src/lib/planner/types.ts` is modified in a backward-incompatible manner.
