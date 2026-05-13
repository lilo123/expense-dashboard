'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function addRecurringExpenseAction(data: {
  item: string;
  amount: number;
  currency: string;
  category_id: string;
  frequency: 'weekly' | 'monthly';
  start_date: string;
  day_of_week?: number | null;
  day_of_month?: number | null;
  is_last_day_of_month?: boolean;
  end_date?: string | null;
  max_occurrences?: number | null;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  const { data: newFlow, error } = await supabase
    .from('recurring_expenses')
    .insert([
      {
        user_id: userData.user.id,
        item: data.item,
        amount: data.amount,
        currency: data.currency,
        category_id: data.category_id,
        frequency: data.frequency,
        start_date: data.start_date,
        day_of_week: data.day_of_week,
        day_of_month: data.day_of_month,
        is_last_day_of_month: data.is_last_day_of_month || false,
        end_date: data.end_date || null,
        max_occurrences: data.max_occurrences || null
      }
    ])
    .select('*')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  return { success: true, data: newFlow };
}

export async function updateRecurringExpenseAction(
  id: string,
  data: Partial<{
    item: string;
    amount: number;
    currency: string;
    category_id: string;
    frequency: 'weekly' | 'monthly';
    start_date: string;
    day_of_week?: number | null;
    day_of_month?: number | null;
    is_last_day_of_month?: boolean;
    end_date?: string | null;
    max_occurrences?: number | null;
  }>
): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  const { data: updatedFlow, error } = await supabase
    .from('recurring_expenses')
    .update(data)
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .select('*')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  return { success: true, data: updatedFlow };
}

export async function getRecurringExpensesAction(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  const { data, error } = await supabase
    .from('recurring_expenses')
    .select('*, categories(name)')
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data || [] };
}

export async function deleteRecurringExpenseAction(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('recurring_expenses')
    .delete()
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  return { success: true };
}
