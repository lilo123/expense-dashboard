'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { InviteRequest, EmailTemplate } from '@/types/database';

export async function getInviteRequestsAction(): Promise<{ 
  success: boolean; 
  data?: InviteRequest[]; 
  totalRegisteredAccounts?: number; 
  activePast7Days?: number; 
  emailTemplate?: EmailTemplate;
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

    const now = new Date();
    const sevenDaysAgoDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7, 0, 0, 0, 0));
    const sevenDaysAgo = sevenDaysAgoDate.toISOString();

    const results = await Promise.allSettled([
      serviceClient.from('invite_requests').select('*').order('created_at', { ascending: false }),
      serviceClient.from('profiles').select('*', { count: 'exact', head: true }),
      serviceClient.from('expenses').select('user_id').gte('created_at', sevenDaysAgo),
      serviceClient.from('email_templates').select('*').eq('id', 'invite_approval').single()
    ]);

    const invitesResult = results[0];
    const profilesResult = results[1];
    const expensesResult = results[2];
    const templateResult = results[3];

    if (invitesResult.status === 'rejected' || invitesResult.value.error) {
      throw invitesResult.status === 'rejected' ? invitesResult.reason : invitesResult.value.error;
    }

    if (templateResult.status === 'rejected' || (templateResult.status === 'fulfilled' && templateResult.value.error && templateResult.value.error.code !== 'PGRST116')) {
      console.error('[Supabase Email Template Error]:', templateResult.status === 'rejected' ? templateResult.reason : templateResult.value.error);
      return { success: false, error: 'Failed to fetch configuration state. Aborting to prevent unintended data overwrites.' };
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

    const emailTemplate = (templateResult.status === 'fulfilled' && !templateResult.value.error)
      ? templateResult.value.data as EmailTemplate
      : undefined;

    return { 
      success: true, 
      data: initialInvites,
      totalRegisteredAccounts,
      activePast7Days,
      emailTemplate
    };
  } catch (err: unknown) {
    console.error('[ADMIN ACTION getInviteRequestsAction ERROR]:', err);
    return { success: false, error: 'Failed to fetch invitation requests.' };
  }
}

export async function updateEmailTemplateAction(subject: string, htmlBody: string): Promise<{ success: boolean; data?: EmailTemplate; error?: string }> {
  const supabase = await createClient();
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return { success: false, error: 'Unauthorized' };

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single();
    if (profile?.role !== 'admin') return { success: false, error: 'Unauthorized: Admin role required.' };

    if (!subject.trim() || !htmlBody.trim()) {
      return { success: false, error: 'Subject and HTML content cannot be empty whitespace.' };
    }

    // Adhering to PostgreSQL Row Level Security policies via authenticated supabase client
    const { data, error } = await supabase
      .from('email_templates')
      .upsert({ id: 'invite_approval', subject: subject.trim(), html_body: htmlBody.trim(), updated_at: new Date().toISOString() })
      .select('*')
      .single();

    if (error || !data) {
      console.error('[Supabase Upsert Template Error]:', error);
      return { success: false, error: 'Failed to save email template.' };
    }

    revalidatePath('/admin', 'layout');
    return { success: true, data: data as EmailTemplate };
  } catch (err: unknown) {
    console.error('[ADMIN ACTION updateEmailTemplateAction ERROR]:', err);
    return { success: false, error: 'Failed to update email template.' };
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

    // Fetch current request safely
    const { data: currentInvite, error: currErr } = await serviceClient.from('invite_requests').select('*').eq('id', id).single();
    if (currErr || !currentInvite) {
      return { success: false, error: 'Invitation request not found.' };
    }

    if (currentInvite.status !== 'pending') {
      return { success: false, error: 'This invitation request was already processed.' };
    }

    if (status === 'approved' && currentInvite.email) {
      // Optimistic Concurrency Locking: Atomically set intermediary 'processing' state to prevent duplicate dispatches
      const { data: lockedInvite, error: lockErr } = await serviceClient
        .from('invite_requests')
        .update({ status: 'processing', updated_at: new Date().toISOString() } as unknown as { status: 'pending'; updated_at: string })
        .eq('id', id)
        .eq('status', 'pending')
        .select('*')
        .single();

      if (lockErr || !lockedInvite) {
        if (lockErr && lockErr.code === 'PGRST116') {
          return { success: false, error: 'This invitation request was already processed by another administrator.' };
        }
        return { success: false, error: 'Failed to update status or invite was already processed.' };
      }

      if (!process.env.RESEND_API_KEY) {
        console.warn('[RESEND API WARNING]: API Key missing. Skipping invitation dispatch.');
      } else {
        try {
          const { data: tmplData } = await serviceClient.from('email_templates').select('*').eq('id', 'invite_approval').single();
          
          const mailSubject = tmplData?.subject?.trim() ? tmplData.subject.trim() : 'Welcome to An-yen — Your Private Early Adopter Access';
          const mailBody = tmplData?.html_body?.trim() ? tmplData.html_body.trim() : `
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
          `;

          const fetchRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
            },
            body: JSON.stringify({
              from: 'An-yen Community <invites@notifications.an-yen.com>',
              to: currentInvite.email,
              subject: mailSubject,
              html: mailBody
            })
          });

          if (!fetchRes.ok) {
            const errPayload = await fetchRes.text();
            console.error(`[RESEND API HTTP DISPATCH FAILURE]: HTTP Status ${fetchRes.status} - ${errPayload}`);
            
            // Revert state back to pending to permit clean administrative retry
            await serviceClient.from('invite_requests').update({ status: 'pending' }).eq('id', id);
            return { success: false, error: 'Email dispatch failed. Invitation status not updated so you may retry.' };
          }
        } catch (apiErr) {
          console.error(`[RESEND NATIVE FETCH DISPATCH FAILURE]:`, apiErr);
          await serviceClient.from('invite_requests').update({ status: 'pending' }).eq('id', id);
          return { success: false, error: 'Network error communicating with mail relay. Status not updated.' };
        }
      }

      // Finalize database commit from processing lock state to approved
      const { data: finalData, error: finalErr } = await serviceClient
        .from('invite_requests')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

      if (finalErr || !finalData) {
        return { success: false, error: 'Error committing approval state.' };
      }

      revalidatePath('/admin', 'layout');
      return { success: true, data: finalData as InviteRequest };
    }

    // Standard non-email status transition for rejected
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

    revalidatePath('/admin', 'layout');
    return { success: true, data: data as InviteRequest };
  } catch (err: unknown) {
    console.error('[ADMIN ACTION updateInviteStatusAction ERROR]:', err);
    return { success: false, error: 'Failed to update invite request status.' };
  }
}
