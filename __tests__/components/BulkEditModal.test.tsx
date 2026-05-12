import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BulkEditModal from '@/components/BulkEditModal';
import { useExpenseStore } from '@/store/useExpenseStore';
import { bulkUpdateAction } from '@/app/actions';
import { getRecurringExpensesAction } from '@/app/actions/recurring';
import { Category, RecurringExpense } from '@/types/database';

// Mock store
jest.mock('@/store/useExpenseStore', () => ({
  useExpenseStore: jest.fn(),
}));

// Mock Server Actions
jest.mock('@/app/actions', () => ({
  bulkUpdateAction: jest.fn(),
}));

jest.mock('@/app/actions/recurring', () => ({
  getRecurringExpensesAction: jest.fn(),
}));

describe('BulkEditModal Component', () => {
  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Food' },
  ];

  const mockRecurringExpenses: RecurringExpense[] = [
    {
      id: 'rec-1',
      user_id: 'user-123',
      item: 'Netflix Subscription',
      amount: 18.99,
      currency: 'CAD',
      category_id: 'cat-3',
      frequency: 'monthly',
      start_date: '2026-05-01',
      next_occurrence: '2026-06-01',
      is_active: true,
      created_at: '2026-05-01T00:00:00Z',
    }
  ];

  const mockToggleBulkEditModal = jest.fn();
  const mockHydrate = jest.fn();
  const mockUpdateBulkExpenses = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      isBulkEditModalOpen: true,
      toggleBulkEditModal: mockToggleBulkEditModal,
      selectedIds: new Set(['exp-1', 'exp-2']),
      categories: mockCategories,
      recurringExpenses: mockRecurringExpenses,
      hydrate: mockHydrate,
      updateBulkExpenses: mockUpdateBulkExpenses,
    });

    (getRecurringExpensesAction as jest.Mock).mockResolvedValue({
      success: true,
      data: mockRecurringExpenses
    });
  });

  it('should bulk edit type to one-off successfully', async () => {
    render(<BulkEditModal />);

    // Select Type "Convert to One-off"
    const select = screen.getByRole('combobox', { name: 'Expense Type' });
    fireEvent.change(select, { target: { value: 'one-off' } });

    fireEvent.click(screen.getByRole('button', { name: 'Apply Changes' }));

    await waitFor(() => {
      expect(bulkUpdateAction).toHaveBeenCalledWith(['exp-1', 'exp-2'], { is_recurring: false, recurring_expense_id: null });
      expect(mockUpdateBulkExpenses).toHaveBeenCalledWith(new Set(['exp-1', 'exp-2']), { is_recurring: false, recurring_expense_id: null });
    });
  });

  it('should bulk edit type to standalone recurring successfully', async () => {
    render(<BulkEditModal />);

    // Select Type "Set as Recurring"
    const select = screen.getByRole('combobox', { name: 'Expense Type' });
    fireEvent.change(select, { target: { value: 'recurring' } });

    // Leave template association blank -> standalone!
    fireEvent.click(screen.getByRole('button', { name: 'Apply Changes' }));

    await waitFor(() => {
      expect(bulkUpdateAction).toHaveBeenCalledWith(['exp-1', 'exp-2'], { is_recurring: true, recurring_expense_id: null });
      expect(mockUpdateBulkExpenses).toHaveBeenCalledWith(new Set(['exp-1', 'exp-2']), { is_recurring: true, recurring_expense_id: null });
    });
  });

  it('should bulk edit type to template-linked recurring successfully', async () => {
    render(<BulkEditModal />);

    // 1. Select Type "Set as Recurring"
    const typeSelect = screen.getByRole('combobox', { name: 'Expense Type' });
    fireEvent.change(typeSelect, { target: { value: 'recurring' } });

    // 2. Target optional template dropdown reveals
    const targetSelect = screen.getByRole('combobox', { name: 'Recurring Template' });
    expect(targetSelect).toBeInTheDocument();

    // 3. Select Netflix template
    fireEvent.change(targetSelect, { target: { value: 'rec-1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Apply Changes' }));

    await waitFor(() => {
      expect(bulkUpdateAction).toHaveBeenCalledWith(['exp-1', 'exp-2'], { is_recurring: true, recurring_expense_id: 'rec-1' });
      expect(mockUpdateBulkExpenses).toHaveBeenCalledWith(new Set(['exp-1', 'exp-2']), { is_recurring: true, recurring_expense_id: 'rec-1' });
    });
  });
});
