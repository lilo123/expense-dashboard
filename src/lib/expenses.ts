import { createClient } from '@/utils/supabase/server';
import { Expense } from '@/types/database';
import { ExpenseInputSchema } from '@/lib/validators';

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

export async function saveExpense(
  amount: number, 
  category_id: string, 
  item: string, 
  user_id: string, 
  dateUTC: string = new Date().toISOString(),
  originalAmount?: number,
  originalCurrency?: string,
  currency?: string
): Promise<Expense> {
  const supabase = await createClient();

  const validated = ExpenseInputSchema.parse({
    item,
    amount,
    category_id,
    date: dateUTC,
    original_amount: originalAmount !== undefined ? originalAmount : amount,
    original_currency: originalCurrency || 'USD',
    currency: currency || 'USD'
  });

  const { data, error } = await supabase
    .from('expenses')
    .insert([
      {
        user_id,
        item: validated.item,
        amount: validated.amount,
        category_id: validated.category_id,
        date: validated.date,
        original_amount: validated.original_amount,
        original_currency: validated.original_currency,
        currency: validated.currency
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
