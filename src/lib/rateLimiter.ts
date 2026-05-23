import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cache client instance at module-level to optimize serverless warm starts
let supabaseInstance: SupabaseClient | null = null;

function getSupabase() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy';
    supabaseInstance = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseInstance;
}

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<{ success: boolean; remaining: number; reset: Date }> {
  const now = new Date();
  
  try {
    // Call the atomic database-level RPC to eliminate read-then-write concurrency race conditions
    const { data, error } = await getSupabase().rpc('check_rate_limit_rpc', {
      p_key: key,
      p_limit: limit,
      p_window_ms: windowMs
    });

    if (error) throw error;

    // The RPC returns an array of results. Since we get exactly one row back, extract the first element.
    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      throw new Error('Empty response payload from check_rate_limit_rpc');
    }

    return {
      success: result.success,
      remaining: result.remaining,
      reset: new Date(result.reset_at)
    };
  } catch (error) {
    console.error('[RATE LIMITER ERROR]:', error);
    return { success: true, remaining: limit, reset: now }; // Fail open defensively if the database is down
  }
}
