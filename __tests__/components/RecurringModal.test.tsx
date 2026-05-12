import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RecurringModal from '@/components/RecurringModal';
import { useExpenseStore } from '@/store/useExpenseStore';
import { 
  addRecurringExpenseAction, 
  getRecurringExpensesAction, 
  deleteRecurringExpenseAction 
} from '@/app/actions/recurring';
import { Category, RecurringExpense } from '@/types/database';

// Mock useExpenseStore
jest.mock('@/store/useExpenseStore', () => ({
  useExpenseStore: jest.fn(),
}));

// Mock Server Actions
jest.mock('@/app/actions/recurring', () => ({
  addRecurringExpenseAction: jest.fn(),
  getRecurringExpensesAction: jest.fn(),
  deleteRecurringExpenseAction: jest.fn(),
}));

describe('RecurringModal Component Dashboard & Layout Tests', () => {
  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Housing' },
    { id: 'cat-2', name: 'Groceries' },
  ];

  const mockRecurringExpenses: RecurringExpense[] = [
    { 
      id: 'flow-1', 
      user_id: 'user-123', 
      item: 'Spotify subscription', 
      amount: 14.99, 
      currency: 'CAD', 
      category_id: 'cat-1', 
      frequency: 'monthly', 
      start_date: '2026-05-10', 
      next_occurrence: '2026-06-10', 
      is_active: true,
      created_at: '2026-05-10',
      categories: { name: 'Housing' }
    }
  ];

  const mockToggleRecurringModal = jest.fn();
  const mockHydrate = jest.fn();
  const mockRemoveRecurringExpense = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-11T12:00:00Z')); // Freeze clock at May 11, 2026
    
    // Standard mock store setup
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      isRecurringModalOpen: true,
      toggleRecurringModal: mockToggleRecurringModal,
      categories: mockCategories,
      recurringExpenses: mockRecurringExpenses,
      hydrate: mockHydrate,
      removeRecurringExpense: mockRemoveRecurringExpense,
      profile: { base_currency: 'CAD' }
    });

    (getRecurringExpensesAction as jest.Mock).mockResolvedValue({
      success: true,
      data: mockRecurringExpenses
    });

    global.alert = jest.fn();
    global.confirm = jest.fn().mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render active configs list with Next execution column by default', async () => {
    render(<RecurringModal />);

    expect(screen.getByRole('heading', { name: 'Recurring Expense' })).toBeInTheDocument();
    expect(screen.getByText('Spotify subscription')).toBeInTheDocument();
    expect(screen.getByText('C$14.99')).toBeInTheDocument();
    
    // Verify Next execution date display!
    expect(screen.getByText('Next entry: Wed, Jun 10')).toBeInTheDocument();
  });

  it('should transition to form view and render the dynamic first execution helper copy', async () => {
    render(<RecurringModal />);
    
    // Switch to Form
    fireEvent.click(screen.getByRole('button', { name: '+ Add New' }));

    expect(screen.getByRole('heading', { name: 'Add Recurring Expense' })).toBeInTheDocument();
    
    // Default monthly Day 1. May 11 -> June 1 (since May 1 is in the past).
    // June 1, 2026 is Monday -> "Mon, Jun 1"
    expect(screen.getByText('First expense will be logged on Mon, Jun 1.')).toBeInTheDocument();
  });

  it('should switch checkbox label to Last Day of the Month and toggle specific day select', async () => {
    render(<RecurringModal />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add New' }));

    // Verify simplified label text!
    const lastDayCheckbox = screen.getByLabelText('Last Day of the Month');
    expect(lastDayCheckbox).toBeInTheDocument();
    expect(lastDayCheckbox).not.toBeChecked(); // unchecked by default

    // Specific day select should be visible
    expect(screen.getByLabelText('Log on Specific Day')).toBeInTheDocument();

    // Check last day
    fireEvent.click(lastDayCheckbox);
    expect(lastDayCheckbox).toBeChecked();
    
    // Specific day select should become invisible
    expect(screen.queryByLabelText('Log on Specific Day')).not.toBeInTheDocument();
  });

  it('should dynamically calculate First expense date on Weekly Day selector change', async () => {
    render(<RecurringModal />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add New' }));

    // Set start date explicitly to '2026-05-11' (Monday)
    const startDateInput = screen.getByLabelText('Start Date');
    fireEvent.change(startDateInput, { target: { value: '2026-05-11' } });

    // Change frequency to Weekly
    const frequencySelect = screen.getByLabelText('Frequency');
    fireEvent.change(frequencySelect, { target: { value: 'weekly' } });

    // Weekly Monday (default dow is 1). May 11 is Mon. First incur is May 11 (Today)!
    expect(screen.getByText('First expense will be logged on Today, May 11.')).toBeInTheDocument();

    // Click Friday (Fri) pill button. Friday in that week is May 15!
    const friPill = screen.getByRole('button', { name: 'Fri' });
    fireEvent.click(friPill);

    // First incur should dynamically update to May 15 (Fri, May 15)!
    expect(screen.getByText('First expense will be logged on Fri, May 15.')).toBeInTheDocument();
  });

  it('should render Ends visual radio selectors and enable/disable fields correctly', async () => {
    render(<RecurringModal />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add New' }));

    // Verify three radio buttons exist
    const neverRadio = screen.getByLabelText('Never');
    const onRadio = screen.getByLabelText('On');
    const afterRadio = screen.getByLabelText('After');

    expect(neverRadio).toBeInTheDocument();
    expect(onRadio).toBeInTheDocument();
    expect(afterRadio).toBeInTheDocument();

    expect(neverRadio).toBeChecked(); // default never

    // Verify inputs are disabled by default
    const endDateInput = screen.getByLabelText('End Date');
    const maxOccursInput = screen.getByLabelText('Number of Runs');

    expect(endDateInput).toBeDisabled();
    expect(maxOccursInput).toBeDisabled();

    // Click "On" (date) radio
    fireEvent.click(onRadio);
    expect(onRadio).toBeChecked();
    expect(endDateInput).toBeEnabled();
    expect(maxOccursInput).toBeDisabled();

    // Click "After" (occurrences) radio
    fireEvent.click(afterRadio);
    expect(afterRadio).toBeChecked();
    expect(endDateInput).toBeDisabled();
    expect(maxOccursInput).toBeEnabled();
  });
});
