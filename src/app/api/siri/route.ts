import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { extractExpenseFromMessage } from '@/lib/ai';

export async function POST(request: Request) {
  try {
    // 1. Verify Siri Token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized or invalid token format' }, { status: 401 });
    }

    const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Internal Configuration Error' }, { status: 500 });
    }

    // Use service role to verify token hash across users
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: tokenData, error: tokenError } = await supabase
      .from('siri_tokens')
      .select('user_id')
      .eq('token_hash', tokenHash)
      .single();

    if (tokenError || !tokenData?.user_id) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API Token' }, { status: 401 });
    }

    const userId = tokenData.user_id;

    // 2. Parse request body
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 3. Fetch user categories
    const { data: userCategories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', userId);

    const categoriesList = userCategories || [];
    if (categoriesList.length === 0) {
      return NextResponse.json({ error: 'No categories found for user.' }, { status: 400 });
    }

    // 4. Extract via unified AI service
    const extracted = await extractExpenseFromMessage(message, categoriesList);
    if ('error' in extracted) {
      return NextResponse.json({ error: extracted.error }, { status: extracted.status || 400 });
    }

    const { amount, category_id, item, dateToInsert, finalCategoryName } = extracted;

    // 5. Save to Database
    const { data: savedRecord, error: insertError } = await supabase
      .from('expenses')
      .insert([
        {
          user_id: userId,
          item: String(item),
          amount: Number(amount),
          category_id: category_id,
          date: dateToInsert,
        }
      ])
      .select('*, categories(name)')
      .single();

    if (insertError) {
      return NextResponse.json({ error: 'Failed to save expense' }, { status: 500 });
    }

    return new NextResponse(`I've logged $${Number(amount).toFixed(2)} for ${item} under ${finalCategoryName}.`);

  } catch (error) {
    console.error('Error in Siri API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
