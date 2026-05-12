import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExpenseList from '@/components/ExpenseList';
import { useExpenseStore } from '@/store/useExpenseStore';
import { bulkDeleteAction } from '@/app/actions';
import { Expense, Category } from '@/types/database';

// Mock useExpenseStore
jest.mock('@/store/useExpenseStore', () => ({
  useExpenseStore: jest.fn(),
}));

// Mock Server Actions
jest.mock('@/app/actions', () => ({
  bulkDeleteAction: jest.fn(),
}));

describe('ExpenseList Component', () => {
  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Food' },
    { id: 'cat-2', name: 'Transport' },
    { id: 'cat-3', name: 'Entertainment' },
  ];

  const mockExpenses: Expense[] = [
    {
      id: 'exp-1',
      user_id: 'user-123',
      item: 'Lunch',
      amount: 15.5,
      category_id: 'cat-1',
      date: '2026-05-08',
      created_at: '2026-05-08T00:00:00Z',
      is_recurring: false,
      categories: { name: 'Food' },
    },
    {
      id: 'exp-2',
      user_id: 'user-123',
      item: 'Bus Ticket',
      amount: 2.5,
      category_id: 'cat-2',
      date: '2026-05-08',
      created_at: '2026-05-08T01:00:00Z',
      is_recurring: false,
      categories: { name: 'Transport' },
    },
    {
      id: 'exp-3',
      user_id: 'user-123',
      item: 'Netflix Subscription',
      amount: 18.99,
      category_id: 'cat-3',
      date: '2026-05-09',
      created_at: '2026-05-09T00:00:00Z',
      is_recurring: true,
      recurring_expense_id: 'rec-1',
      categories: { name: 'Entertainment' },
    },
    {
      id: 'exp-4',
      user_id: 'user-123',
      item: 'Groceries',
      amount: 45.0,
      category_id: 'cat-1',
      date: '2026-05-07',
      created_at: '2026-05-07T00:00:00Z',
      is_recurring: false,
      categories: { name: 'Food' },
    },
  ];

  const mockToggleSelectMode = jest.fn();
  const mockToggleSelection = jest.fn();
  const mockDeleteSelected = jest.fn();
  const mockToggleEditModal = jest.fn();
  const mockToggleBulkEditModal = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Default store mock
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      expenses: mockExpenses,
      categories: mockCategories,
      isSelectMode: false,
      toggleSelectMode: mockToggleSelectMode,
      selectedIds: new Set(),
      toggleSelection: mockToggleSelection,
      deleteSelected: mockDeleteSelected,
      toggleEditModal: mockToggleEditModal,
      toggleBulkEditModal: mockToggleBulkEditModal,
      displayCurrency: 'CAD',
      baseCurrency: 'CAD',
      exchangeRates: { CAD: 1.0 },
    });

    global.confirm = jest.fn().mockReturnValue(true);
  });

  it('should render the list of expenses', () => {
    render(<ExpenseList />);

    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Food • Fri, May 8')).toBeInTheDocument();
    expect(screen.getByText('$15.50')).toBeInTheDocument();
  });

  it('should verify glassmorphism classes are applied to items', () => {
    render(<ExpenseList />);

    const items = screen.getAllByRole('checkbox', { hidden: true }).map(el => el.closest('.expense-item'));
    
    items.forEach(item => {
      expect(item).toHaveClass('bg-white/40');
      expect(item).toHaveClass('backdrop-blur-md');
      expect(item).toHaveClass('border');
      expect(item).toHaveClass('rounded-2xl');
    });
  });

  it('should show select button and hide bulk actions initially', () => {
    render(<ExpenseList />);

    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
    const bulkActionsContainer = screen.getByText('Edit').closest('#bulk-actions');
    expect(bulkActionsContainer).toHaveStyle('display: none');
  });

  it('should handle select mode toggle', () => {
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      expenses: mockExpenses,
      categories: mockCategories,
      isSelectMode: true,
      toggleSelectMode: mockToggleSelectMode,
      selectedIds: new Set(),
      toggleSelection: mockToggleSelection,
      deleteSelected: mockDeleteSelected,
      toggleEditModal: mockToggleEditModal,
      toggleBulkEditModal: mockToggleBulkEditModal,
      displayCurrency: 'CAD',
      baseCurrency: 'CAD',
      exchangeRates: { CAD: 1.0 },
    });

    render(<ExpenseList />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    const bulkActionsContainer = screen.getByText('Edit').closest('#bulk-actions');
    expect(bulkActionsContainer).toHaveStyle('display: flex');
  });

  it('should filter expenses by search query', () => {
    render(<ExpenseList />);

    const searchInput = screen.getByPlaceholderText('Search expenses...');
    fireEvent.change(searchInput, { target: { value: 'Bus' } });

    expect(screen.getByText('Bus Ticket')).toBeInTheDocument();
    expect(screen.queryByText('Lunch')).not.toBeInTheDocument();
  });

  it('should filter expenses by category', () => {
    render(<ExpenseList />);

    const dropdownBtn = screen.getByRole('button', { name: 'All Categories' });
    fireEvent.click(dropdownBtn);

    const foodCheckbox = screen.getByRole('checkbox', { name: 'Food' });
    fireEvent.click(foodCheckbox);

    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.queryByText('Bus Ticket')).not.toBeInTheDocument();
  });

  it('should filter expenses by type (recurring) based on is_recurring', () => {
    render(<ExpenseList />);

    const dropdownBtn = screen.getByRole('button', { name: 'All Types' });
    fireEvent.click(dropdownBtn);

    const recurringCheckbox = screen.getByRole('checkbox', { name: 'Recurring' });
    fireEvent.click(recurringCheckbox);

    expect(screen.getByText('Netflix Subscription')).toBeInTheDocument();
    expect(screen.queryByText('Lunch')).not.toBeInTheDocument();
  });

  it('should render recurring icon for recurring expenses based on is_recurring', () => {
    render(<ExpenseList />);

    const netflixItem = screen.getByText('Netflix Subscription').closest('.expense-item');
    expect(netflixItem?.querySelector('[data-testid="recurring-icon"]')).toBeInTheDocument();

    const lunchItem = screen.getByText('Lunch').closest('.expense-item');
    expect(lunchItem?.querySelector('[data-testid="recurring-icon"]')).not.toBeInTheDocument();
  });
});
