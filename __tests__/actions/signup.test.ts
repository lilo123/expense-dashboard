import { signup } from '@/app/(auth)/login/actions';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

describe('Zero-Trust Registration Pre-Validation', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    jest.clearAllMocks();
  });

  it('verifies secret and case-insensitive normalization and blocks unapproved intruders', async () => {
    const mockServiceClient = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue({ data: [], error: null }) })
          })
        })
      })
    };
    (createServiceClient as jest.Mock).mockReturnValue(mockServiceClient);

    const formData = new FormData();
    formData.append('email', 'Unapproved@Intruder.com');
    formData.append('password', 'securepass123');
    formData.append('secret', 'flow-vip');

    await signup(formData);
    expect(redirect).toHaveBeenCalledWith('/login?error=' + encodeURIComponent('Account access denied. This email address has not been approved for early access.') + '&secret=flow-vip');
  });
});
