import { getProfile, updateProfile, updateEmail, updatePassword } from '@/app/actions/profile';
import { createClient } from '@/utils/supabase/server';

// Mock Supabase Server client utility
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

describe('Profile Server Actions', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Standard mock Supabase structure
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
        updateUser: jest.fn(),
        signInWithPassword: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('getProfile', () => {
    it('should return Unauthorized if no user session exists', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('No session') });

      const res = await getProfile();
      expect(res.success).toBe(false);
      expect(res.error).toBe('Unauthorized');
    });

    it('should return profile data on successful query', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const mockProfile = {
        id: 'user-123',
        display_name: 'Katherine Zen',
        base_currency: 'CAD',
        budget_reset_day: 1,
        ai_tone: 'nurturing',
      };

      mockSupabase.single.mockResolvedValueOnce({ data: mockProfile, error: null });

      const res = await getProfile();
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockProfile);
    });
  });

  describe('updateProfile', () => {
    it('should return success on profile metadata update', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Fix: Resolve on .select() instead of .eq() to allow chained query execution
      mockSupabase.select.mockResolvedValueOnce({ data: [{ id: 'user-123' }], error: null });

      const res = await updateProfile({
        display_name: 'Katherine Zen',
        base_currency: 'VND',
        budget_reset_day: 15,
        ai_tone: 'encouraging',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('details saved successfully');
    });

    it('should gracefully catch and handle exceptions using the empathetic banner', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Fix: Reject on .select()
      mockSupabase.select.mockRejectedValueOnce(new Error('DB connection failed'));

      const res = await updateProfile({
        display_name: 'Katherine Zen',
        base_currency: 'CAD',
        budget_reset_day: 1,
        ai_tone: 'nurturing',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('system tripped up'); // empathetic catch-all!
    });
  });

  describe('updateEmail', () => {
    it('should call auth.updateUser to request email change with verification link', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123', email: 'old@example.com' } },
        error: null,
      });

      mockSupabase.auth.updateUser.mockResolvedValueOnce({ data: {}, error: null });

      const res = await updateEmail('new@example.com');
      expect(res.success).toBe(true);
      expect(res.message).toContain('Verification links have been sent');
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ email: 'new@example.com' });
    });

    it('should reject update if email is same as current email', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const res = await updateEmail('test@example.com');
      expect(res.success).toBe(false);
      expect(res.error).toContain('enter a different email');
      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('updatePassword', () => {
    it('should verify current credentials first, then update password on re-auth success', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123', email: 'katherine@example.com' } },
        error: null,
      });

      // 1. Mock credentials re-auth sign-in check (succeeds!)
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: null });
      // 2. Mock password save (succeeds!)
      mockSupabase.auth.updateUser.mockResolvedValueOnce({ data: {}, error: null });

      const res = await updatePassword({
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword456',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('updated successfully');
      
      // Assert re-auth check parameters are secure!
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'katherine@example.com',
        password: 'oldPassword123',
      });
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newPassword456' });
    });

    it('should reject password reset immediately if current credentials check fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123', email: 'katherine@example.com' } },
        error: null,
      });

      // 1. Mock credentials re-auth sign-in check (fails!)
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: {},
        error: new Error('Invalid credentials'),
      });

      const res = await updatePassword({
        currentPassword: 'wrongPassword123',
        newPassword: 'newPassword456',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Current password is incorrect');
      
      // Safety Lock: Auth password updater MUST NEVER be called if re-auth rejected!
      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled();
    });
  });
});
