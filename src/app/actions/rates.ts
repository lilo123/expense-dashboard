'use server';

import { createClient } from '@/utils/supabase/server';

// 7 Core Currencies backed by local conversion map
const CORE_CURRENCIES = ['CAD', 'VND', 'USD', 'EUR', 'JPY', 'GBP', 'SGD'];

// Static fallback rates in case the public API fails or is offline (Base: CAD = 1.0)
const FALLBACK_RATES: Record<string, number> = {
  CAD: 1.0,
  VND: 18500.0,
  USD: 0.73,
  EUR: 0.68,
  JPY: 114.0,
  GBP: 0.58,
  SGD: 0.99,
};

export async function syncExchangeRates(): Promise<Record<string, number>> {
  const supabase = await createClient();

  try {
    // 1. Check if we have cached rates that are less than 24 hours old
    const { data: cached, error: fetchError } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('base_currency', 'CAD')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (!fetchError && cached) {
      const updatedAt = new Date(cached.updated_at).getTime();
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      if (updatedAt > oneDayAgo && cached.rates) {
        console.log('[FX CACHE HIT] Returning cached exchange rates.');
        return cached.rates as Record<string, number>;
      }
    }

    console.log('[FX CACHE MISS] Fetching live rates from public API (Base: CAD)...');

    // 2. Fetch live rates from public ExchangeRate-API (Baseline CAD)
    const res = await fetch('https://open.er-api.com/v6/latest/CAD', {
      next: { revalidate: 86400 }, // Next.js fetch cache for 1 day
    });

    if (!res.ok) throw new Error('Failed to fetch exchange rates from API');

    const data = await res.json();
    const apiRates = data.rates;

    if (!apiRates) throw new Error('Invalid API response payload');

    // 3. Filter for our 7 core currencies
    const filteredRates: Record<string, number> = {};
    CORE_CURRENCIES.forEach((curr) => {
      filteredRates[curr] = apiRates[curr] || FALLBACK_RATES[curr];
    });

    // 4. Cache the new rates inside our local DB
    const { error: upsertError } = await supabase
      .from('exchange_rates')
      .insert([
        {
          base_currency: 'CAD',
          rates: filteredRates,
          updated_at: new Date().toISOString(),
        },
      ]);

    if (upsertError) {
      console.warn('[FX CACHE ERROR] Failed to write rates to database:', upsertError.message);
    }

    console.log('[FX SYNC SUCCESS] Live exchange rates cached successfully (CAD baseline).');
    return filteredRates;
  } catch (err: any) {
    console.error('[FX SYNC FAILURE] Falling back to hardcoded CAD rates:', err.message || err);
    return FALLBACK_RATES;
  }
}
