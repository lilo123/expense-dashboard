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

  describe('Authentication & Tier Defenses', () => {
    it('should return Unauthorized if no user session exists', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('No session') });

      const res = await getPlans();
      expect(res.success).toBe(false);
      expect(res.error).toBe('Unauthorized');
    });

    it('should allow standard tier users to access getPlans (basic planner features)', async () => {
      // Mock profiles table lookup returning standard tier
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'standard' }, error: null });
      mockSupabase.order.mockResolvedValueOnce({ data: [samplePlan], error: null });

      const res = await getPlans();
      expect(res.success).toBe(true);
      expect(res.data).toEqual([samplePlan]);
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

    it('should return error if a standard tier user attempts to save a plan with premium historicalRange (all_125_years)', async () => {
      // Mock profile tier check returning standard tier
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'standard' }, error: null });

      const premiumPlan = {
        ...samplePlan,
        simulationConfig: {
          drawdownStrategy: 'taxable_first',
          historicalRange: 'all_125_years',
        }
      };

      const res = await savePlan(premiumPlan);
      expect(res.success).toBe(false);
      expect(res.error).toBe('This feature requires a Premium subscription');
    });

    it('should return error if a standard tier user attempts to save a plan with premium historicalRange (most_recent_50_years)', async () => {
      // Mock profile tier check returning standard tier
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'standard' }, error: null });

      const premiumPlan = {
        ...samplePlan,
        simulationConfig: {
          drawdownStrategy: 'taxable_first',
          historicalRange: 'most_recent_50_years',
        }
      };

      const res = await savePlan(premiumPlan);
      expect(res.success).toBe(false);
      expect(res.error).toBe('This feature requires a Premium subscription');
    });

    it('should allow a premium tier user to save a plan with premium historicalRange (all_125_years)', async () => {
      // Mock profile tier check returning premium tier
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'premium' }, error: null });
      
      const premiumPlan = {
        ...samplePlan,
        simulationConfig: {
          drawdownStrategy: 'taxable_first',
          historicalRange: 'all_125_years',
          numPaths: 1000,
          inflationRate: 0.025,
          retirementHorizon: 30,
        }
      };
      mockSupabase.single.mockResolvedValueOnce({ data: premiumPlan, error: null });

      const res = await savePlan(premiumPlan);
      expect(res.success).toBe(true);
      expect(res.data).toEqual(premiumPlan);
    });

    it('should apply Zod default values for simulationConfig when optional fields are omitted', async () => {
      // Profile tier check
      mockSupabase.single.mockResolvedValueOnce({ data: { tier: 'premium' }, error: null });
      
      const planWithoutDefaults = {
        ...samplePlan,
        simulationConfig: {
          drawdownStrategy: 'taxable_first',
          historicalRange: 'most_recent_20_years',
          // numPaths, inflationRate, retirementHorizon omitted to test Zod defaults
        }
      };

      const expectedSavedPlan = {
        ...samplePlan,
        simulationConfig: {
          drawdownStrategy: 'taxable_first',
          historicalRange: 'most_recent_20_years',
          numPaths: 1000,
          inflationRate: 0.025,
          retirementHorizon: 30,
        }
      };

      mockSupabase.single.mockResolvedValueOnce({ data: expectedSavedPlan, error: null });

      const res = await savePlan(planWithoutDefaults);

      expect(res.success).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          simulationConfig: {
            drawdownStrategy: 'taxable_first',
            historicalRange: 'most_recent_20_years',
            numPaths: 1000,
            inflationRate: 0.025,
            retirementHorizon: 30,
          }
        })
      );
    });
  });
});
