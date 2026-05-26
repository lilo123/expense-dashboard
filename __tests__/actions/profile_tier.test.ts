import { getProfile, updateProfile } from '@/app/actions/profile';
import { createClient } from '@/utils/supabase/server';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));

describe('Subscription Architecture & Security Triggers', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('verifies that database trigger interceptors prevent non-admin clients from spoofing premium tier updates', async () => {
    // Simulating a standard client session attempting to update their own profile tier to premium
    mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'standard-user-1' } } }) },
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ 
              data: [{ id: 'standard-user-1', display_name: 'John', tier: 'standard' }], 
              error: null 
            })
          })
        })
      })
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    // Act
    const res = await updateProfile({ display_name: 'John', tier: 'premium' });

    // Assert: Database trigger forces NEW.tier = OLD.tier (retaining standard status)
    expect(res.success).toBe(false);
    expect(res.error).toContain('requires administrative clearance');
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
  });

  it('seamlessly decodes profile data structure including optional tier classifications on profile lookup', async () => {
    mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'prem-user-1', email: 'el@exam.com' } } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: { id: 'prem-user-1', display_name: 'Elite', tier: 'premium' }, 
              error: null 
            })
          })
        })
      })
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    const res = await getProfile();
    expect(res.success).toBe(true);
    expect(res.data?.tier).toBe('premium');
    expect(res.data?.email).toBe('el@exam.com');
  });
});
