'use server';

import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

export async function generateSiriTokenAction(): Promise<{ success: boolean; token?: string; error?: string }> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  // Generate 32 bytes of secure random hex
  const rawToken = crypto.randomBytes(32).toString('hex');
  // Create a SHA-256 hash of the token for database storage
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Invalidate any existing tokens for this user to enforce single active device
  await supabase.from('siri_tokens').delete().eq('user_id', userData.user.id);

  const { error } = await supabase
    .from('siri_tokens')
    .insert([{ user_id: userData.user.id, token_hash: tokenHash }]);

  if (error) {
    return { success: false, error: error.message };
  }

  // Return the raw token once to the client
  return { success: true, token: rawToken };
}
