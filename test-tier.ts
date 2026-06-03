import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing env');
  
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  
  const { data: users, error: userErr } = await client.from('profiles').select('id, tier, role').limit(1);
  if (userErr) { console.error('Err fetching users', userErr); return; }
  if (!users || users.length === 0) { console.log('No users found'); return; }
  
  const id = users[0].id;
  const currentTier = users[0].tier;
  const newTier = currentTier === 'premium' ? 'standard' : 'premium';
  
  console.log('Updating user tier');
  
  const { data, error } = await client
    .from('profiles')
    .update({ tier: newTier, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
    
  if (error) {
    console.error('UPDATE ERROR:', JSON.stringify(error, null, 2));
  } else {
    console.log('UPDATE SUCCESS');
  }
}
run();
