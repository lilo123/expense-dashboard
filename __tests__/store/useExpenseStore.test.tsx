import { createExpenseStore } from '@/store/useExpenseStore';
import { Expense, Category, User } from '@/types/database';
import { reallocateFundsAction } from '@/app/actions/budget';

jest.mock('@/app/actions/budget', () => ({
  reallocateFundsAction: jest.fn()
}));

describe('useExpenseStore', () => {
  const mockUser: User = { id: 'user-123', email: 'test@example.com' };
  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Food' },
    { id: 'cat-2', name: 'Transport' },
  ];
  const mockExpenses: Expense[] = [
    {
      id: 'exp-1',
      user_id: 'user-123',
      item: 'Lunch',
      amount: 15.5,
      category_id: 'cat-1',
      date: '2026-05-10',
      created_at: '2026-05-10T00:00:00Z',
      is_recurring: false,
      categories: { name: 'Food' },
    },
    {
      id: 'exp-2',
      user_id: 'user-123',
      item: 'Bus Ticket',
      amount: 2.5,
      category_id: 'cat-2',
      date: '2026-05-10',
      created_at: '2026-05-10T01:00:00Z',
      is_recurring: false,
      categories: { name: 'Transport' },
    },
  ];

  it('should initialize with default values', () => {
    const store = createExpenseStore();
    const state = store.getState();

    expect(state.expenses).toEqual([]);
    expect(state.categories).toEqual([]);
    expect(state.user).toBeNull();
    expect(state.globalError).toBeNull();
    expect(state.isAddModalOpen).toBe(false);
    expect(state.isEditModalOpen).toBe(false);
    expect(state.activeTab).toBe('dashboard');
    expect(state.isSelectMode).toBe(false);
    expect(state.selectedIds.size).toBe(0);
  });

  it('should hydrate with initial data', () => {
    const store = createExpenseStore();
    store.getState().hydrate({
      expenses: mockExpenses,
      categories: mockCategories,
      user: mockUser,
    });

    const state = store.getState();
    expect(state.expenses).toEqual(mockExpenses);
    expect(state.categories).toEqual(mockCategories);
    expect(state.user).toEqual(mockUser);
  });

  it('should synchronize baseCurrency and displayCurrency from database profile on hydration', () => {
    const store = createExpenseStore();
    const mockProfile = {
      id: 'user-123',
      display_name: 'Katherine Zen',
      avatar_url: null,
      base_currency: 'VND' as const,
      display_currency: 'VND' as const,
      budget_reset_day: 15,
      ai_tone: 'encouraging',
      timezone: 'Asia/Ho_Chi_Minh',
      onboarding_status: 'completed' as const,
      updated_at: '2026-05-10T00:00:00Z',
    };

    store.getState().hydrate({
      expenses: [],
      categories: [],
      user: mockUser,
      profile: mockProfile
    });

    const state = store.getState();
    expect(state.profile).toEqual(mockProfile);
    expect(state.baseCurrency).toBe('VND');
    expect(state.displayCurrency).toBe('VND');
  });

  it('should toggle modals correctly', () => {
    const store = createExpenseStore();

    store.getState().toggleAddModal();
    expect(store.getState().isAddModalOpen).toBe(true);
    store.getState().toggleAddModal();
    expect(store.getState().isAddModalOpen).toBe(false);

    store.getState().toggleEditModal('exp-1');
    expect(store.getState().isEditModalOpen).toBe(true);
    expect(store.getState().editingExpenseId).toBe('exp-1');
    store.getState().toggleEditModal();
    expect(store.getState().isEditModalOpen).toBe(false);
    expect(store.getState().editingExpenseId).toBeNull();
  });

  it('should handle tab and filter changes', () => {
    const store = createExpenseStore();

    store.getState().setActiveTab('recent');
    expect(store.getState().activeTab).toBe('recent');

    store.getState().setActiveCategoryFilter('cat-1');
    expect(store.getState().activeCategoryFilter).toBe('cat-1');

    store.getState().setActiveMonthFilter('2026-05');
    expect(store.getState().activeMonthFilter).toBe('2026-05');
  });

  it('should handle selection and bulk actions', () => {
    const store = createExpenseStore();
    store.getState().hydrate({ expenses: mockExpenses, categories: mockCategories });

    // Toggle select mode
    store.getState().toggleSelectMode();
    expect(store.getState().isSelectMode).toBe(true);

    // Toggle selection for exp-1
    store.getState().toggleSelection('exp-1');
    expect(store.getState().selectedIds.has('exp-1')).toBe(true);
    expect(store.getState().selectedIds.has('exp-2')).toBe(false);

    // Toggle selection for exp-1 again (deselect)
    store.getState().toggleSelection('exp-1');
    expect(store.getState().selectedIds.has('exp-1')).toBe(false);

    // Select both
    store.getState().toggleSelection('exp-1');
    store.getState().toggleSelection('exp-2');
    expect(store.getState().selectedIds.size).toBe(2);

    // Bulk update category for selected (exp-1 and exp-2) to cat-2
    store.getState().updateBulkExpenses(store.getState().selectedIds, { category_id: 'cat-2' });
    
    const state = store.getState();
    expect(state.expenses[0].category_id).toBe('cat-2');
    expect(state.expenses[0].categories?.name).toBe('Transport');
    expect(state.expenses[1].category_id).toBe('cat-2');
    expect(state.isSelectMode).toBe(false); // Should exit select mode after bulk update
    expect(state.selectedIds.size).toBe(0); // Should clear selection
  });

  it('should handle bulk delete', () => {
    const store = createExpenseStore();
    store.getState().hydrate({ expenses: mockExpenses });

    store.getState().toggleSelectMode();
    store.getState().toggleSelection('exp-1');
    store.getState().deleteSelected();

    const state = store.getState();
    expect(state.expenses.length).toBe(1);
    expect(state.expenses[0].id).toBe('exp-2');
    expect(state.isSelectMode).toBe(false);
  });

  it('should handle category CRUD and cascade updates', () => {
    const store = createExpenseStore();
    store.getState().hydrate({ expenses: mockExpenses, categories: mockCategories });

    // Add category
    const newCat: Category = { id: 'cat-3', name: 'Utilities' };
    store.getState().addCategory(newCat);
    expect(store.getState().categories.length).toBe(3);
    expect(store.getState().categories[2]).toEqual(newCat);

    // Update category name and verify cascade to expenses
    store.getState().updateCategory('cat-1', 'Healthy Food');
    expect(store.getState().categories.find(c => c.id === 'cat-1')?.name).toBe('Healthy Food');
    expect(store.getState().expenses.find(e => e.id === 'exp-1')?.categories?.name).toBe('Healthy Food');

    // Remove category
    store.getState().removeCategory('cat-3');
    expect(store.getState().categories.length).toBe(2);

    // Update category in expenses (e.g. merge)
    store.getState().updateCategoryInExpenses('cat-1', 'cat-2');
    expect(store.getState().expenses.find(e => e.id === 'exp-1')?.category_id).toBe('cat-2');
    expect(store.getState().expenses.find(e => e.id === 'exp-1')?.categories?.name).toBe('Transport');
  });

  it('should handle expense CRUD', () => {
    const store = createExpenseStore();
    store.getState().hydrate({ expenses: mockExpenses, categories: mockCategories });

    // Add expense
    const newExpense: Expense = {
      id: 'exp-3',
      user_id: 'user-123',
      item: 'Dinner',
      amount: 25.0,
      category_id: 'cat-1',
      date: '2026-05-10',
      created_at: '2026-05-10T02:00:00Z',
      is_recurring: false,
      categories: { name: 'Food' },
    };
    store.getState().addExpense(newExpense);
    expect(store.getState().expenses.length).toBe(3);
    expect(store.getState().expenses[0]).toEqual(newExpense); // Should be prepended

    // Delete expense
    store.getState().deleteExpense('exp-2');
    expect(store.getState().expenses.length).toBe(2);
    expect(store.getState().expenses.find(e => e.id === 'exp-2')).toBeUndefined();
  });

  it('should prevent duplicate expenses in addExpense', () => {
    const store = createExpenseStore();
    store.getState().hydrate({ expenses: mockExpenses });

    // Try to add an expense that already exists (exp-1)
    const duplicateExpense = { ...mockExpenses[0] };
    store.getState().addExpense(duplicateExpense);

    const state = store.getState();
    expect(state.expenses.length).toBe(2);
    // Ensure it didn't duplicate
    const exp1Count = state.expenses.filter(e => e.id === 'exp-1').length;
    expect(exp1Count).toBe(1);
  });

  it('should perform optimistic reallocation and rollback on failure', async () => {
    const store = createExpenseStore();
    const mockBudgets = [
      { id: 'b1', user_id: 'u1', category_id: null, limit_amount: 500, currency: 'CAD', month: '2026-05' },
      { id: 'b2', user_id: 'u1', category_id: 'cat-1', limit_amount: 200, currency: 'CAD', month: '2026-05' },
    ];
    store.getState().hydrate({ budgets: mockBudgets });

    // Mock success
    (reallocateFundsAction as jest.Mock).mockResolvedValueOnce({ success: true });

    const success = await store.getState().executeReallocation(null, 'cat-1', 100, '2026-05');
    expect(success).toBe(true);

    let state = store.getState();
    expect(state.budgets.find(b => b.category_id === null)?.limit_amount).toBe(400);
    expect(state.budgets.find(b => b.category_id === 'cat-1')?.limit_amount).toBe(300);

    // Mock failure
    (reallocateFundsAction as jest.Mock).mockResolvedValueOnce({ success: false, error: 'Server error' });

    const failSuccess = await store.getState().executeReallocation(null, 'cat-1', 50, '2026-05');
    expect(failSuccess).toBe(false);

    state = store.getState();
    // Should rollback to previous state (400 and 300)
    expect(state.budgets.find(b => b.category_id === null)?.limit_amount).toBe(400);
    expect(state.budgets.find(b => b.category_id === 'cat-1')?.limit_amount).toBe(300);
    expect(state.globalError).toBe('Server error');
  });
});
