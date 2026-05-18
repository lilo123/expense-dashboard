import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import BudgetPlanner from '@/components/BudgetPlanner';
import { Suspense } from 'react';
import BudgetPlannerSkeleton from './loading';

interface BudgetPageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function BudgetPage({ searchParams }: BudgetPageProps) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData?.user) {
    redirect('/login');
  }

  const userId = userData.user.id;
  const resolvedParams = await searchParams;
  const initialYear = resolvedParams.year || String(new Date().getFullYear());

  // Fetch budgets for active year plus December of previous year, and categories for user
  const [budgetsRes, categoriesRes, profileRes] = await Promise.all([
    supabase.from('budgets').select('*').eq('user_id', userId).or(`month.like.${initialYear}-%,month.eq.${parseInt(initialYear) - 1}-12`),
    supabase.from('categories').select('*').eq('user_id', userId),
    supabase.from('profiles').select('*').eq('id', userId).single()
  ]);

  if (budgetsRes.error) throw budgetsRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  if (profileRes.error) throw profileRes.error;

  // Strict DTO Mapping to prevent Flight serialization bloat and over-fetching
  const initialBudgets = (budgetsRes.data || []).map(b => ({
    id: String(b.id),
    category_id: b.category_id ? String(b.category_id) : null,
    limit_amount: Number(b.limit_amount),
    currency: String(b.currency || 'CAD'),
    month: String(b.month)
  }));

  const categories = (categoriesRes.data || []).map(c => ({
    id: String(c.id),
    name: String(c.name),
    icon: c.icon ? String(c.icon) : null
  }));

  const displayCurrency = String(profileRes.data?.display_currency || 'CAD');

  return (
    <BudgetPlanner 
      initialBudgets={initialBudgets} 
      categories={categories} 
      displayCurrency={displayCurrency} 
      initialYear={initialYear} 
    />
  );
}
