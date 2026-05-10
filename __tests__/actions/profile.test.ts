import { getProfile, updateProfile, updatePassword } from '@/app/actions/profile';
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
    it('should return success on profile metadata update without email change', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockSupabase.eq.mockResolvedValueOnce({ error: null });

      const res = await updateProfile({
        display_name: 'New Name',
        email: 'test@example.com', // Unchanged
        base_currency: 'VND',
        budget_reset_day: 15,
        ai_tone: 'encouraging',
      });

      expect(res.success).toBe(true);
      expect(res.emailVerificationSent).toBe(false);
      expect(res.message).toContain('saved successfully');
      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled(); // No email update triggered
    });

    it('should trigger Auth email update and return pending flag when email changes', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123', email: 'old@example.com' } },
        error: null,
      });

      mockSupabase.auth.updateUser.mockResolvedValueOnce({ data: {}, error: null });
      mockSupabase.eq.mockResolvedValueOnce({ error: null });

      const res = await updateProfile({
        display_name: 'Katherine Zen',
        email: 'new@example.com', // Changed!
        base_currency: 'CAD',
        budget_reset_day: 1,
        ai_tone: 'nurturing',
      });

      expect(res.success).toBe(true);
      expect(res.emailVerificationSent).toBe(true);
      expect(res.message).toContain('verification link has been sent');
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ email: 'new@example.com' });
    });

    it('should gracefully catch and handle exceptions using the empathetic banner', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      // Database update throws error
      mockSupabase.eq.mockRejectedValueOnce(new Error('DB connection failed'));

      const res = await updateProfile({
        display_name: 'Katherine Zen',
        email: 'test@example.com',
        base_currency: 'CAD',
        budget_reset_day: 1,
        ai_tone: 'nurturing',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('system tripped up'); // empathetic catch-all!
    });
  });

  describe('updatePassword', () => {
    it('should call auth.updateUser to save new password', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSupabase.auth.updateUser.mockResolvedValueOnce({ data: {}, error: null });

      const res = await updatePassword('newSecurePass123');
      expect(res.success).toBe(true);
      expect(res.message).toContain('Password updated');
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newSecurePass123' });
    });
  });
});
