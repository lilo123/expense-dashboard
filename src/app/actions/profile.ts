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

export async function updateProfile(data: Partial<{
  display_name: string;
  base_currency: SupportedCurrency;
  budget_reset_day: number;
  ai_tone: string;
  timezone: string;
}>): Promise<{ success: boolean; message?: string; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const userId = userData.user.id;

    // Build dynamic update payload to only update provided fields
    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };
    if (data.display_name !== undefined) updatePayload.display_name = data.display_name;
    if (data.base_currency !== undefined) updatePayload.base_currency = data.base_currency;
    if (data.budget_reset_day !== undefined) updatePayload.budget_reset_day = data.budget_reset_day;
    if (data.ai_tone !== undefined) updatePayload.ai_tone = data.ai_tone;
    if (data.timezone !== undefined) updatePayload.timezone = data.timezone;

    // Update Metadata in public.profiles Table
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId);

    if (profileUpdateError) throw profileUpdateError;

    return { 
      success: true, 
      message: 'General details saved successfully!' 
    };
  } catch (err: any) {
    console.error('[SERVER ACTION updateProfile FAILURE]:', err.message || err);
    return { 
      success: false, 
      error: 'Uh oh, the system tripped up! Don\'t worry, your data is safe. Let\'s try that again.' 
    };
  }
}

export async function updateEmail(newEmail: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const currentEmail = userData.user.email;

    if (newEmail === currentEmail) {
      return { success: false, error: 'Please enter a different email address.' };
    }

    console.log(`[AUTH EMAIL UPDATE] Sending verification links from ${currentEmail} to ${newEmail}...`);
    
    // Trigger Supabase double-verification update flow
    const { error } = await supabase.auth.updateUser({
      email: newEmail
    });

    if (error) throw error;

    return {
      success: true,
      message: 'Verification links have been sent to both your old and new email addresses. Please check both inboxes to verify.'
    };
  } catch (err: any) {
    console.error('[SERVER ACTION updateEmail FAILURE]:', err.message || err);
    return {
      success: false,
      error: 'Failed to request email update. Please try again.'
    };
  }
}

export async function updatePassword(data: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message?: string; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const email = userData.user.email!;

    // 1. Secure credentials re-auth check: try signing in with current password
    console.log(`[AUTH PASSWORD RE-AUTH] Running re-authentication check for ${email}...`);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: data.currentPassword
    });

    if (signInError) {
      console.warn('[AUTH RE-AUTH FAILED]: Current password check rejected.');
      return { success: false, error: 'Current password is incorrect.' };
    }

    // 2. Proceed with password save if re-auth passed
    const { error: updateError } = await supabase.auth.updateUser({
      password: data.newPassword
    });

    if (updateError) throw updateError;

    return { success: true, message: 'Password updated successfully!' };
  } catch (err: any) {
    console.error('[SERVER ACTION updatePassword FAILURE]:', err.message || err);
    return { 
      success: false, 
      error: 'Failed to update password. Please try again.' 
    };
  }
}
