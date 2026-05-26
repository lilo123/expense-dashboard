"use server"

import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function purgeUserAccount(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return { success: false, error: 'Server configuration error' };
    }

    // Instantiate admin client
    const adminClient = createServiceClient(supabaseUrl, supabaseServiceKey);

    // 1. Invite request PII purge: Delete invitation request matching their email
    if (user.email) {
      await adminClient
        .from('invite_requests')
        .delete()
        .eq('email', user.email.toLowerCase().trim());
    }

    // 2. Cascade Purge: Wipes public user tables by deleting auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // 3. Session Wipe: sign out immediately
    await supabase.auth.signOut();

    return { success: true };
  } catch (error) {
    console.error('[PURGE ACCOUNT FAILED]:', error);
    const errMsg = error instanceof Error ? error.message : 'Failed to purge account';
    return { success: false, error: errMsg };
  }
}
