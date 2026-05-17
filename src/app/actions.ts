'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { Expense } from '@/types/database'

export async function addExpenseAction(data: {
  item: string
  amount: number
  original_amount: number
  original_currency: string
  currency: string
  category_id: string
  date: string
  is_recurring?: boolean
  recurring_expense_id?: string | null
}): Promise<{ success: boolean; data?: Expense; error?: string }> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  
  if (userError || !userData?.user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { data: newExpense, error } = await supabase
    .from('expenses')
    .insert([
      {
        user_id: userData.user.id,
        item: data.item,
        amount: data.amount,
        original_amount: data.original_amount,
        original_currency: data.original_currency,
        currency: data.currency,
        category_id: data.category_id,
        date: data.date,
        is_recurring: data.is_recurring || false,
        recurring_expense_id: data.recurring_expense_id || null
      }
    ])
    .select('*, categories(name)')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true, data: newExpense }
}

export async function deleteExpenseAction(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase.from('expenses').delete().eq('id', id)
  
  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function updateExpenseAction(
  id: string,
  updates: Partial<{ 
    item: string; 
    amount: number; 
    original_amount: number;
    original_currency: string;
    currency: string;
    category_id: string; 
    date: string; 
    is_recurring: boolean;
    recurring_expense_id: string | null;
  }>
): Promise<{ success: boolean; data?: Expense; error?: string }> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', id)
    .select('*, categories(name)')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true, data }
}

export async function addCategoryAction(name: string): Promise<{ success: boolean; data?: { id: string, name: string }; error?: string }> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  
  if (userError || !userData?.user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('categories')
    .insert([{ user_id: userData.user.id, name }])
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'A category with this name already exists. Please choose a different name.' }
    }
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true, data }
}

export async function updateCategoryAction(id: string, name: string): Promise<{ success: boolean; data?: { id: string, name: string }; error?: string }> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('categories')
    .update({ name })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true, data }
}

export async function deleteCategoryAction(id: string, fallbackCategoryId?: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return { success: false, error: 'Unauthorized' }
  }

  if (fallbackCategoryId) {
    const { error: updateError } = await supabase
      .from('expenses')
      .update({ category_id: fallbackCategoryId })
      .eq('category_id', id)

    if (updateError) {
      return { success: false, error: updateError.message }
    }
  }

  const { error } = await supabase.from('categories').delete().eq('id', id)
  
  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function bulkDeleteAction(ids: string[]): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase.from('expenses').delete().in('id', ids)
  
  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function bulkUpdateAction(
  ids: string[],
  updates: Partial<{ 
    item: string; 
    amount: number; 
    original_amount: number;
    original_currency: string;
    currency: string;
    category_id: string; 
    date: string; 
    is_recurring?: boolean;
    recurring_expense_id?: string | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase.from('expenses').update(updates).in('id', ids)
  
  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function requestInviteAction(email: string, message: string): Promise<{ success: boolean; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { success: false, error: 'Server configuration error.' };
  }

  // Use service role client to bypass RLS securely on backend
  const supabase = createServiceClient(supabaseUrl, supabaseServiceKey);
  
  const { error } = await supabase
    .from('invite_requests')
    .insert([{ email, message }]);

  if (error) {
    return { success: false, error: 'Failed to log invite request.' };
  }

  return { success: true };
}

export async function getMonthlyAggregatesAction(startDate: string, endDate: string): Promise<{ success: boolean; data?: unknown[]; error?: string }> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  // Convert 'YYYY-MM' to local DATE boundaries
  const startLocalDate = `${startDate}-01`;
  
  const [year, month] = endDate.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const endLocalDate = `${endDate}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase.rpc('get_monthly_aggregates', {
    p_user_id: userData.user.id,
    p_start_date: startLocalDate,
    p_end_date: endLocalDate
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

