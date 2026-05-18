import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import AdjustMasterBudgetModal from '@/components/AdjustMasterBudgetModal';
import { createExpenseStore, StoreProvider } from '@/store/useExpenseStore';
import { saveBulkBudgets } from '@/app/actions/budget';

jest.mock('@/app/actions/budget', () => ({
  saveBulkBudgets: jest.fn(),
}));

describe('AdjustMasterBudgetModal', () => {
  const mockCategories = [
    { id: 'cat-1', name: 'Housing', icon: 'Home' },
    { id: 'cat-2', name: 'Food & Dining', icon: 'Utensils' }
  ];

  let store: any;

  beforeEach(() => {
    jest.clearAllMocks();
    store = createExpenseStore({
      categories: mockCategories,
      budgets: [
        { id: 'b1', user_id: 'u1', category_id: null, limit_amount: 500, currency: 'CAD', month: '2026-05' },
        { id: 'b2', user_id: 'u1', category_id: 'cat-1', limit_amount: 1500, currency: 'CAD', month: '2026-05' }
      ],
      displayCurrency: 'CAD',
      profile: { id: 'user-123', display_name: 'Test', base_currency: 'CAD', display_currency: 'CAD', onboarding_status: 'completed', budget_reset_day: 1, ai_tone: 'nurturing', timezone: 'UTC', avatar_url: null, updated_at: '2026-05-10T00:00:00Z' }
    });
  });

  const renderModal = (props: any = {}) => {
    return render(
      <StoreProvider initialData={{ categories: mockCategories, budgets: store.getState().budgets }}>
        <AdjustMasterBudgetModal 
          isOpen={true} 
          onClose={jest.fn()} 
          targetMonth="2026-05" 
          initialAmount={500} 
          {...props} 
        />
      </StoreProvider>
    );
  };

  it('should render nothing if isOpen is false', () => {
    const { container } = renderModal({ isOpen: false });
    expect(container.firstChild).toBeNull();
  });

  it('should hydrate initial state from store budgets and jump to Step 2 if budgets exist', () => {
    renderModal();
    expect(screen.getByText('Allocate May 2026 Budget')).toBeInTheDocument();
    expect(screen.getByText('C$500')).toBeInTheDocument(); // Unallocated
  });

  it('should allow adjusting category allocations and clamp to available ceiling limit', () => {
    renderModal();
    const inputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(inputs[0], { target: { value: '1800' } });
    expect(screen.getByText('C$200')).toBeInTheDocument(); // 2000 - 1800
  });

  it('should handle React 19 useActionState lifecycles using Controlled Promises', async () => {
    const onCloseMock = jest.fn();
    renderModal({ onClose: onCloseMock });

    let resolveAction: any;
    const actionPromise = new Promise(res => { resolveAction = res; });
    (saveBulkBudgets as jest.Mock).mockReturnValue(actionPromise);

    const submitBtn = screen.getByText('Save Allocations');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Assert Phase 2: Pending state
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();

    // Assert Phase 3: Resolved state
    await act(async () => {
      resolveAction({ success: true });
    });

    expect(onCloseMock).toHaveBeenCalled();
  });

  it('should retain form inputs on Server Action rejection and display error alert', async () => {
    renderModal();

    let resolveAction: any;
    const actionPromise = new Promise(res => { resolveAction = res; });
    (saveBulkBudgets as jest.Mock).mockReturnValue(actionPromise);

    const inputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(inputs[0], { target: { value: '1000' } });

    const submitBtn = screen.getByText('Save Allocations');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await act(async () => {
      resolveAction({ success: false, error: 'Database locked' });
    });

    expect(screen.getByText('Database locked')).toBeInTheDocument();
    expect(inputs[0]).toHaveValue('1000'); // Input retained!
  });

  it('should safely handle mid-transition unmount without warnings', async () => {
    const { unmount } = renderModal();

    let resolveAction: any;
    const actionPromise = new Promise(res => { resolveAction = res; });
    (saveBulkBudgets as jest.Mock).mockReturnValue(actionPromise);

    await act(async () => {
      fireEvent.click(screen.getByText('Save Allocations'));
    });

    unmount();

    await act(async () => {
      resolveAction({ success: true });
    });
    // If no unhandled exceptions or act warnings occur, test passes!
  });
});
