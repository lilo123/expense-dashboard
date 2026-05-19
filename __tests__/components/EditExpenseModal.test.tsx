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

    (bulkUpdateAction as jest.Mock).mockResolvedValue({
      success: true
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
      exchangeRates: { CAD: 1.0, USD: 0.73 },
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

  it('should correctly convert currency and send computed amounts on save', async () => {
    setupStore('exp-oneoff');
    render(<EditExpenseModal />);

    // Locate and change currency select input to 'USD'
    const currencySelect = screen.getByRole('combobox', { name: 'Currency' });
    fireEvent.change(currencySelect, { target: { value: 'USD' } });

    // Keep the amount input at its original '15.5'
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(bulkUpdateAction).toHaveBeenCalledWith(['exp-oneoff'], expect.objectContaining({
        amount: 21.23, // 15.5 USD to CAD: Math.round((15.5 * (1 / 0.73)) * 100) / 100 = 21.23
        original_amount: 15.5,
        original_currency: 'USD',
        currency: 'USD'
      }));
      expect(mockUpdateBulkExpenses).toHaveBeenCalledWith(new Set(['exp-oneoff']), expect.objectContaining({
        amount: 21.23,
        original_amount: 15.5,
        original_currency: 'USD',
        currency: 'USD'
      }));
    });
  });

  it('should NOT update store and close modal if bulkUpdateAction returns a failure response', async () => {
    setupStore('exp-oneoff');
    (bulkUpdateAction as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Database validation error (UUID format mismatch)'
    });

    render(<EditExpenseModal />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    // Wait for the async bulkUpdateAction action to start
    await waitFor(() => {
      expect(bulkUpdateAction).toHaveBeenCalled();
    });

    // Give the microtask queue a tiny bit of time to flush and complete handleSave sequence
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Now verify that store updates & modal closes were NEVER called
    expect(mockUpdateBulkExpenses).not.toHaveBeenCalled();
    expect(mockToggleEditModal).not.toHaveBeenCalled();
  });

  it('should send category_id as null if it is blank preventing UUID format syntax crash', async () => {
    setupStore('exp-oneoff');
    render(<EditExpenseModal />);

    // Change category select to empty value ''
    const categorySelect = screen.getByRole('combobox', { name: 'Category' });
    fireEvent.change(categorySelect, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(bulkUpdateAction).toHaveBeenCalledWith(['exp-oneoff'], expect.objectContaining({
        category_id: null
      }));
    });
  });
});
