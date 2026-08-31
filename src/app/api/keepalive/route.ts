import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // 1. Verify the request comes securely from Vercel Crons
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Safely use the anon key. We only need the DB to receive traffic, NOT fetch actual row data.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 3. Perform a lightweight HEAD request against an existing table just to record a network hit. 
  // Doesn't matter if RLS blocks it; the REST gateway traffic prevents pauses.
  const { error } = await supabase.from('categories').select('id', { count: 'exact', head: true });

  if (error) {
    console.error('Keep-alive ping failed:', error.message);
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
