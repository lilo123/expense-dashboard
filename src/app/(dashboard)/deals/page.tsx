import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getDealsAction } from '@/app/actions/deals';
import { syncExchangeRates } from '@/app/actions/rates';
import DealsClient from './DealsClient';

export const metadata = {
  title: 'Deals Tracker | Dashboard',
};

export default async function DealsPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier, display_currency')
    .eq('id', authData.user.id)
    .single();

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

  let exchangeRates: Record<string, number> = { CAD: 1.0, USD: 0.73 };
  try {
    exchangeRates = await syncExchangeRates(supabase);
  } catch (error) {
    console.error('[DealsPage] Error syncing exchange rates:', error);
  }

  const initialDisplayCurrency = profile?.display_currency === 'USD' ? 'USD' : 'CAD';

  return (
    <DealsClient 
      initialDeals={deals} 
      initialDisplayCurrency={initialDisplayCurrency}
      exchangeRates={exchangeRates}
    />
  );
}
