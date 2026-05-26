import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Fetch categories
    const { data: categories } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id);

    // Fetch expenses
    const { data: expenses } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id);

    // Fetch budgets
    const { data: budgets } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id);

    // Fetch recurring expenses
    const { data: recurringExpenses } = await supabase
      .from('recurring_expenses')
      .select('*')
      .eq('user_id', user.id);

    const payload = {
      exported_at: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
      },
      profile: profile || null,
      categories: categories || [],
      expenses: expenses || [],
      budgets: budgets || [],
      recurring_expenses: recurringExpenses || [],
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="anyen-data-export-${user.id}.json"`,
      },
    });

  } catch (error) {
    console.error('[EXPORT DATA ERROR]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
