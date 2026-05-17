import { 
  deleteExpenseAction, 
  updateExpenseAction, 
  updateCategoryAction, 
  deleteCategoryAction, 
  bulkDeleteAction, 
  bulkUpdateAction 
} from '@/app/actions';
import { createClient } from '@/utils/supabase/server';

// Mock Next.js cache utilities to avoid loading internal Stream/Web API packages in Jest JSDOM
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Mock Supabase Server client utility
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

describe('Server Actions Authorization Hardening Gate', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Supabase mock representing an unauthenticated / expired session
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('JWT expired or session invalid'),
        }),
      },
      from: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  it('should reject deleteExpenseAction with Unauthorized when unauthenticated', async () => {
    const res = await deleteExpenseAction('expense-123');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Unauthorized');
    // Assert database call was NEVER initiated
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('should reject updateExpenseAction with Unauthorized when unauthenticated', async () => {
    const res = await updateExpenseAction('expense-123', { item: 'Pizza' });
    expect(res.success).toBe(false);
    expect(res.error).toBe('Unauthorized');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('should reject updateCategoryAction with Unauthorized when unauthenticated', async () => {
    const res = await updateCategoryAction('cat-123', 'Rent');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Unauthorized');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('should reject deleteCategoryAction with Unauthorized when unauthenticated', async () => {
    const res = await deleteCategoryAction('cat-123');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Unauthorized');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('should reject bulkDeleteAction with Unauthorized when unauthenticated', async () => {
    const res = await bulkDeleteAction(['expense-1', 'expense-2']);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Unauthorized');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('should reject bulkUpdateAction with Unauthorized when unauthenticated', async () => {
    const res = await bulkUpdateAction(['expense-1'], { date: '2026-05-16' });
    expect(res.success).toBe(false);
    expect(res.error).toBe('Unauthorized');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
