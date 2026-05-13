import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddExpenseModal from '@/components/AddExpenseModal';
import { useExpenseStore } from '@/store/useExpenseStore';
import { addExpenseAction } from '@/app/actions';
import { getRecurringExpensesAction } from '@/app/actions/recurring';
import { Category, RecurringExpense } from '@/types/database';

// Mock useExpenseStore
jest.mock('@/store/useExpenseStore', () => ({
  useExpenseStore: jest.fn(),
}));

// Mock Server Actions
jest.mock('@/app/actions', () => ({
  addExpenseAction: jest.fn(),
}));

jest.mock('@/app/actions/recurring', () => ({
  getRecurringExpensesAction: jest.fn(),
}));

describe('AddExpenseModal Component', () => {
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

  const mockToggleAddModal = jest.fn();
  const mockToggleCategoryModal = jest.fn();
  const mockAddExpense = jest.fn();
  const mockHydrate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      isAddModalOpen: true,
      toggleAddModal: mockToggleAddModal,
      categories: mockCategories,
      toggleCategoryModal: mockToggleCategoryModal,
      addExpense: mockAddExpense,
      recurringExpenses: mockRecurringExpenses,
      hydrate: mockHydrate,
      baseCurrency: 'CAD',
      exchangeRates: { CAD: 1.0 },
    });

    (getRecurringExpensesAction as jest.Mock).mockResolvedValue({
      success: true,
      data: mockRecurringExpenses
    });

    global.alert = jest.fn();
  });

  it('should not render when isAddModalOpen is false', () => {
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      isAddModalOpen: false,
      toggleAddModal: mockToggleAddModal,
      categories: mockCategories,
      toggleCategoryModal: mockToggleCategoryModal,
      addExpense: mockAddExpense,
      hydrate: mockHydrate,
      baseCurrency: 'CAD',
      exchangeRates: { CAD: 1.0 },
    });

    const { container } = render(<AddExpenseModal />);
    expect(container.firstChild).toBeNull();
  });

  it('should initialize currency with store baseCurrency preference', () => {
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      isAddModalOpen: true,
      toggleAddModal: mockToggleAddModal,
      categories: mockCategories,
      toggleCategoryModal: mockToggleCategoryModal,
      addExpense: mockAddExpense,
      recurringExpenses: mockRecurringExpenses,
      hydrate: mockHydrate,
      baseCurrency: 'EUR', // Explicitly set to EUR to prove dynamic binding!
      exchangeRates: { EUR: 1.0 },
    });

    render(<AddExpenseModal />);
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveValue('EUR');
  });

  it('should render custom toggle switch', () => {
    render(<AddExpenseModal />);

    expect(screen.getByText('Recurring Expense')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Toggle Recurring Status' })).toBeInTheDocument();
  });

  it('should toggle active states and reveal target template progressive select list', async () => {
    render(<AddExpenseModal />);

    // Toggle ON
    const toggleBtn = screen.getByRole('switch', { name: 'Toggle Recurring Status' });
    fireEvent.click(toggleBtn);

    // Verify select reveals
    expect(screen.getByRole('combobox', { name: 'Recurring Template' })).toBeInTheDocument();
  });

  it('should submit standalone recurring expense successfully', async () => {
    (addExpenseAction as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        id: 'exp-3',
        item: 'Coffee',
        amount: 4.5,
        category_id: 'cat-1',
        date: '2026-05-10T00:00:00.000Z',
        is_recurring: true,
        recurring_expense_id: null
      },
    });

    render(<AddExpenseModal />);

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('What did you buy?'), { target: { value: 'Coffee' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '4.50' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: 'cat-1' } });

    // Toggle ON
    fireEvent.click(screen.getByRole('switch', { name: 'Toggle Recurring Status' }));

    // Submit (leave template blank -> standalone!)
    fireEvent.click(screen.getByRole('button', { name: 'Add Expense' }));

    await waitFor(() => {
      expect(addExpenseAction).toHaveBeenCalledWith(expect.objectContaining({
        item: 'Coffee',
        amount: 4.5,
        category_id: 'cat-1',
        is_recurring: true,
        recurring_expense_id: null
      }));
      expect(mockAddExpense).toHaveBeenCalled();
    });
  });

  it('should submit template-linked recurring expense successfully', async () => {
    (addExpenseAction as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        id: 'exp-3',
        item: 'Coffee',
        amount: 4.5,
        category_id: 'cat-1',
        date: '2026-05-10T00:00:00.000Z',
        is_recurring: true,
        recurring_expense_id: 'rec-1'
      },
    });

    render(<AddExpenseModal />);

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('What did you buy?'), { target: { value: 'Coffee' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '4.50' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: 'cat-1' } });

    // Toggle ON
    fireEvent.click(screen.getByRole('switch', { name: 'Toggle Recurring Status' }));

    // Select Template
    const targetSelect = screen.getByRole('combobox', { name: 'Recurring Template' });
    fireEvent.change(targetSelect, { target: { value: 'rec-1' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Add Expense' }));

    await waitFor(() => {
      expect(addExpenseAction).toHaveBeenCalledWith(expect.objectContaining({
        item: 'Coffee',
        amount: 4.5,
        category_id: 'cat-1',
        is_recurring: true,
        recurring_expense_id: 'rec-1'
      }));
      expect(mockAddExpense).toHaveBeenCalled();
    });
  });
});
