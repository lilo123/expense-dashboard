import { getMonthlyBudgets, saveInitialBudgets, reallocateFundsAction, saveBulkBudgets } from '@/app/actions/budget';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

describe('Budget Server Actions', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      rpc: jest.fn(),
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('saveBulkBudgets', () => {
    it('should return Unauthorized if no user session exists', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('No session') });

      const res = await saveBulkBudgets('2026-05', ['2026-05'], []);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Unauthorized');
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should execute save_bulk_budgets_rpc and call revalidatePath on success', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });
      mockSupabase.rpc.mockResolvedValueOnce({ error: null });

      const res = await saveBulkBudgets('2026-05', ['2026-05', '2026-06'], [
        { category_id: 'cat-1', limit_amount: 500, currency: 'CAD' }
      ]);

      expect(res.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('save_bulk_budgets_rpc', {
        p_user_id: 'user-123',
        p_target_months: ['2026-05', '2026-06'],
        p_allocations: [{ category_id: 'cat-1', limit_amount: 500, currency: 'CAD' }]
      });
      expect(revalidatePath).toHaveBeenCalledWith('/');
      expect(revalidatePath).toHaveBeenCalledWith('/budget');
    });

    it('should catch RPC errors, avoid calling revalidatePath, and return serializable error', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });
      mockSupabase.rpc.mockResolvedValueOnce({ error: new Error('Constraint violation') });

      const res = await saveBulkBudgets('2026-05', ['2026-05'], []);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Constraint violation');
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('should catch unhandled exceptions and return empathetic fallback error', async () => {
      mockSupabase.auth.getUser.mockRejectedValueOnce(new Error('DB Down'));

      const res = await saveBulkBudgets('2026-05', ['2026-05'], []);
      expect(res.success).toBe(false);
      expect(res.error).toContain('system tripped up');
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });
});
