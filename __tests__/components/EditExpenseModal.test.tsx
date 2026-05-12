import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditExpenseModal from '@/components/EditExpenseModal';
import { useExpenseStore } from '@/store/useExpenseStore';
import { bulkUpdateAction } from '@/app/actions';
import { getRecurringExpensesAction } from '@/app/actions/recurring';
import { Category, RecurringExpense, Expense } from '@/types/database';

// Mock store
jest.mock('@/store/useExpenseStore', () => ({
  useExpenseStore: jest.fn(),
}));

// Mock Server Actions
jest.mock('@/app/actions', () => ({
  bulkUpdateAction: jest.fn(),
  bulkDeleteAction: jest.fn(),
}));

jest.mock('@/app/actions/recurring', () => ({
  getRecurringExpensesAction: jest.fn(),
}));

describe('EditExpenseModal Component', () => {
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

  const mockExpenses: Expense[] = [
    {
      id: 'exp-oneoff',
      user_id: 'user-123',
      item: 'Lunch',
      amount: 15.5,
      category_id: 'cat-1',
      date: '2026-05-08T00:00:00Z',
      created_at: '2026-05-08T00:00:00Z',
      is_recurring: false,
      categories: { name: 'Food' },
    },
    {
      id: 'exp-standalone',
      user_id: 'user-123',
      item: 'Gas Bill',
      amount: 55.0,
      category_id: 'cat-1',
      date: '2026-05-09T00:00:00Z',
      created_at: '2026-05-09T00:00:00Z',
      is_recurring: true,
      recurring_expense_id: null,
      categories: { name: 'Food' },
    },
    {
      id: 'exp-linked',
      user_id: 'user-123',
      item: 'Netflix Subscription',
      amount: 18.99,
      category_id: 'cat-1',
      date: '2026-05-09T00:00:00Z',
      created_at: '2026-05-09T00:00:00Z',
      is_recurring: true,
      recurring_expense_id: 'rec-1',
      categories: { name: 'Food' },
    }
  ];

  const mockToggleEditModal = jest.fn();
  const mockHydrate = jest.fn();
  const mockUpdateBulkExpenses = jest.fn();
  const mockDeleteExpense = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    (getRecurringExpensesAction as jest.Mock).mockResolvedValue({
      success: true,
      data: mockRecurringExpenses
    });
  });

  const setupStore = (editingExpenseId: string) => {
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      isEditModalOpen: true,
      toggleEditModal: mockToggleEditModal,
      editingExpenseId,
      expenses: mockExpenses,
      categories: mockCategories,
      recurringExpenses: mockRecurringExpenses,
      hydrate: mockHydrate,
      updateBulkExpenses: mockUpdateBulkExpenses,
      deleteExpense: mockDeleteExpense,
      baseCurrency: 'CAD',
      exchangeRates: { CAD: 1.0 },
    });
  };

  it('should hydrate standard one-off with custom toggle OFF', async () => {
    setupStore('exp-oneoff');
    render(<EditExpenseModal />);
    
    expect(screen.getByDisplayValue('Lunch')).toBeInTheDocument();
    // Toggle should NOT reveal optional template select dropdown
    expect(screen.queryByRole('combobox', { name: 'Recurring Template' })).not.toBeInTheDocument();
  });

  it('should hydrate standalone recurring correctly (Toggle ON, template blank)', async () => {
    setupStore('exp-standalone');
    render(<EditExpenseModal />);
    
    expect(screen.getByDisplayValue('Gas Bill')).toBeInTheDocument();
    
    // Optional template select dropdown should reveal and value should be empty "" (standalone)
    await waitFor(() => {
      const targetSelect = screen.getByRole('combobox', { name: 'Recurring Template' });
      expect(targetSelect).toHaveValue('');
    });
  });

  it('should hydrate linked recurring correctly (Toggle ON, template matched)', async () => {
    setupStore('exp-linked');
    render(<EditExpenseModal />);
    
    expect(screen.getByDisplayValue('Netflix Subscription')).toBeInTheDocument();
    
    // Optional template select dropdown reveals and matches 'rec-1'
    await waitFor(() => {
      const targetSelect = screen.getByRole('combobox', { name: 'Recurring Template' });
      expect(targetSelect).toHaveValue('rec-1');
    });
  });

  it('should save standalone recurring conversion successfully', async () => {
    setupStore('exp-oneoff');
    render(<EditExpenseModal />);

    // 1. Click custom Tailwind Toggle to switch ON
    const toggleBtn = screen.getByRole('switch', { name: 'Toggle Recurring Status' });
    fireEvent.click(toggleBtn);

    // 2. Verify optional template dropdown reveals, leave it blank (standalone!)
    const targetSelect = screen.getByRole('combobox', { name: 'Recurring Template' });
    expect(targetSelect).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(bulkUpdateAction).toHaveBeenCalledWith(['exp-oneoff'], expect.objectContaining({
        is_recurring: true,
        recurring_expense_id: null
      }));
      expect(mockUpdateBulkExpenses).toHaveBeenCalledWith(new Set(['exp-oneoff']), expect.objectContaining({
        is_recurring: true,
        recurring_expense_id: null
      }));
    });
  });

  it('should save template-linked recurring conversion successfully', async () => {
    setupStore('exp-oneoff');
    render(<EditExpenseModal />);

    // 1. Click custom toggle to switch ON
    const toggleBtn = screen.getByRole('switch', { name: 'Toggle Recurring Status' });
    fireEvent.click(toggleBtn);

    // 2. Select template 'rec-1' inside optional dropdown
    const targetSelect = screen.getByRole('combobox', { name: 'Recurring Template' });
    fireEvent.change(targetSelect, { target: { value: 'rec-1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(bulkUpdateAction).toHaveBeenCalledWith(['exp-oneoff'], expect.objectContaining({
        is_recurring: true,
        recurring_expense_id: 'rec-1'
      }));
      expect(mockUpdateBulkExpenses).toHaveBeenCalledWith(new Set(['exp-oneoff']), expect.objectContaining({
        is_recurring: true,
        recurring_expense_id: 'rec-1'
      }));
    });
  });
});
