import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ClientDashboard from '@/components/ClientDashboard';

export default async function Page() {
  const supabase = await createClient();
  let globalError = null;
  let expenses: any[] = [];
  let categories: any[] = [];
  let user = null;

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      redirect('/login');
    }
    user = { id: authData.user.id, email: authData.user.email };

    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('*, categories(name)')
      .order('date', { ascending: false });
    
    if (expensesError) throw expensesError;
    expenses = expensesData || [];

    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name');
    
    if (categoriesError) throw categoriesError;
    categories = categoriesData || [];

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
    />
  );
}
