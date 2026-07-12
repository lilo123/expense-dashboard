# Milestone 3.2: Server Actions (BOLA & Premium Defenses) — Handoff Report

## 1. Observation
During our read-only investigation into the codebase to specify the exact TypeScript implementations for `src/app/actions/retirementActions.ts` and unit tests `__tests__/planner/retirementActions.spec.ts`, we directly observed the following architectural patterns and conventions:

- **Server Actions Architecture (`src/app/actions/budget.ts`, `src/app/actions/profile.ts`, `src/app/actions/deals.ts`)**:
  - All server action files begin with the `'use server';` pragma.
  - The Supabase client is initialized asynchronously via `createClient` from `@/utils/supabase/server`: `const supabase = await createClient();`.
  - Action functions return a structured, serializable object representing success or failure: `Promise<{ success: boolean; data?: T; error?: string; message?: string }>`.
  - Action functions wrap operations in a `try...catch` block, logging errors to the console (`console.error('[SERVER ACTION <actionName> FAILURE]:', err);`) and returning user-friendly error messages (e.g., `'Uh oh, the system tripped up! Don\'t worry, your data is safe. Let\'s try that again.'`).
  - Cache invalidation is performed using `revalidatePath` from `next/cache`.

- **Premium Tier Verification (`src/app/actions/deals.ts`, lines 7-27)**:
  - `deals.ts` implements a dedicated `requirePremiumUser(supabase)` helper function:
    ```typescript
    async function requirePremiumUser(supabase: any) {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) throw new Error('Unauthorized');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        console.error('[requirePremiumUser] Profile DB Error:', profileError);
        throw new Error('Service temporarily unavailable');
      }

      if (profile?.tier !== 'premium') {
        throw new Error('Premium tier required');
      }

      return authData.user;
    }
    ```

- **Household Schema & BOLA Defenses (`src/lib/planner/types.ts`)**:
  - `HouseholdSchema` is a Zod object defining the structure of a retirement plan, including camelCase properties such as `taxJurisdiction`, `stateProvince`, `birthYear`, `retirementAge`, `spouseBirthYear`, `spouseRetirementAge`, `includeSpouse`, `horizonMode`, `accounts`, `spending`, `pensions`, `lifeEvents`, and `simulationConfig`.
  - The database table `public.retirement_plans` uses quoted camelCase columns matching `Household` directly.
  - In existing actions like `deals.ts`, Zod schemas are used for input validation (`DealSchema.safeParse(data)`).
  - BOLA defenses in existing update/select operations enforce ownership by chaining `.eq('user_id', user.id)` alongside primary key filters `.eq('id', id)`.

- **Unit Testing Conventions (`__tests__/actions/budget.test.ts`, `__tests__/actions/profile_tier.test.ts`)**:
  - Jest is the test runner used for server action testing.
  - Modules `@/utils/supabase/server` and `next/cache` are mocked using `jest.mock(...)`.
  - A mock Supabase client object is created with chainable methods (`from`, `select`, `insert`, `update`, `delete`, `eq`, `single`, `order`) and injected via `(createClient as jest.Mock).mockResolvedValue(mockSupabase)`.

## 2. Logic Chain
1. **Consistency in Action Structure**: To ensure full compatibility with the Next.js app router and frontend state handling, `src/app/actions/retirementActions.ts` must start with `'use server';`, initialize Supabase via `await createClient()`, and return `{ success: boolean; data?: T; error?: string }`.
2. **Premium Tier Enforcement**: To protect premium retirement planner features, all three actions (`getPlans`, `getPlan`, `savePlan`) must invoke `requirePremiumUser(supabase)`. If a user is unauthenticated or on the standard tier, the action will catch the thrown error and return `{ success: false, error: 'Premium tier required' }` (or `'Unauthorized'`).
3. **Strict BOLA Protection**:
   - `getPlans()` must query `supabase.from('retirement_plans').select('*').eq('user_id', user.id)`.
   - `getPlan(id)` must query `supabase.from('retirement_plans').select('*').eq('id', id).eq('user_id', user.id).single()`.
   - `savePlan(planData)` must first validate `planData` using `HouseholdSchema.safeParse(planData)`. If an `id` is present, it must execute an update explicitly guarded by `.eq('id', id).eq('user_id', user.id)` to prevent unauthorized mutation of records belonging to other users. If no `id` is present, it inserts a new record with `user_id: user.id`.
4. **Comprehensive Test Coverage**: `__tests__/planner/retirementActions.spec.ts` must use Jest to mock `createClient` and verify:
   - Rejection of unauthenticated users.
   - Rejection of standard tier users (Premium Defense).
   - Successful fetching of all plans belonging to the authenticated user.
   - Successful fetching of a single plan by ID, and rejection if `id` or `user_id` does not match (BOLA Defense).
   - Successful creation (insert) and modification (update) of plans, including rejection of malformed payloads and rejection of unauthorized update attempts (BOLA Defense).

## 3. Caveats
- **Read-Only Scope**: As an Explorer agent, we have not directly written or executed these files in the `src/` directory. The recommended code is provided in this report for the implementer agent to place into the workspace.
- **Zod Schema Variations**: `HouseholdSchema` defines `id` and `user_id` as optional string fields. When inserting into Supabase, `id` will be auto-generated by the database (UUID primary key), and `user_id` is explicitly overridden in the server action using the authenticated user's ID to prevent client-side spoofing.

## 4. Conclusion
We recommend implementing `src/app/actions/retirementActions.ts` and `__tests__/planner/retirementActions.spec.ts` using the exact TypeScript code provided below. This implementation achieves robust BOLA defenses, strict premium tier gating, Zod payload validation, and adheres perfectly to project conventions.

### Recommended `src/app/actions/retirementActions.ts`
```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { HouseholdSchema, Household } from '@/lib/planner/types';

async function requirePremiumUser(supabase: any) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw new Error('Unauthorized');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', authData.user.id)
    .single();

  if (profileError) {
    console.error('[requirePremiumUser] Profile DB Error:', profileError);
    throw new Error('Service temporarily unavailable');
  }

  if (profile?.tier !== 'premium') {
    throw new Error('Premium tier required');
  }

  return authData.user;
}

export async function getPlans(): Promise<{ success: boolean; data?: Household[]; error?: string }> {
  const supabase = await createClient();
  try {
    const user = await requirePremiumUser(supabase);

    // BOLA defense: explicitly filter by user_id
    const { data, error } = await supabase
      .from('retirement_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getPlans] DB Error:', error);
      throw new Error('Failed to fetch retirement plans');
    }

    return { success: true, data: data as Household[] };
  } catch (err: any) {
    console.error('[SERVER ACTION getPlans FAILURE]:', err.message || err);
    if (err.message === 'Premium tier required') {
      return { success: false, error: 'Premium tier required' };
    }
    if (err.message === 'Unauthorized') {
      return { success: false, error: 'Unauthorized' };
    }
    return { success: false, error: 'Failed to fetch retirement plans.' };
  }
}

export async function getPlan(id: string): Promise<{ success: boolean; data?: Household; error?: string }> {
  const supabase = await createClient();
  try {
    if (!id) return { success: false, error: 'Invalid plan ID' };
    const user = await requirePremiumUser(supabase);

    // BOLA defense: explicit eq('id', id).eq('user_id', user.id)
    const { data, error } = await supabase
      .from('retirement_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      console.error('[getPlan] DB Error or Plan not found:', error);
      return { success: false, error: 'Plan not found or unauthorized' };
    }

    return { success: true, data: data as Household };
  } catch (err: any) {
    console.error('[SERVER ACTION getPlan FAILURE]:', err.message || err);
    if (err.message === 'Premium tier required') {
      return { success: false, error: 'Premium tier required' };
    }
    if (err.message === 'Unauthorized') {
      return { success: false, error: 'Unauthorized' };
    }
    return { success: false, error: 'Failed to fetch retirement plan.' };
  }
}

export async function savePlan(planData: unknown): Promise<{ success: boolean; data?: Household; error?: string }> {
  const supabase = await createClient();
  try {
    const user = await requirePremiumUser(supabase);

    // Validate incoming data using HouseholdSchema
    const parsedResult = HouseholdSchema.safeParse(planData);
    if (!parsedResult.success) {
      console.error('[savePlan] SafeParse Error:', parsedResult.error.format());
      return { success: false, error: 'Invalid retirement plan data structure' };
    }

    const parsedPlan = parsedResult.data;
    const { id, user_id, ...planPayload } = parsedPlan as any;

    if (id) {
      // UPDATE flow with strict BOLA defense: eq('id', id).eq('user_id', user.id)
      const { data: updatedData, error: updateError } = await supabase
        .from('retirement_plans')
        .update({
          ...planPayload,
          user_id: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError || !updatedData) {
        console.error('[savePlan] Update Error:', updateError);
        return { success: false, error: 'Failed to update plan or unauthorized modification' };
      }

      try {
        revalidatePath('/planner', 'layout');
        revalidatePath(`/planner/${id}`, 'page');
      } catch {
        // Ignore static generation context unmocked warnings during unit testing
      }

      return { success: true, data: updatedData as Household };
    } else {
      // INSERT flow
      const { data: insertedData, error: insertError } = await supabase
        .from('retirement_plans')
        .insert({
          ...planPayload,
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError || !insertedData) {
        console.error('[savePlan] Insert Error:', insertError);
        return { success: false, error: 'Failed to create retirement plan' };
      }

      try {
        revalidatePath('/planner', 'layout');
      } catch {
        // Ignore static generation context unmocked warnings during unit testing
      }

      return { success: true, data: insertedData as Household };
    }
  } catch (err: any) {
    console.error('[SERVER ACTION savePlan FAILURE]:', err.message || err);
    if (err.message === 'Premium tier required') {
      return { success: false, error: 'Premium tier required' };
    }
    if (err.message === 'Unauthorized') {
      return { success: false, error: 'Unauthorized' };
    }
    return { success: false, error: 'Uh oh, the system tripped up! Don\'t worry, your data is safe. Let\'s try that again.' };
  }
}
```

### Recommended `__tests__/planner/retirementActions.spec.ts`
```typescript
import { getPlans, getPlan, savePlan } from '@/app/actions/retirementActions';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

describe('Retirement Server Actions (BOLA & Premium Defenses)', () => {
  let mockSupabase: any;

  const samplePlan = {
    id: 'plan-123',
    user_id: 'user-prem',
    name: 'Retirement Strategy A',
    taxJurisdiction: 'US',
    stateProvince: 'CA',
    birthYear: 1980,
    retirementAge: 65,
    includeSpouse: false,
    horizonMode: 'fixed_years',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-prem' } }, error: null }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('Authentication & Premium Tier Defenses', () => {
    it('should return Unauthorized if no user session exists', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('No session') });

      const res = await getPlans();
      expect(res.success).toBe(false);
      expect(res.error).toBe('Unauthorized');
    });

    it('should return Premium tier required if user profile tier is standard', async () => {
      // Mock profiles table lookup returning standard tier
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'standard' }, error: null });

      const res = await getPlans();
      expect(res.success).toBe(false);
      expect(res.error).toBe('Premium tier required');
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    });

    it('should handle profile DB errors gracefully', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: new Error('DB error') });

      const res = await getPlans();
      expect(res.success).toBe(false);
      expect(res.error).toBe('Failed to fetch retirement plans.');
    });
  });

  describe('getPlans()', () => {
    it('should fetch plans successfully for a premium user, filtering by user_id', async () => {
      // First single() call is for profile tier check
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'premium' }, error: null });
      // Next call is select().eq().order() for retirement_plans
      mockSupabase.order.mockResolvedValueOnce({ data: [samplePlan], error: null });

      const res = await getPlans();
      expect(res.success).toBe(true);
      expect(res.data).toEqual([samplePlan]);
      expect(mockSupabase.from).toHaveBeenCalledWith('retirement_plans');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-prem');
    });
  });

  describe('getPlan(id)', () => {
    it('should return error for invalid/empty ID', async () => {
      const res = await getPlan('');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid plan ID');
    });

    it('should successfully fetch a specific plan when id and user_id match', async () => {
      // Profile tier check
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'premium' }, error: null });
      // Plan fetch single()
      mockSupabase.single.mockResolvedValueOnce({ data: samplePlan, error: null });

      const res = await getPlan('plan-123');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(samplePlan);
      expect(mockSupabase.from).toHaveBeenCalledWith('retirement_plans');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'plan-123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-prem');
    });

    it('should return Plan not found or unauthorized if plan does not exist or belongs to another user (BOLA defense)', async () => {
      // Profile tier check
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'premium' }, error: null });
      // Plan fetch single() returns error/no data
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: new Error('Not found') });

      const res = await getPlan('plan-999');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Plan not found or unauthorized');
    });
  });

  describe('savePlan(planData)', () => {
    it('should return error for invalid plan data failing HouseholdSchema validation', async () => {
      // Profile tier check
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'premium' }, error: null });

      const res = await savePlan({ invalidField: true });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid retirement plan data structure');
    });

    it('should create a new plan (INSERT) when no id is provided, setting user_id to authenticated user', async () => {
      // Profile tier check
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'premium' }, error: null });
      // Insert single() result
      const newPlan = { ...samplePlan, id: 'new-plan-id' };
      mockSupabase.single.mockResolvedValueOnce({ data: newPlan, error: null });

      const { id, user_id, ...validPayload } = samplePlan;
      const res = await savePlan(validPayload);

      expect(res.success).toBe(true);
      expect(res.data).toEqual(newPlan);
      expect(mockSupabase.from).toHaveBeenCalledWith('retirement_plans');
      expect(mockSupabase.insert).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith('/planner', 'layout');
    });

    it('should update an existing plan (UPDATE) when id is provided, enforcing BOLA defense with eq(id) and eq(user_id)', async () => {
      // Profile tier check
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'premium' }, error: null });
      // Update single() result
      mockSupabase.single.mockResolvedValueOnce({ data: samplePlan, error: null });

      const res = await savePlan(samplePlan);

      expect(res.success).toBe(true);
      expect(res.data).toEqual(samplePlan);
      expect(mockSupabase.from).toHaveBeenCalledWith('retirement_plans');
      expect(mockSupabase.update).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'plan-123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-prem');
      expect(revalidatePath).toHaveBeenCalledWith('/planner', 'layout');
      expect(revalidatePath).toHaveBeenCalledWith('/planner/plan-123', 'page');
    });

    it('should fail update if plan belongs to another user (BOLA defense verification)', async () => {
      // Profile tier check
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'premium' }, error: null });
      // Update single() returns null data / error
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: new Error('No rows updated') });

      const res = await savePlan(samplePlan);

      expect(res.success).toBe(false);
      expect(res.error).toBe('Failed to update plan or unauthorized modification');
    });
  });
});
```

## 5. Verification Method
To independently verify the recommendations once implemented:
1. **Static Analysis & Linting**: Run TypeScript compiler checks and ESLint to verify types and Zod schema adherence.
   ```bash
   npm run lint
   npx tsc --noEmit
   ```
2. **Unit Test Execution**: Run Jest against the newly created test specification to confirm that all BOLA and Premium defense expectations pass successfully.
   ```bash
   npm test __tests__/planner/retirementActions.spec.ts
   ```
3. **Invalidation Conditions**: If `HouseholdSchema` in `src/lib/planner/types.ts` is modified in the future (e.g., adding mandatory properties), `samplePlan` in the test file must be updated accordingly to prevent validation failures during `savePlan` testing.
