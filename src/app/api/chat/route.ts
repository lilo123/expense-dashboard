import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { saveExpense } from '@/lib/expenses';
import { extractExpenseFromMessage } from '@/lib/ai';

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

    const { data: userCategories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id);

    const categoriesList = userCategories || [];
    if (categoriesList.length === 0) {
      return NextResponse.json({ error: 'No categories found for user.' }, { status: 400 });
    }

    const extracted = await extractExpenseFromMessage(message, categoriesList);
    if ('error' in extracted) {
      if (extracted.status === 200) return NextResponse.json({ reply: extracted.error });
      return NextResponse.json({ error: extracted.error }, { status: extracted.status || 400 });
    }

    const { amount, category_id, item, dateToInsert, finalCategoryName } = extracted;

    const savedRecord = await saveExpense(amount, category_id, item, user.id, dateToInsert);
    const expenseData = Array.isArray(savedRecord) ? savedRecord[0] : savedRecord;

    return NextResponse.json({
      reply: `Got it! I've added $${amount.toFixed(2)} for ${item} under ${finalCategoryName}.`,
      expense: expenseData
    });

  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
