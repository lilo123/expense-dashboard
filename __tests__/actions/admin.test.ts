import { getInviteRequestsAction, updateInviteStatusAction, updateEmailTemplateAction } from '@/app/actions/admin';
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

  it('rejects getInviteRequestsAction with Unauthorized when unauthenticated', async () => {
    mockSupabase = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) } };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    const res = await getInviteRequestsAction();
    expect(res.success).toBe(false);
    expect(res.error).toBe('Unauthorized');
  });

  it('rejects updateEmailTemplateAction when profile role is regular user', async () => {
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

    const res = await updateEmailTemplateAction('Sub', 'Body');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Unauthorized: Admin role required.');
  });

  it('safeguards against modifying an already claimed invitation via atomic constraints', async () => {
    mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
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
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
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
              eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { status: 'pending' } }) })
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
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: jest.fn().mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockImplementation((query, opts) => {
              if (opts?.count === 'exact') {
                return Promise.resolve({ data: null, count: 42, error: null });
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
  });
});
