import { createClient } from '@/utils/supabase/server';
import { Expense } from '@/types/database';

export async function getHistoricalExpenses(): Promise<Expense[]> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching expenses:', error);
    throw new Error('Failed to fetch expenses');
  }

  return data as Expense[];
}

export async function saveExpense(amount: number, category: string, user_id: string): Promise<Expense> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('expenses')
    .insert([
      {
        user_id,
        amount,
        category,
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error saving expense:', error);
    throw new Error('Failed to save expense');
  }

  return data as Expense;
}
