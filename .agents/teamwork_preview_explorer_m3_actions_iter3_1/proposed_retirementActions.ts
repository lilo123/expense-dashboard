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
      const dataObj = planData as any;
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
