import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import SettingsWrapper from '@/components/SettingsWrapper';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: userData, error } = await supabase.auth.getUser();

  // Secure Server Redirect: prevent unauthorized access
  if (error || !userData?.user) {
    redirect('/login');
  }

  let initialCategories: any[] = [];
  let initialExpenses: any[] = [];

  try {
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name');
    if (!categoriesError && categoriesData) {
      initialCategories = categoriesData;
    }

    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('*, categories(name)');
    if (!expensesError && expensesData) {
      initialExpenses = expensesData;
    }
  } catch (err) {
    console.error('[SETTINGS PAGE INITIAL DATA FETCH FAILED]:', err);
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <SettingsWrapper 
        userEmail={userData.user.email || ''} 
        initialCategories={initialCategories}
        initialExpenses={initialExpenses}
      />
    </div>
  );
}
