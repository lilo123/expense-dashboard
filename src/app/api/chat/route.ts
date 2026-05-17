import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { saveExpense } from '@/lib/expenses';
import { extractExpenseFromMessage } from '@/lib/ai';
import { syncExchangeRates } from '@/app/actions/rates';
import { convertAmount, formatFriendlyCurrency } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Fetch user's base currency from profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('base_currency')
      .eq('id', user.id)
      .single();

    const baseCurrency = profileData?.base_currency || 'CAD';

    const { data: userCategories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id);

    const categoriesList = userCategories || [];
    if (categoriesList.length === 0) {
      return NextResponse.json({ error: 'No categories found for user.' }, { status: 400 });
    }

    // Extract via unified AI service (passes baseline currency)
    const extracted = await extractExpenseFromMessage(message, categoriesList, baseCurrency);
    if ('error' in extracted) {
      if (extracted.status === 200) return NextResponse.json({ reply: extracted.error });
      return NextResponse.json({ error: extracted.error }, { status: extracted.status || 400 });
    }

    const { amount, currency, category_id, item, dateToInsert, finalCategoryName } = extracted;

    // Convert baseline amount if transaction differs from base currency
    let finalAmount = amount;
    if (currency !== baseCurrency) {
      const rates = await syncExchangeRates();
      finalAmount = convertAmount(amount, currency, baseCurrency, rates);
    }

    const savedRecord = await saveExpense(
      finalAmount, 
      category_id, 
      item, 
      user.id, 
      dateToInsert, 
      amount, 
      currency, 
      currency
    );
    const expenseData = Array.isArray(savedRecord) ? savedRecord[0] : savedRecord;

    return NextResponse.json({
      reply: `Got it! I've added ${formatFriendlyCurrency(amount, currency)} for ${item} under ${finalCategoryName}.`,
      expense: expenseData
    });

  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
