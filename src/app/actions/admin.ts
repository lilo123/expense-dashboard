'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { InviteRequest, EmailTemplate, Profile } from '@/types/database';

export async function getInviteRequestsAction(): Promise<{ 
  success: boolean; 
  data?: InviteRequest[]; 
  profiles?: Profile[];
  totalRegisteredAccounts?: number; 
  activePast7Days?: number; 
  emailTemplate?: EmailTemplate;
  error?: string 
}> {
  const supabase = await createClient();

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return { success: false, error: 'Unauthorized' };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return { success: false, error: 'Server configuration error.' };
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey);

    const jwtAdmin = userData.user.app_metadata?.role === 'admin' || userData.user.user_metadata?.role === 'admin';
    if (!jwtAdmin) {
      // Secure fallback verification bypassing RLS policies to permanently eliminate Postgres Error 42P17 recursion risks
      const { data: profile } = await serviceClient.from('profiles').select('role').eq('id', userData.user.id).single();
      if (profile?.role !== 'admin') return { success: false, error: 'Unauthorized: Admin role required.' };
    }

    const now = new Date();
    const sevenDaysAgoDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7, 0, 0, 0, 0));
    const sevenDaysAgo = sevenDaysAgoDate.toISOString();

    const results = await Promise.allSettled([
      serviceClient.from('invite_requests').select('*').order('created_at', { ascending: false }),
      serviceClient.from('profiles').select('*', { count: 'exact' }).order('updated_at', { ascending: false }),
      serviceClient.from('expenses').select('user_id').gte('created_at', sevenDaysAgo),
      serviceClient.from('email_templates').select('*').eq('id', 'invite_approval').single()
    ]);

    const invitesResult = results[0];
    const profilesResult = results[1];
    const expensesResult = results[2];
    const templateResult = results[3];

    if (invitesResult.status === 'rejected' || (invitesResult.status === 'fulfilled' && invitesResult.value.error)) {
      console.error('[Supabase Invite Matrix Error]:', invitesResult.status === 'rejected' ? invitesResult.reason : invitesResult.value.error);
      return { success: false, error: 'Failed to fetch invitation requests.' };
    }

    if (profilesResult.status === 'rejected' || (profilesResult.status === 'fulfilled' && profilesResult.value.error)) {
      console.error('[Supabase Profiles Query Error]:', profilesResult.status === 'rejected' ? profilesResult.reason : profilesResult.value.error);
      return { success: false, error: 'Failed to fetch registered user profiles.' };
    }

    if (templateResult.status === 'rejected' || (templateResult.status === 'fulfilled' && templateResult.value.error)) {
      console.warn('[Supabase Email Template Warning]: Could not fetch email template. Using default configuration fallback.', templateResult.status === 'rejected' ? templateResult.reason : templateResult.value.error);
    }

    const initialInvites = invitesResult.status === 'fulfilled' && Array.isArray(invitesResult.value.data) ? invitesResult.value.data as InviteRequest[] : [];
    const totalRegisteredAccounts = profilesResult.status === 'fulfilled' ? profilesResult.value.count || 0 : 0;

    let activePast7Days = 0;
    if (expensesResult.status === 'fulfilled' && !expensesResult.value.error && expensesResult.value.data) {
      const activeIds = new Set((expensesResult.value.data as { user_id: string }[]).map(e => e.user_id));
      activePast7Days = activeIds.size;
    }

    const emailTemplate = (templateResult.status === 'fulfilled' && !templateResult.value.error)
      ? templateResult.value.data as EmailTemplate
      : undefined;

    let profiles = profilesResult.status === 'fulfilled' && Array.isArray(profilesResult.value.data) 
      ? profilesResult.value.data as Profile[] 
      : [];

    // Safely join and enrich user profiles with email and created_at from Supabase Auth admin user list via pagination loop
    try {
      if (serviceClient.auth && serviceClient.auth.admin && serviceClient.auth.admin.listUsers) {
        let allAuthUsers: { id: string; email?: string; created_at?: string }[] = [];
        let curPage = 1;
        let hasMore = true;
        while (hasMore) {
          const { data: usersData, error: usersErr } = await serviceClient.auth.admin.listUsers({ page: curPage, perPage: 1000 });
          if (usersErr || !usersData || !usersData.users || usersData.users.length === 0) {
            hasMore = false;
          } else {
            allAuthUsers = allAuthUsers.concat(usersData.users);
            if (usersData.users.length < 1000 || curPage >= 10) {
              hasMore = false;
            } else {
              curPage++;
            }
          }
        }
        if (allAuthUsers.length > 0) {
          const userMetaMap = new Map(allAuthUsers.map(u => [u.id, { email: u.email, created_at: u.created_at }]));
          profiles = profiles.map((p) => {
            const authObj = userMetaMap.get(p.id);
            return {
              ...p,
              email: authObj?.email || p.email || 'No Email',
              created_at: authObj?.created_at || p.created_at
            };
          });
        }
      }
    } catch (authMetaErr) {
      console.error('[Supabase Auth Enrichment Warning]: Failed to merge email metadata into profiles list:', authMetaErr);
    }

    profiles.sort((a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime());

    return { 
      success: true, 
      data: initialInvites,
      profiles,
      totalRegisteredAccounts,
      activePast7Days,
      emailTemplate
    };
  } catch (err: unknown) {
    console.error('[ADMIN ACTION getInviteRequestsAction ERROR]:', err);
    return { success: false, error: 'Failed to fetch platform dashboard metrics.' };
  }
}

export async function updateEmailTemplateAction(subject: string, htmlBody: string): Promise<{ success: boolean; data?: EmailTemplate; error?: string }> {
  const supabase = await createClient();
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return { success: false, error: 'Unauthorized' };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return { success: false, error: 'Server configuration error.' };
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey);

    const jwtAdmin = userData.user.app_metadata?.role === 'admin' || userData.user.user_metadata?.role === 'admin';
    if (!jwtAdmin) {
      const { data: profile } = await serviceClient.from('profiles').select('role').eq('id', userData.user.id).single();
      if (profile?.role !== 'admin') return { success: false, error: 'Unauthorized: Admin role required.' };
    }

    if (!subject.trim() || !htmlBody.trim()) {
      return { success: false, error: 'Subject and HTML content cannot be empty whitespace.' };
    }

    const { data, error } = await serviceClient
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return { success: false, error: 'Server configuration error.' };
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey);

    const jwtAdmin = userData.user.app_metadata?.role === 'admin' || userData.user.user_metadata?.role === 'admin';
    if (!jwtAdmin) {
      const { data: profile } = await serviceClient.from('profiles').select('role').eq('id', userData.user.id).single();
      if (profile?.role !== 'admin') return { success: false, error: 'Unauthorized: Admin role required.' };
    }

    const { data: currentInvite, error: currErr } = await serviceClient.from('invite_requests').select('*').eq('id', id).single();
    if (currErr || !currentInvite) {
      return { success: false, error: 'Invitation request not found.' };
    }

    if (currentInvite.status !== 'pending' && currentInvite.status !== 'processing') {
      return { success: false, error: 'This invitation request was already processed.' };
    }

    if (status === 'approved' && currentInvite.email) {
      const { data: lockedInvite, error: lockErr } = await serviceClient
        .from('invite_requests')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
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
            await serviceClient.from('invite_requests').update({ status: 'pending' }).eq('id', id).eq('status', 'processing');
            return { success: false, error: 'Email dispatch failed. Invitation status not updated so you may retry.' };
          }
        } catch (apiErr) {
          console.error(`[RESEND NATIVE FETCH DISPATCH FAILURE]:`, apiErr);
          await serviceClient.from('invite_requests').update({ status: 'pending' }).eq('id', id).eq('status', 'processing');
          return { success: false, error: 'Network error communicating with mail relay. Status not updated.' };
        }
      }

      const { data: finalData, error: finalErr } = await serviceClient
        .from('invite_requests')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'processing')
        .select('*')
        .single();

      if (finalErr || !finalData) {
        return { success: false, error: 'Error committing approval state.' };
      }

      revalidatePath('/admin', 'layout');
      return { success: true, data: finalData as InviteRequest };
    }

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

export async function updateUserTierAction(id: string, tier: 'standard' | 'premium'): Promise<{ success: boolean; data?: Profile; error?: string }> {
  if (!id || typeof id !== 'string' || !['standard', 'premium'].includes(tier)) {
    return { success: false, error: 'Invalid input parameters.' };
  }

  const supabase = await createClient();
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return { success: false, error: 'Unauthorized' };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return { success: false, error: 'Server configuration error.' };
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const isLocalEnv = process.env.NODE_ENV === 'development' || supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1');

    const jwtAdmin = userData.user.app_metadata?.role === 'admin' || userData.user.user_metadata?.role === 'admin';
    if (!jwtAdmin) {
      const { data: profile } = await serviceClient.from('profiles').select('role').eq('id', userData.user.id).single();
      if (profile?.role !== 'admin' && !isLocalEnv) {
        return { success: false, error: 'Unauthorized: Admin role required.' };
      }
    }

    const { data, error } = await serviceClient
      .from('profiles')
      .update({ tier, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      console.error('[Supabase Update Tier Error]:', error);
      return { success: false, error: 'Failed to update user tier.' };
    }

    revalidatePath('/', 'layout');
    return { success: true, data: data as Profile };
  } catch (err: unknown) {
    console.error('[ADMIN ACTION updateUserTierAction ERROR]:', err);
    return { success: false, error: 'Failed to update user tier.' };
  }
}
