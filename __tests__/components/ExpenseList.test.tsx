import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExpenseList from '@/components/ExpenseList';
import { useExpenseStore } from '@/store/useExpenseStore';
import { bulkDeleteAction } from '@/app/actions';
import { Expense } from '@/types/database';

// Mock useExpenseStore
jest.mock('@/store/useExpenseStore', () => ({
  useExpenseStore: jest.fn(),
}));

// Mock Server Actions
jest.mock('@/app/actions', () => ({
  bulkDeleteAction: jest.fn(),
}));

describe('ExpenseList Component', () => {
  const mockExpenses: Expense[] = [
    {
      id: 'exp-1',
      user_id: 'user-123',
      item: 'Lunch',
      amount: 15.5,
      category_id: 'cat-1',
      date: '2026-05-08',
      created_at: '2026-05-08T00:00:00Z',
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
      categories: { name: 'Transport' },
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
      isSelectMode: false,
      toggleSelectMode: mockToggleSelectMode,
      selectedIds: new Set(),
      toggleSelection: mockToggleSelection,
      deleteSelected: mockDeleteSelected,
      toggleEditModal: mockToggleEditModal,
      toggleBulkEditModal: mockToggleBulkEditModal,
    });

    // Mock confirm dialog
    global.confirm = jest.fn().mockReturnValue(true);
  });

  it('should render the list of expenses', () => {
    render(<ExpenseList />);

    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Food • Fri, May 8')).toBeInTheDocument();
    expect(screen.getByText('$15.50')).toBeInTheDocument();

    expect(screen.getByText('Bus Ticket')).toBeInTheDocument();
    expect(screen.getByText('Transport • Fri, May 8')).toBeInTheDocument();
    expect(screen.getByText('$2.50')).toBeInTheDocument();
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
    const bulkActionsContainer = screen.getByText('Edit Selected').closest('#bulk-actions');
    expect(bulkActionsContainer).toHaveStyle('display: none');
  });

  it('should handle select mode toggle', () => {
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      expenses: mockExpenses,
      isSelectMode: true,
      toggleSelectMode: mockToggleSelectMode,
      selectedIds: new Set(),
      toggleSelection: mockToggleSelection,
      deleteSelected: mockDeleteSelected,
      toggleEditModal: mockToggleEditModal,
      toggleBulkEditModal: mockToggleBulkEditModal,
    });

    render(<ExpenseList />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    const bulkActionsContainer = screen.getByText('Edit Selected').closest('#bulk-actions');
    expect(bulkActionsContainer).toHaveStyle('display: flex');
  });

  it('should handle item click to open edit modal when not in select mode', () => {
    render(<ExpenseList />);

    const item = screen.getByText('Lunch').closest('.expense-item');
    fireEvent.click(item!);

    expect(mockToggleEditModal).toHaveBeenCalledWith('exp-1');
    expect(mockToggleSelection).not.toHaveBeenCalled();
  });

  it('should handle item click to toggle selection when in select mode', () => {
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      expenses: mockExpenses,
      isSelectMode: true,
      toggleSelectMode: mockToggleSelectMode,
      selectedIds: new Set(),
      toggleSelection: mockToggleSelection,
      deleteSelected: mockDeleteSelected,
      toggleEditModal: mockToggleEditModal,
      toggleBulkEditModal: mockToggleBulkEditModal,
    });

    render(<ExpenseList />);

    const item = screen.getByText('Lunch').closest('.expense-item');
    fireEvent.click(item!);

    expect(mockToggleSelection).toHaveBeenCalledWith('exp-1');
    expect(mockToggleEditModal).not.toHaveBeenCalled();
  });

  it('should handle bulk delete', async () => {
    const selectedIds = new Set(['exp-1']);
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      expenses: mockExpenses,
      isSelectMode: true,
      toggleSelectMode: mockToggleSelectMode,
      selectedIds,
      toggleSelection: mockToggleSelection,
      deleteSelected: mockDeleteSelected,
      toggleEditModal: mockToggleEditModal,
      toggleBulkEditModal: mockToggleBulkEditModal,
    });

    (bulkDeleteAction as jest.Mock).mockResolvedValueOnce({ success: true });

    render(<ExpenseList />);

    const deleteBtn = screen.getByRole('button', { name: 'Delete Selected' });
    expect(deleteBtn).not.toBeDisabled();

    fireEvent.click(deleteBtn);

    expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete 1 expense(s)?');
    
    await waitFor(() => {
      expect(bulkDeleteAction).toHaveBeenCalledWith(['exp-1']);
      expect(mockDeleteSelected).toHaveBeenCalled();
    });
  });

  it('should handle bulk edit click', () => {
    const selectedIds = new Set(['exp-1', 'exp-2']);
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      expenses: mockExpenses,
      isSelectMode: true,
      toggleSelectMode: mockToggleSelectMode,
      selectedIds,
      toggleSelection: mockToggleSelection,
      deleteSelected: mockDeleteSelected,
      toggleEditModal: mockToggleEditModal,
      toggleBulkEditModal: mockToggleBulkEditModal,
    });

    render(<ExpenseList />);

    const editBtn = screen.getByRole('button', { name: 'Edit Selected' });
    expect(editBtn).not.toBeDisabled();

    fireEvent.click(editBtn);

    expect(mockToggleBulkEditModal).toHaveBeenCalled();
  });
});
