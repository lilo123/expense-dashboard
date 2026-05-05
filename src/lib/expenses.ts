import { createClient } from '@/utils/supabase/server';
import { Expense } from '@/types/database';

export async function getHistoricalExpenses(startDateUTC?: string, endDateUTC?: string): Promise<Expense[]> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  let query = supabase
    .from('expenses')
    .select('*, categories(name)')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (startDateUTC) {
    query = query.gte('date', startDateUTC);
  }
  if (endDateUTC) {
    query = query.lte('date', endDateUTC);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching expenses:', error);
    throw new Error('Failed to fetch expenses');
  }

  return data as Expense[];
}

export async function saveExpense(amount: number, category_id: string, item: string, user_id: string, dateUTC: string = new Date().toISOString()): Promise<Expense> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('expenses')
    .insert([
      {
        user_id,
        item,
        amount,
        category_id,
        date: dateUTC,
      }
    ])
    .select('*, categories(name)')
    .single();

  if (error) {
    console.error('Error saving expense:', error);
    throw new Error('Failed to save expense');
  }

  return data as Expense;
}
