import { getInviteRequestsAction, updateInviteStatusAction, updateEmailTemplateAction, updateUserTierAction } from '@/app/actions/admin';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

describe('Admin Action Security Hardening & Dynamic Mail Templates', () => {
  let mockSupabase: any;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    jest.clearAllMocks();
  });

  it('rejects all admin actions with Unauthorized when unauthenticated', async () => {
    mockSupabase = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) } };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    const res1 = await getInviteRequestsAction();
    expect(res1.success).toBe(false);
    expect(res1.error).toBe('Unauthorized');

    const res2 = await updateInviteStatusAction('invite-1', 'approved');
    expect(res2.success).toBe(false);
    expect(res2.error).toBe('Unauthorized');

    const res3 = await updateEmailTemplateAction('Sub', 'Body');
    expect(res3.success).toBe(false);
    expect(res3.error).toBe('Unauthorized');

    const res4 = await updateUserTierAction('user-1', 'premium');
    expect(res4.success).toBe(false);
    expect(res4.error).toBe('Unauthorized');
  });

  it('rejects actions when profile role is regular user', async () => {
    mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { role: 'user' } })
          })
        })
      })
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    (createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

    const res = await updateEmailTemplateAction('Sub', 'Body');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Unauthorized: Admin role required.');

    const res2 = await updateInviteStatusAction('invite-1', 'approved');
    expect(res2.success).toBe(false);
    expect(res2.error).toBe('Unauthorized: Admin role required.');
  });

  it('safeguards against modifying an already claimed invitation via atomic constraints', async () => {
    mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } } }) },
      from: jest.fn().mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }) })
            })
          };
        }
        if (table === 'invite_requests') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { status: 'claimed' } }) })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Already claimed' } })
                  })
                })
              })
            })
          };
        }
      })
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    (createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

    const res = await updateInviteStatusAction('invite-1', 'approved');
    expect(res.success).toBe(false);
    expect(res.error).toContain('already processed');
  });

  it('intercepts PGRST116 zero-row concurrent processing errors cleanly', async () => {
    mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } } }) },
      from: jest.fn().mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }) })
            })
          };
        }
        if (table === 'invite_requests') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { status: 'pending', email: 'test@example.com' } }) })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: '0 rows' } })
                  })
                })
              })
            })
          };
        }
      })
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    (createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

    const res = await updateInviteStatusAction('invite-1', 'approved');
    expect(res.success).toBe(false);
    expect(res.error).toContain('processed by another administrator');
  });

  it('cleanly returns metrics and dynamic template tuples on successful administrative lookup', async () => {
    mockSupabase = {
      auth: { 
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } } }),
        admin: {
          listUsers: jest.fn().mockResolvedValue({ data: { users: [{ id: 'user-1', email: 'auth@user1.com', created_at: '2026-05-01' }] }, error: null })
        }
      },
      from: jest.fn().mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockImplementation((query, opts) => {
              if (opts?.count === 'exact') {
                return { order: jest.fn().mockResolvedValue({ data: [{ id: 'user-1', email: 'user1@test.com', tier: 'standard' }], count: 42, error: null }) };
              }
              return { eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }) }) };
            })
          };
        }
        if (table === 'expenses') {
          return {
            select: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({ 
                data: [{ user_id: 'user-a' }, { user_id: 'user-b' }, { user_id: 'user-a' }], 
                error: null 
              })
            })
          };
        }
        if (table === 'email_templates') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'invite_approval', subject: 'Dynamic Sub', html_body: '<b>Yo</b>' }, error: null })
              })
            })
          };
        }
        if (table === 'invite_requests') {
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [{ id: '1', email: 'test@example.com', status: 'pending' }], error: null })
            })
          };
        }
      })
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    (createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

    const res = await getInviteRequestsAction();
    expect(res.success).toBe(true);
    expect(res.totalRegisteredAccounts).toBe(42);
    expect(res.activePast7Days).toBe(2);
    expect(res.emailTemplate?.subject).toBe('Dynamic Sub');
    expect(res.data).toHaveLength(1);
    expect(res.profiles).toHaveLength(1);
    expect(res.profiles?.[0].email).toBe('auth@user1.com');
  });

  it('rejects updateUserTierAction with invalid parameters', async () => {
    const res = await updateUserTierAction('', 'premium');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Invalid input parameters.');
  });

  it('mutates user subscription tiers securely with admin verification', async () => {
    mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } } }) },
      from: jest.fn().mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: { id: 'user-1', tier: 'premium' }, error: null })
                })
              })
            })
          };
        }
      })
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    (createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

    const res = await updateUserTierAction('user-1', 'premium');
    expect(res.success).toBe(true);
    expect(res.data?.tier).toBe('premium');
  });

  // 1. Configuration Failures
  it('returns configuration error if env vars are missing', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    mockSupabase = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } } }) } };
    const { createClient } = require('@/utils/supabase/server');
    const { getInviteRequestsAction } = require('@/app/actions/admin');
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    const res = await getInviteRequestsAction();
    expect(res.success).toBe(false);
    expect(res.error).toBe('Server configuration error.');
    
    process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
  });

  // 2. Partial Promise.allSettled Query Rejections
  it('handles partial Promise.allSettled rejections gracefully', async () => {
    mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } } }) },
    };
    const { createClient } = require('@/utils/supabase/server');
    const { createClient: createServiceClient } = require('@supabase/supabase-js');
    const { getInviteRequestsAction } = require('@/app/actions/admin');
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    const mockServiceClient = {
      from: jest.fn().mockImplementation((table) => {
        if (table === 'invite_requests') return { select: jest.fn().mockReturnValue({ order: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'profiles') return { select: jest.fn().mockReturnValue({ order: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'expenses') return { select: jest.fn().mockReturnValue({ gte: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'email_templates') return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Template error' } }) }) }) };
      }),
      auth: { admin: { listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }) } }
    };
    (createServiceClient as jest.Mock).mockReturnValue(mockServiceClient);

    const res = await getInviteRequestsAction();
    expect(res.success).toBe(true);
    expect(res.emailTemplate).toBeUndefined();
    
    mockServiceClient.from.mockImplementation((table) => {
      if (table === 'invite_requests') return { select: jest.fn().mockReturnValue({ order: jest.fn().mockResolvedValue({ data: null, error: { message: 'Invite error' } }) }) };
      if (table === 'profiles') return { select: jest.fn().mockReturnValue({ order: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
      if (table === 'expenses') return { select: jest.fn().mockReturnValue({ gte: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
      if (table === 'email_templates') return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: null, error: null }) }) }) };
    });
    
    const res2 = await getInviteRequestsAction();
    expect(res2.success).toBe(false);
    expect(res2.error).toBe('Failed to fetch invitation requests.');
  });

  // 3. Auth Admin User List Pagination & Error Resilience
  it('paginates auth user list and handles listUsers errors resiliently', async () => {
    mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } } }) },
    };
    const { createClient } = require('@/utils/supabase/server');
    const { createClient: createServiceClient } = require('@supabase/supabase-js');
    const { getInviteRequestsAction } = require('@/app/actions/admin');
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    let pageCallCount = 0;
    const mockServiceClient = {
      from: jest.fn().mockImplementation((table) => {
        if (table === 'invite_requests') return { select: jest.fn().mockReturnValue({ order: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'profiles') return { select: jest.fn().mockImplementation((query, opts) => {
          if (opts?.count === 'exact') return { order: jest.fn().mockResolvedValue({ data: [{ id: 'user-1' }, { id: 'user-2' }], count: 2, error: null }) };
          return { eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }) }) };
        })};
        if (table === 'expenses') return { select: jest.fn().mockReturnValue({ gte: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'email_templates') return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: null, error: null }) }) }) };
      }),
      auth: { admin: { listUsers: jest.fn().mockImplementation(() => {
        pageCallCount++;
        if (pageCallCount === 1) return Promise.resolve({ data: { users: Array(1000).fill({ id: 'dummy' }) }, error: null });
        if (pageCallCount === 2) return Promise.resolve({ data: { users: [{ id: 'user-1', email: 'user1@paginated.com' }] }, error: null });
        return Promise.resolve({ data: { users: [] }, error: null });
      })}}
    };
    (createServiceClient as jest.Mock).mockReturnValue(mockServiceClient);

    const res = await getInviteRequestsAction();
    expect(res.success).toBe(true);
    expect(pageCallCount).toBe(2);
    const u1 = res.profiles?.find((p: any) => p.id === 'user-1');
    expect(u1?.email).toBe('user1@paginated.com');
    
    mockServiceClient.auth.admin.listUsers.mockRejectedValueOnce(new Error('Network drop'));
    const res2 = await getInviteRequestsAction();
    expect(res2.success).toBe(true);
  });

  // 4. Empty Subject & Body Validation in updateEmailTemplateAction
  it('rejects updateEmailTemplateAction with empty subject or body', async () => {
    mockSupabase = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } } }) } };
    const { createClient } = require('@/utils/supabase/server');
    const { createClient: createServiceClient } = require('@supabase/supabase-js');
    const { updateEmailTemplateAction } = require('@/app/actions/admin');
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    (createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

    const res = await updateEmailTemplateAction('   ', 'Body');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Subject and HTML content cannot be empty whitespace.');

    const res2 = await updateEmailTemplateAction('Sub', '   ');
    expect(res2.success).toBe(false);
    expect(res2.error).toBe('Subject and HTML content cannot be empty whitespace.');
  });

  // 5. Resend API Network Error Handling & Rollback
  it('rolls back status if Resend API fails or throws network error', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockSupabase = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } } }) } };
    const { createClient } = require('@/utils/supabase/server');
    const { createClient: createServiceClient } = require('@supabase/supabase-js');
    const { updateInviteStatusAction } = require('@/app/actions/admin');
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: 'invite-1', status: 'processing' }, error: null })
          })
        })
      })
    });

    const mockServiceClient = {
      from: jest.fn().mockImplementation((table) => {
        if (table === 'invite_requests') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { id: 'invite-1', status: 'pending', email: 'test@domain.com' }, error: null }) })
            }),
            update: mockUpdate
          };
        }
        if (table === 'email_templates') {
          return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: null, error: null }) }) }) };
        }
      }),
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } } }) }
    };
    (createServiceClient as jest.Mock).mockReturnValue(mockServiceClient);

    const originalFetch = global.fetch;

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValue('Bad Request')
    }) as any;
    const res = await updateInviteStatusAction('invite-1', 'approved');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Email dispatch failed');
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'pending' });

    global.fetch = jest.fn().mockRejectedValue(new Error('Network down')) as any;
    const res2 = await updateInviteStatusAction('invite-1', 'approved');
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('Network error communicating with mail relay');
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'pending' });

    global.fetch = originalFetch;
  });

  // 6. updateUserTierAction Local Environment Bypass Check (isLocalEnv)
  it('bypasses admin check for updateUserTierAction in local environment', async () => {
    const origEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });
    
    mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1', app_metadata: { role: 'user' } } } }) },
      from: jest.fn().mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { role: 'user' } }) })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: { id: 'user-2', tier: 'premium' }, error: null })
                })
              })
            })
          };
        }
      })
    };
    const { createClient } = require('@/utils/supabase/server');
    const { createClient: createServiceClient } = require('@supabase/supabase-js');
    const { updateUserTierAction } = require('@/app/actions/admin');
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    (createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

    const res = await updateUserTierAction('user-2', 'premium');
    expect(res.success).toBe(true);

    Object.defineProperty(process.env, 'NODE_ENV', { value: origEnv, writable: true });
  });
});
