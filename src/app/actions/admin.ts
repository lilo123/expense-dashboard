'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { InviteRequest } from '@/types/database';

export async function getInviteRequestsAction(): Promise<{ 
  success: boolean; 
  data?: InviteRequest[]; 
  totalRegisteredAccounts?: number; 
  activePast7Days?: number; 
  error?: string 
}> {
  const supabase = await createClient();

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return { success: false, error: 'Unauthorized' };

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single();
    if (profile?.role !== 'admin') return { success: false, error: 'Unauthorized: Admin role required.' };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return { success: false, error: 'Server configuration error.' };
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey);

    // Compute stable Calendar Day boundaries (Midnight UTC 7 Days Prior)
    const now = new Date();
    const sevenDaysAgoDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7, 0, 0, 0, 0));
    const sevenDaysAgo = sevenDaysAgoDate.toISOString();

    const results = await Promise.allSettled([
      serviceClient.from('invite_requests').select('*').order('created_at', { ascending: false }),
      serviceClient.from('profiles').select('*', { count: 'exact', head: true }),
      serviceClient.from('expenses').select('user_id').gte('created_at', sevenDaysAgo)
    ]);

    const invitesResult = results[0];
    const profilesResult = results[1];
    const expensesResult = results[2];

    if (invitesResult.status === 'rejected' || invitesResult.value.error) {
      throw invitesResult.status === 'rejected' ? invitesResult.reason : invitesResult.value.error;
    }

    if (profilesResult.status === 'rejected') {
      console.error('[Supabase Profiles Promise Rejected]:', profilesResult.reason);
    } else if (profilesResult.value.error) {
      console.error('[Supabase Profiles Query Error]:', profilesResult.value.error);
    }

    if (expensesResult.status === 'rejected') {
      console.error('[Supabase Expenses Promise Rejected]:', expensesResult.reason);
    } else if (expensesResult.value.error) {
      console.error('[Supabase Expenses Query Error]:', expensesResult.value.error);
    }

    const initialInvites = invitesResult.value.data as InviteRequest[];
    const totalRegisteredAccounts = (profilesResult.status === 'fulfilled' && !profilesResult.value.error) 
      ? profilesResult.value.count || 0 
      : 0;

    let activePast7Days = 0;
    if (expensesResult.status === 'fulfilled' && !expensesResult.value.error && expensesResult.value.data) {
      const activeIds = new Set((expensesResult.value.data as { user_id: string }[]).map(e => e.user_id));
      activePast7Days = activeIds.size;
    }

    return { 
      success: true, 
      data: initialInvites,
      totalRegisteredAccounts,
      activePast7Days
    };
  } catch (err: unknown) {
    console.error('[ADMIN ACTION getInviteRequestsAction ERROR]:', err);
    return { success: false, error: 'Failed to fetch invitation requests.' };
  }
}

export async function updateInviteStatusAction(id: string, status: 'approved' | 'rejected'): Promise<{ success: boolean; data?: InviteRequest; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return { success: false, error: 'Unauthorized' };

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single();
    if (profile?.role !== 'admin') return { success: false, error: 'Unauthorized: Admin role required.' };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return { success: false, error: 'Server configuration error.' };
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey);

    // Atomic SQL constraint update defeating TOCTOU race conditions (eq status pending)
    const { data, error } = await serviceClient
      .from('invite_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select('*')
      .single();

    if (error || !data) {
      if (error && error.code === 'PGRST116') {
        return { success: false, error: 'This invitation request was already processed by another administrator.' };
      }
      return { success: false, error: 'Failed to update status or invite was already processed.' };
    }

    // Enterprise Resend automated Web API REST dispatch via native fetch
    if (status === 'approved' && data?.email) {
      if (!process.env.RESEND_API_KEY) {
        console.warn('[RESEND API WARNING]: API Key missing. Skipping invitation dispatch.');
      } else {
        try {
          const fetchRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
            },
            body: JSON.stringify({
              from: 'An-yen Community <invites@notifications.an-yen.com>',
              to: data.email,
              subject: 'Welcome to An-yen — Your Private Early Adopter Access',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; color: #1c1917;">
                  <h1 style="color: #1c1917; font-size: 24px; font-weight: bold;">Your Private Access Granted</h1>
                  <p style="font-size: 16px; line-height: 1.5; color: #444;">
                    Thank you for sharing your motivation with us. We are incredibly thrilled to welcome you into the An-yen early adopter cohort!
                  </p>
                  <div style="margin: 30px 0;">
                    <a href="https://an-yen.com/login?secret=flow-vip#toggle-to-signup" 
                       style="background-color: #1c1917; color: #fbf9f4; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block;">
                      Access An-yen Platform
                    </a>
                  </div>
                  <p style="font-size: 13px; color: #888;">
                    Please note: This access URL is protected. Our backend verifies your exact email address prior to profile creation.
                  </p>
                </div>
              `
            })
          });
          if (!fetchRes.ok) {
            const errPayload = await fetchRes.text();
            console.error(`[RESEND API HTTP DISPATCH FAILURE]: HTTP Status ${fetchRes.status} - ${errPayload}`);
          }
        } catch (apiErr) {
          console.error(`[RESEND NATIVE FETCH DISPATCH FAILURE]:`, apiErr);
        }
      }
    }

    // Comprehensive Targeted Layout Revalidation
    revalidatePath('/admin', 'layout');
    return { success: true, data: data as InviteRequest };
  } catch (err: unknown) {
    console.error('[ADMIN ACTION updateInviteStatusAction ERROR]:', err);
    return { success: false, error: 'Failed to update invite request status.' };
  }
}
