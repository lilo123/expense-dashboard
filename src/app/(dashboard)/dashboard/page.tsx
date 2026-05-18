import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import ClientDashboard from '@/components/ClientDashboard';

export default async function Page() {
  const supabase = await createClient();
  let globalError = null;
  let expenses: any[] = [];
  let categories: any[] = [];
  let budgets: any[] = [];
  let profile = null;
  let exchangeRates: Record<string, number> = { CAD: 1.0 };
  let user = null;

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      const headersList = await headers();
      const isNextAction = headersList.get('next-action');
      if (!isNextAction) {
        redirect('/login');
      }
    } else if (authData?.user) {
      user = { id: authData.user.id, email: authData.user.email };

      // Fetch Expenses, Categories, Profile, Exchange Rates, Budgets concurrently
      const [expensesRes, categoriesRes, profileRes, ratesRes, budgetsRes] = await Promise.all([
        supabase.from('expenses').select('*, categories(name)').order('date', { ascending: false }),
        supabase.from('categories').select('id, name, icon'),
        supabase.from('profiles').select('*').eq('id', authData.user.id).single(),
        supabase.from('exchange_rates').select('*').eq('base_currency', 'CAD').order('updated_at', { ascending: false }).limit(1).single(),
        supabase.from('budgets').select('*').eq('user_id', authData.user.id)
      ]);

      if (expensesRes.error) throw expensesRes.error;
      expenses = expensesRes.data || [];

      if (categoriesRes.error) throw categoriesRes.error;
      categories = categoriesRes.data || [];

      if (budgetsRes.error) throw budgetsRes.error;
      budgets = budgetsRes.data || [];

      if (profileRes.error && profileRes.error.code !== 'PGRST116') {
        console.warn('[SERVER FETCH PROFILE ERROR]:', profileRes.error);
      }
      profile = profileRes.data || null;

      if (ratesRes.error && ratesRes.error.code !== 'PGRST116') {
        console.warn('[SERVER FETCH RATES ERROR]:', ratesRes.error);
      }
      exchangeRates = ratesRes.data?.rates || { CAD: 1.0 };
    }

  } catch (err: any) {
    console.error('Error fetching dashboard data:', err);
    globalError = err.message || 'Failed to load data';
  }

  return (
    <ClientDashboard 
      initialExpenses={expenses}
      initialCategories={categories}
      initialUser={user}
      initialError={globalError}
      initialProfile={profile}
      initialExchangeRates={exchangeRates}
      initialBudgets={budgets}
    />
  );
}
