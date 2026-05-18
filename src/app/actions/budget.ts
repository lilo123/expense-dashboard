'use server';

import { createClient } from '@/utils/supabase/server';
import { Budget } from '@/types/database';

export async function getMonthlyBudgets(month: string): Promise<{ success: boolean; data?: Budget[]; error?: string }> {
  const supabase = await createClient();
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return { success: false, error: 'Unauthorized' };

    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('month', month);

    if (error) throw error;
    return { success: true, data: data as Budget[] };
  } catch (err: any) {
    console.error('[SERVER ACTION getMonthlyBudgets FAILURE]:', err);
    return { success: false, error: 'Failed to load monthly budgets.' };
  }
}

export async function saveInitialBudgets(budgets: { category_id: string | null; limit_amount: number; currency: string; month: string }[]): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return { success: false, error: 'Unauthorized' };

    const userId = userData.user.id;
    if (budgets.length === 0) return { success: true };
    const targetMonth = budgets[0].month;

    // 1. Delete existing budgets for this month to guarantee a clean slate
    const { error: deleteError } = await supabase
      .from('budgets')
      .delete()
      .eq('user_id', userId)
      .eq('month', targetMonth);

    if (deleteError) throw deleteError;

    // 2. Insert new allocations
    const payload = budgets.map(b => ({
      user_id: userId,
      category_id: b.category_id,
      limit_amount: b.limit_amount,
      currency: b.currency,
      month: b.month
    }));

    const { error: insertError } = await supabase
      .from('budgets')
      .insert(payload);

    if (insertError) throw insertError;

    // 3. Update onboarding status to completed
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ onboarding_status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (profileError) throw profileError;

    return { success: true };
  } catch (err: any) {
    console.error('[SERVER ACTION saveInitialBudgets FAILURE]:', err);
    return { success: false, error: 'Failed to save budget setup.' };
  }
}
import { revalidatePath } from 'next/cache';

export async function saveBulkBudgets(
  sourceMonth: string,
  targetMonths: string[],
  allocations: { category_id: string | null; limit_amount: number; currency: string }[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return { success: false, error: 'Unauthorized' };

    // Call PostgreSQL RPC function to guarantee atomic ACID transaction
    const { error } = await supabase.rpc('save_bulk_budgets_rpc', {
      p_user_id: userData.user.id,
      p_target_months: targetMonths,
      p_allocations: allocations
    });

    if (error) {
      console.error('[RPC save_bulk_budgets_rpc ERROR]:', error);
      return { success: false, error: error.message || 'Failed to propagate budgets.' };
    }

    revalidatePath('/');
    revalidatePath('/budget');

    return { success: true };
  } catch (err: any) {
    console.error('[SERVER ACTION saveBulkBudgets FAILURE]:', err);
    return { success: false, error: 'Uh oh, the system tripped up! Don\'t worry, your data is safe. Let\'s try that again.' };
  }
}
