import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddExpenseModal from '@/components/AddExpenseModal';
import { useExpenseStore } from '@/store/useExpenseStore';
import { addExpenseAction } from '@/app/actions';
import { Category } from '@/types/database';

// Mock useExpenseStore
jest.mock('@/store/useExpenseStore', () => ({
  useExpenseStore: jest.fn(),
}));

// Mock Server Actions
jest.mock('@/app/actions', () => ({
  addExpenseAction: jest.fn(),
}));

describe('AddExpenseModal Component', () => {
  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Food' },
    { id: 'cat-2', name: 'Transport' },
  ];

  const mockToggleAddModal = jest.fn();
  const mockToggleCategoryModal = jest.fn();
  const mockAddExpense = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Default store mock
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      isAddModalOpen: true,
      toggleAddModal: mockToggleAddModal,
      categories: mockCategories,
      toggleCategoryModal: mockToggleCategoryModal,
      addExpense: mockAddExpense,
    });

    // Mock window.alert
    global.alert = jest.fn();
  });

  it('should not render when isAddModalOpen is false', () => {
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      isAddModalOpen: false,
      toggleAddModal: mockToggleAddModal,
      categories: mockCategories,
      toggleCategoryModal: mockToggleCategoryModal,
      addExpense: mockAddExpense,
    });

    const { container } = render(<AddExpenseModal />);
    expect(container.firstChild).toBeNull();
  });

  it('should render form fields and categories', () => {
    render(<AddExpenseModal />);

    expect(screen.getByRole('heading', { name: 'Add Expense' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('What did you buy?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Select category' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Food' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Transport' })).toBeInTheDocument();
  });

  it('should show validation alert if fields are missing', () => {
    render(<AddExpenseModal />);

    const submitBtn = screen.getByRole('button', { name: 'Add Expense' });
    fireEvent.click(submitBtn);

    expect(global.alert).toHaveBeenCalledWith('Please fill out all fields.');
    expect(addExpenseAction).not.toHaveBeenCalled();
  });

  it('should handle successful submission', async () => {
    (addExpenseAction as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        id: 'exp-3',
        item: 'Coffee',
        amount: 4.5,
        category_id: 'cat-1',
        date: '2026-05-10T00:00:00.000Z',
        categories: { name: 'Food' },
      },
    });

    render(<AddExpenseModal />);

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('What did you buy?'), { target: { value: 'Coffee' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '4.50' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'cat-1' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: 'Add Expense' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(addExpenseAction).toHaveBeenCalledWith(expect.objectContaining({
        item: 'Coffee',
        amount: 4.5,
        category_id: 'cat-1',
      }));
      expect(mockAddExpense).toHaveBeenCalled();
      expect(mockToggleAddModal).toHaveBeenCalled();
    });
  });

  it('should show empathetic error alert on server failure', async () => {
    (addExpenseAction as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'Something went wrong with our flow, let\'s try that again.', // Empathetic error
    });

    render(<AddExpenseModal />);

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('What did you buy?'), { target: { value: 'Coffee' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '4.50' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'cat-1' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: 'Add Expense' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Something went wrong with our flow, let\'s try that again.');
      expect(mockAddExpense).not.toHaveBeenCalled();
      expect(mockToggleAddModal).not.toHaveBeenCalled();
    });
  });
});
