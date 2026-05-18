import { 
  addRecurringExpenseAction, 
  getRecurringExpensesAction, 
  deleteRecurringExpenseAction 
} from '@/app/actions/recurring';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// Mock Supabase Server client utility
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

// Mock Next.js cache revalidation
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

describe('Recurring Expenses Server Actions Unit Tests', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Supabase mock
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('addRecurringExpenseAction', () => {
    it('should return Unauthorized if no user session exists', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('No session') });

      const res = await addRecurringExpenseAction({
        item: 'Spotify Premium',
        amount: 14.99,
        currency: 'CAD',
        category_id: 'cat-123',
        frequency: 'monthly',
        start_date: '2026-05-11',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Unauthorized');
    });

    it('should successfully write a new weekly schedule config', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const mockConfig = {
        id: 'flow-123',
        user_id: 'user-123',
        item: 'Weekly Spotify',
        amount: 3.50,
        frequency: 'weekly',
        day_of_week: 5, // Friday
        start_date: '2026-05-11',
      };

      mockSupabase.single.mockResolvedValueOnce({ data: mockConfig, error: null });

      const res = await addRecurringExpenseAction({
        item: 'Weekly Spotify',
        amount: 3.50,
        currency: 'CAD',
        category_id: 'cat-123',
        frequency: 'weekly',
        start_date: '2026-05-11',
        day_of_week: 5,
      });

      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockConfig);
      expect(revalidatePath).toHaveBeenCalledWith('/');
    });

    it('should successfully write a new monthly last-day schedule config', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const mockConfig = {
        id: 'flow-456',
        user_id: 'user-123',
        item: 'Monthly Rent',
        amount: 1200,
        frequency: 'monthly',
        is_last_day_of_month: true,
        start_date: '2026-05-11',
      };

      mockSupabase.single.mockResolvedValueOnce({ data: mockConfig, error: null });

      const res = await addRecurringExpenseAction({
        item: 'Monthly Rent',
        amount: 1200,
        currency: 'CAD',
        category_id: 'cat-123',
        frequency: 'monthly',
        start_date: '2026-05-11',
        is_last_day_of_month: true,
      });

      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockConfig);
    });
  });

  describe('getRecurringExpensesAction', () => {
    it('should return list of active recurring expenses', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const mockList = [
        { id: 'flow-1', item: 'Netflix', amount: 18.99, frequency: 'monthly' },
        { id: 'flow-2', item: 'Gym', amount: 45.00, frequency: 'weekly' }
      ];

      // Simulate supabase .select().order() chain
      mockSupabase.order.mockResolvedValueOnce({ data: mockList, error: null });

      const res = await getRecurringExpensesAction();
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockList);
    });
  });

  describe('deleteRecurringExpenseAction', () => {
    it('should successfully call database delete and revalidate', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });
      
      // Support double chaining of .eq().eq()
      mockSupabase.eq
        .mockImplementationOnce(function(this: any) { return this; }) // 1st eq (id)
        .mockResolvedValueOnce({ error: null });                      // 2nd eq (user_id)

      const res = await deleteRecurringExpenseAction('flow-123');
      expect(res.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('recurring_expenses');
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'flow-123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(revalidatePath).toHaveBeenCalledWith('/');
    });
  });
});
