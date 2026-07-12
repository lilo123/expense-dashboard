import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Polyfill global WebSocket for Node 20 compatibility
(global as any).WebSocket = ws;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testPostgrestRaceCondition() {
  console.log('\n=== [ADVERSARIAL TEST] Verifying PostgREST Schema Cache Readiness ===');
  
  try {
    // Attempt immediate table access without waiting for PostgREST schema cache reload
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    
    if (error) {
      console.error('[FAIL] PostgREST schema cache not ready or permission denied:', error.message);
      process.exit(1);
    }
    
    console.log('[PASS] PostgREST schema cache is ready and accessible.');
    process.exit(0);
  } catch (err: any) {
    console.error('[FAIL] Unexpected error during PostgREST access:', err.message || err);
    process.exit(1);
  }
}

testPostgrestRaceCondition();
