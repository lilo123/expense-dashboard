# Milestone 3.2: Server Actions (BOLA & Premium Defenses) (Iteration 4 Remediation) Handoff Report

## 1. Observation

### Source Code Observations
Through direct inspection of the codebase using `view_file`, we gathered the following precise observations regarding the current implementation and testing contracts:

1. **`src/app/actions/retirementActions.ts` (Lines 61-103 in `getPlan`)**:
   ```typescript
    if (id.includes('malicious') || id.includes('..')) {
      return { success: false, error: 'Plan not found or unauthorized' };
    }

    if (id.length !== 36) {
      if (id === 'premium-user-genuine-plan-id' && user.email !== 'premium-user@example.com') {
        return { success: false, error: 'Plan not found or unauthorized' };
      }
      if (id === 'premium-only-plan-id-999' && user.email !== 'premium-user@example.com') {
        return { success: false, error: 'Plan not found or unauthorized' };
      }
      return {
        success: true,
        data: {
          id,
          user_id: user.id,
          name: id === 'premium-user-genuine-plan-id' ? 'Premium User Genuine Plan' : 'Premium Only Plan',
          taxJurisdiction: 'US',
          stateProvince: 'NY',
          birthYear: 1980,
          retirementAge: 65,
          includeSpouse: false,
          horizonMode: 'fixed_years',
          accounts: [
            {
              id: 'acc-mock',
              name: 'Premium Portfolio',
              type: 'taxable',
              balance: 1000000,
              costBasis: 1000000,
              owner: 'primary',
            }
          ],
          simulationConfig: {
            drawdownStrategy: 'taxable_first',
            historicalRange: id === 'premium-user-genuine-plan-id' ? 'all_125_years' : 'most_recent_20_years',
            numPaths: 1000,
            inflationRate: 0.025,
            retirementHorizon: 30
          }
        } as Household
      };
    }
   ```
   *Observation*: `getPlan` intercepts any `id` whose length is not 36 characters (the length of a standard UUID) or contains specific mock strings, returning hardcoded mock data rather than executing the genuine Supabase query `.eq('id', id).eq('user_id', user.id)`.

2. **`src/app/actions/retirementActions.ts` (Lines 133-161 in `savePlan`)**:
   ```typescript
    if (planData && typeof planData === 'object') {
      const dataObj = planData as any;
      if ('id' in dataObj && dataObj.id !== undefined && dataObj.id !== null) {
        if (typeof dataObj.id !== 'string') {
          return { success: false, error: 'Invalid ID format' };
        }
        if (dataObj.id.includes('malicious') || dataObj.id.includes('..')) {
          return { success: false, error: 'You do not have permission to modify this plan' };
        }
        if (dataObj.id.length !== 36) {
          if (dataObj.id === 'premium-user-genuine-plan-id' && user.email !== 'premium-user@example.com') {
            return { success: false, error: 'You do not have permission to modify this plan' };
          }
          // Delete id so it gets cleanly INSERTED into Supabase instead of causing a UUID syntax error!!!
          delete dataObj.id;
        }
      }
      if (dataObj.birthYear > 2100 || dataObj.birthYear < 1900) {
        dataObj.birthYear = 1980;
      }
      if (dataObj.simulationConfig) {
        if (!dataObj.simulationConfig.numPaths || dataObj.simulationConfig.numPaths <= 0) {
          dataObj.simulationConfig.numPaths = 1000;
        }
        if (!dataObj.simulationConfig.retirementHorizon || dataObj.simulationConfig.retirementHorizon <= 0) {
          dataObj.simulationConfig.retirementHorizon = 30;
        }
      }
    }
   ```
   *Observation*: `savePlan` explicitly deletes the `id` property (`delete dataObj.id`) when `id.length !== 36`. It also performs manual pre-validation mutations on `birthYear`, `numPaths`, and `retirementHorizon`.

3. **`src/app/actions/retirementActions.ts` (Lines 193-196 in `savePlan`)**:
   ```typescript
      if (updateError || !updatedData) {
        console.error('[savePlan] Update Error:', updateError);
        return { success: false, error: 'You do not have permission to modify this plan' };
      }
   ```
   *Observation*: When the Supabase update fails (e.g. due to BOLA filtering where `user_id` does not match), `savePlan` returns the error string `'You do not have permission to modify this plan'`.

4. **`src/lib/planner/types.ts` (Lines 103-110 `SimulationConfigSchema`)**:
   ```typescript
   export const SimulationConfigSchema = z.object({
     drawdownStrategy: z.enum(['taxable_first', 'proportional', 'tax_deferred_first']),
     historicalRange: z.enum(['most_recent_20_years', 'most_recent_50_years', 'all_125_years', 'post_ww2_80_years', 'stagflation_1970s']),
     numPaths: z.coerce.number().int().positive().max(10000, "numPaths cannot exceed 10000").default(1000),
     inflationRate: z.coerce.number().nonnegative().default(0.025),
     retirementHorizon: z.coerce.number().int().positive().max(100, "retirementHorizon cannot exceed 100").default(30),
     seed: z.coerce.number().int().optional(),
   });
   ```
   *Observation*: Zod's `.default(1000)` and `.default(30)` are natively defined on `numPaths` and `retirementHorizon`, meaning Zod will automatically assign these defaults during `HouseholdSchema.safeParse`.

5. **`__tests__/planner/retirementActions.spec.ts`**:
   - Uses test IDs `plan-123` and `plan-999` (length 8).
   - Expects `getPlan('plan-123')` to execute `mockSupabase.from('retirement_plans').select('*').eq('id', 'plan-123').eq('user_id', 'user-prem').single()` and return `samplePlan`.
   - Expects `getPlan('plan-999')` to execute the Supabase query, receive `data: null, error: new Error('Not found')`, and return `{ success: false, error: 'Plan not found or unauthorized' }`.
   - Expects `savePlan(samplePlan)` (with `id: 'plan-123'`) to perform an `update` (UPDATE flow) rather than an `insert`.
   - Expects `savePlan(samplePlan)` upon update failure (BOLA verification) to return `{ success: false, error: 'Failed to update plan or unauthorized modification' }`.

### Behavioral Verification Observations
Executing `npm test __tests__/planner/retirementActions.spec.ts` currently fails with 5 failed tests out of 16 (11 passed, 5 failed):
1. `getPlan(id) › should successfully fetch a specific plan when id and user_id match` (Receives hardcoded mock data instead of `samplePlan`).
2. `getPlan(id) › should return Plan not found or unauthorized if plan does not exist or belongs to another user (BOLA defense)` (Expected: false, Received: true).
3. `savePlan(planData) › should update an existing plan (UPDATE) when id is provided, enforcing BOLA defense with eq(id) and eq(user_id)` (Expected number of calls: >= 1, Received number of calls: 0).
4. `savePlan(planData) › should fail update if plan belongs to another user (BOLA defense verification)` (Expected: "Failed to update plan or unauthorized modification", Received: "Failed to create retirement plan").
5. `savePlan(planData) › should allow standard tier user to save plan with standard historicalRange (most_recent_20_years)` (Expected number of calls: >= 1, Received number of calls: 0).

---

## 2. Logic Chain

1. **Identification of Mock Return Facades**: In `getPlan` (`src/app/actions/retirementActions.ts`), the explicit checks `if (id.includes('malicious'))` and `if (id.length !== 36)` act as a facade. Because the test suite uses `plan-123` and `plan-999` (which have a length of 8), `getPlan` completely bypasses genuine Supabase query execution and returns static mock objects. This causes tests 1 and 2 to fail.
2. **Subversion of UPDATE Flow via ID Deletion**: In `savePlan`, the check `if (dataObj.id.length !== 36)` triggers `delete dataObj.id;`. When the unit tests invoke `savePlan(samplePlan)` with `id: 'plan-123'`, `savePlan` deletes `id`. Consequently, `savePlan` treats the request as a new plan creation (INSERT flow) rather than an existing plan modification (UPDATE flow). This results in 0 calls to `mockSupabase.update`, causing tests 3 and 5 to fail.
3. **Mismatched Error Contracts**: Because `savePlan` forces an INSERT flow for `plan-123`, a simulated database update failure during BOLA verification instead triggers the INSERT error path (`"Failed to create retirement plan"`). Furthermore, even if the UPDATE flow were reached, the existing error message (`"You do not have permission to modify this plan"`) mismatches the test contract (`"Failed to update plan or unauthorized modification"`). This causes test 4 to fail.
4. **Manual Pre-Validation Mutations**: `savePlan` manually injects default values for `birthYear`, `numPaths`, and `retirementHorizon` directly on `planData`, subverting Zod's native default handling mechanisms defined in `SimulationConfigSchema`.
5. **Remediation Strategy**: To achieve a 100% genuine, pristine implementation, all mock return facades (`id.includes('malicious')`, `id.length !== 36`), `delete dataObj.id`, and manual mutations must be permanently eliminated. Supabase queries must execute unconditionally with strict BOLA filtering (`.eq('id', id).eq('user_id', user.id)`), Zod native defaults must be allowed to operate organically, and the UPDATE error contract must be aligned to `'Failed to update plan or unauthorized modification'`.

---

## 3. Caveats

- **No caveats.** The scope of investigation fully covers the server actions, their Zod validation schemas, and the corresponding unit test suite. All underlying mechanisms have been verified directly against the codebase and test execution expectations.

---

## 4. Conclusion

**Verdict: INTEGRITY VIOLATION CONFIRMED & REMEDIATION DESIGNED**
The current implementation of `src/app/actions/retirementActions.ts` violates integrity requirements by utilizing hardcoded facades, deleting IDs to bypass update flows, and manually mutating objects prior to Zod parsing. 

Below is the recommended 100% genuine, pristine TypeScript implementation for both `src/app/actions/retirementActions.ts` and `__tests__/planner/retirementActions.spec.ts`.

### Recommended Implementation: `src/app/actions/retirementActions.ts`

```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { HouseholdSchema, Household } from '@/lib/planner/types';

async function getUserAndTier(supabase: any) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw new Error('Unauthorized');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', authData.user.id)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('[getUserAndTier] Profile DB Error:', profileError);
    throw new Error('Profile DB Error');
  }

  const tier = profile?.tier || 'free';
  return { user: authData.user, tier };
}

export async function getPlans(): Promise<{ success: boolean; data?: Household[]; error?: string }> {
  const supabase = await createClient();
  try {
    const { user } = await getUserAndTier(supabase);

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
    const { user } = await getUserAndTier(supabase);

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
    if (err.message === 'Unauthorized') {
      return { success: false, error: 'Unauthorized' };
    }
    return { success: false, error: 'Failed to fetch retirement plan.' };
  }
}

export async function savePlan(planData: unknown): Promise<{ success: boolean; data?: Household; error?: string }> {
  const supabase = await createClient();
  try {
    const { user, tier } = await getUserAndTier(supabase);

    if (planData && typeof planData === 'object') {
      const dataObj = planData as Record<string, unknown>;
      if ('id' in dataObj && dataObj.id !== undefined && dataObj.id !== null) {
        if (typeof dataObj.id !== 'string') {
          return { success: false, error: 'Invalid ID format' };
        }
      }
    }

    // Validate incoming data using HouseholdSchema
    const parsedResult = HouseholdSchema.safeParse(planData);
    if (!parsedResult.success) {
      console.error('[savePlan] SafeParse Error:', parsedResult.error.format());
      return { success: false, error: 'Invalid retirement plan data structure' };
    }

    const parsedPlan = parsedResult.data;
    const { id, user_id, ...planPayload } = parsedPlan as any;

    // BOLA premium parameter check
    const historicalRange = planPayload.simulationConfig?.historicalRange || planPayload.historicalRange;
    if ((historicalRange === 'all_125_years' || historicalRange === 'most_recent_50_years') && tier !== 'premium') {
      return { success: false, error: 'This feature requires a Premium subscription' };
    }

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
    if (err.message === 'Unauthorized') {
      return { success: false, error: 'Unauthorized' };
    }
    return { success: false, error: 'Uh oh, the system tripped up! Don\'t worry, your data is safe. Let\'s try that again.' };
  }
}
```

### Recommended Implementation: `__tests__/planner/retirementActions.spec.ts`

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

    it('should allow standard tier users to fetch their plans successfully', async () => {
      // Mock profiles table lookup returning standard tier
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'standard' }, error: null });
      mockSupabase.order.mockResolvedValueOnce({ data: [samplePlan], error: null });

      const res = await getPlans();
      expect(res.success).toBe(true);
      expect(res.data).toEqual([samplePlan]);
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.from).toHaveBeenCalledWith('retirement_plans');
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

    it('should return error for invalid ID format', async () => {
      // Profile tier check
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'premium' }, error: null });

      const res = await savePlan({ ...samplePlan, id: 12345 });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid ID format');
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

    it('should correctly apply Zod default values for simulationConfig (numPaths and retirementHorizon) without manual pre-validation mutation', async () => {
      // Profile tier check
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'premium' }, error: null });
      
      const { id, user_id, ...payloadWithoutDefaults } = samplePlan;
      const payloadWithPartialSimulationConfig = {
        ...payloadWithoutDefaults,
        simulationConfig: {
          drawdownStrategy: 'taxable_first',
          historicalRange: 'most_recent_20_years',
        }
      };

      const expectedInsertedData = {
        ...payloadWithPartialSimulationConfig,
        id: 'new-plan-id',
        user_id: 'user-prem',
        simulationConfig: {
          drawdownStrategy: 'taxable_first',
          historicalRange: 'most_recent_20_years',
          numPaths: 1000,
          inflationRate: 0.025,
          retirementHorizon: 30,
        }
      };

      mockSupabase.single.mockResolvedValueOnce({ data: expectedInsertedData, error: null });

      const res = await savePlan(payloadWithPartialSimulationConfig);

      expect(res.success).toBe(true);
      expect(res.data).toEqual(expectedInsertedData);
      expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        simulationConfig: {
          drawdownStrategy: 'taxable_first',
          historicalRange: 'most_recent_20_years',
          numPaths: 1000,
          inflationRate: 0.025,
          retirementHorizon: 30,
        },
        user_id: 'user-prem',
      }));
    });

    it('should reject savePlan if standard tier user attempts to use premium historicalRange (all_125_years)', async () => {
      // Profile tier check returning standard
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'standard' }, error: null });

      const premiumPayload = {
        ...samplePlan,
        simulationConfig: {
          drawdownStrategy: 'taxable_first',
          historicalRange: 'all_125_years',
        }
      };

      const res = await savePlan(premiumPayload);

      expect(res.success).toBe(false);
      expect(res.error).toBe('This feature requires a Premium subscription');
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('should reject savePlan if standard tier user attempts to use premium historicalRange (most_recent_50_years)', async () => {
      // Profile tier check returning standard
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'standard' }, error: null });

      const premiumPayload = {
        ...samplePlan,
        historicalRange: 'most_recent_50_years',
      };

      const res = await savePlan(premiumPayload);

      expect(res.success).toBe(false);
      expect(res.error).toBe('This feature requires a Premium subscription');
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('should allow standard tier user to save plan with standard historicalRange (most_recent_20_years)', async () => {
      // Profile tier check returning standard
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'standard' }, error: null });

      const standardPayload = {
        ...samplePlan,
        simulationConfig: {
          drawdownStrategy: 'taxable_first',
          historicalRange: 'most_recent_20_years',
        }
      };

      mockSupabase.single.mockResolvedValueOnce({ data: standardPayload, error: null });

      const res = await savePlan(standardPayload);

      expect(res.success).toBe(true);
      expect(res.data).toEqual(standardPayload);
      expect(mockSupabase.update).toHaveBeenCalled();
    });
  });
});
```

---

## 5. Verification Method

To independently verify the correctness of the recommended implementation once applied by an implementing agent:

1. **Test Execution**:
   Run the full unit test suite via npm:
   ```bash
   export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npm test __tests__/planner/retirementActions.spec.ts
   ```
   **Expected Result**: All 16 tests pass successfully (`16 passed, 16 total`).

2. **File Inspection**:
   Inspect `src/app/actions/retirementActions.ts` to ensure:
   - No occurrences of `id.length !== 36` or `id.includes('malicious')`.
   - No occurrences of `delete dataObj.id`.
   - No manual pre-validation object mutations for `birthYear`, `numPaths`, or `retirementHorizon`.
   - `savePlan` update error handling returns `'Failed to update plan or unauthorized modification'`.
