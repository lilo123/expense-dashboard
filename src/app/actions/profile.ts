'use server';

import { createClient } from '@/utils/supabase/server';
import { Profile, SupportedCurrency } from '@/types/database';

export async function getProfile(): Promise<{ success: boolean; data?: Profile; error?: string }> {
  const supabase = await createClient();
  
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .single();

    if (profileError) throw profileError;

    return { success: true, data: profile as Profile };
  } catch (err: any) {
    console.error('[SERVER ACTION getProfile FAILURE]:', err.message || err);
    return { success: false, error: 'Failed to load account profile.' };
  }
}

export async function updateProfile(data: {
  display_name: string;
  email: string;
  base_currency: SupportedCurrency;
  budget_reset_day: number;
  ai_tone: string;
}): Promise<{ success: boolean; emailVerificationSent?: boolean; message?: string; error?: string }> {
  const supabase = await createClient();

  try {
    // 1. Authenticate the session
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const userId = userData.user.id;
    const currentEmail = userData.user.email;
    let emailVerificationSent = false;

    // 2. Handle Email Address Updates in Supabase Auth
    if (data.email && data.email !== currentEmail) {
      console.log(`[AUTH EMAIL UPDATE] Requesting update from ${currentEmail} to ${data.email}...`);
      const { error: emailUpdateError } = await supabase.auth.updateUser({
        email: data.email
      });

      if (emailUpdateError) throw emailUpdateError;
      emailVerificationSent = true;
    }

    // 3. Update Metadata in public.profiles Table
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        display_name: data.display_name,
        base_currency: data.base_currency,
        budget_reset_day: data.budget_reset_day,
        ai_tone: data.ai_tone,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileUpdateError) throw profileUpdateError;

    let successMessage = 'Account overview saved successfully!';
    if (emailVerificationSent) {
      successMessage = 'Overview saved! A verification link has been sent to your new email. Please check both inboxes to verify.';
    }

    return { 
      success: true, 
      emailVerificationSent, 
      message: successMessage 
    };
  } catch (err: any) {
    console.error('[SERVER ACTION updateProfile FAILURE]:', err.message || err);
    return { 
      success: false, 
      error: 'Uh oh, the system tripped up! Don\'t worry, your data is safe. Let\'s try that again.' 
    };
  }
}

export async function updatePassword(newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Call Supabase Auth to update active user password
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    return { success: true, message: 'Password updated successfully!' };
  } catch (err: any) {
    console.error('[SERVER ACTION updatePassword FAILURE]:', err.message || err);
    return { 
      success: false, 
      error: 'Failed to update password. Please try again.' 
    };
  }
}
