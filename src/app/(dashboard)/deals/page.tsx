import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getDealsAction } from '@/app/actions/deals';
import DealsClient from './DealsClient';

export const metadata = {
  title: 'Deals Tracker | Dashboard',
};

export default async function DealsPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('tier').eq('id', authData.user.id).single();
  if (profile?.tier !== 'premium') {
    redirect('/dashboard');
  }

  let deals = [];
  try {
    deals = await getDealsAction();
  } catch (error) {
    console.error('[DealsPage] Error fetching deals:', error);
    deals = [];
  }
  return <DealsClient initialDeals={deals} />;
}
