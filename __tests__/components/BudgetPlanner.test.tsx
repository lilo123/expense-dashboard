import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import BudgetPlanner from '@/components/BudgetPlanner';
import { saveBulkBudgets } from '@/app/actions/budget';

jest.mock('@/app/actions/budget', () => ({
  saveBulkBudgets: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('BudgetPlanner', () => {
  const mockCategories = [
    { id: 'cat-1', name: 'Housing', icon: 'Home' },
    { id: 'cat-2', name: 'Food & Dining', icon: 'Utensils' }
  ];

  const mockBudgets = [
    { id: 'b1', category_id: null, limit_amount: 500, currency: 'CAD', month: '2026-05' },
    { id: 'b2', category_id: 'cat-1', limit_amount: 1500, currency: 'CAD', month: '2026-05' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderPlanner = (props: any = {}) => {
    return render(
      <BudgetPlanner 
        initialBudgets={mockBudgets}
        categories={mockCategories}
        displayCurrency="CAD"
        initialYear="2026"
        {...props}
      />
    );
  };

  it('should render Year Selector and 12 Month Accordions', () => {
    renderPlanner();
    expect(screen.getByLabelText('Planning Year:')).toBeInTheDocument();
    expect(screen.getByText('January')).toBeInTheDocument();
    expect(screen.getByText('December')).toBeInTheDocument();
  });

  it('should adhere to WAI-ARIA accordion specifications', () => {
    renderPlanner();
    const mayHeader = screen.getByText('May').closest('button');
    expect(mayHeader).toHaveAttribute('aria-expanded', 'false');
    expect(mayHeader).toHaveAttribute('aria-controls', 'panel-2026-05');

    fireEvent.click(mayHeader!);
    expect(mayHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: /may/i })).toBeInTheDocument();
  });

  it('should support keyboard navigation between accordion headers', () => {
    renderPlanner();
    const headers = screen.getAllByRole('button').filter(b => b.id.startsWith('header-2026-'));
    expect(headers.length).toBe(12);

    headers[0].focus();
    fireEvent.keyDown(headers[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(headers[1]);

    fireEvent.keyDown(headers[1], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(headers[0]);
  });

  it('should broadcast expand/collapse actions to aria-live polite announcer', () => {
    renderPlanner();
    fireEvent.click(screen.getByText('Expand All'));
    expect(screen.getByText(/expanded all month accordions/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Collapse All'));
    expect(screen.getByText(/collapsed all month accordions/i)).toBeInTheDocument();
  });

  it('should perform optimistic propagation when Apply to other months is clicked', async () => {
    renderPlanner();
    const mayHeader = screen.getByText('May').closest('button');
    if (mayHeader?.getAttribute('aria-expanded') === 'false') {
      await act(async () => {
        fireEvent.click(mayHeader!);
      });
    }

    let resolveAction: any;
    const actionPromise = new Promise(res => { resolveAction = res; });
    (saveBulkBudgets as jest.Mock).mockReturnValue(actionPromise);

    // 1. Click "Apply to other months" to open modal
    const propagateBtn = screen.getAllByRole('button', { name: /apply to other months/i })[1];
    await act(async () => {
      fireEvent.click(propagateBtn);
    });

    // Verify modal opens
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Apply May Budget')).toBeInTheDocument();

    // 2. Submit modal form
    const applyModalBtn = screen.getByRole('button', { name: /apply budget/i });
    await act(async () => {
      fireEvent.click(applyModalBtn);
    });

    // Assert Phase 2: Pending state and disabled UI
    expect(screen.getByText('Applying...')).toBeInTheDocument();
    expect(applyModalBtn.closest('button')).toBeDisabled();

    // Assert Phase 3: Resolved state
    await act(async () => {
      resolveAction({ success: true });
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/propagated may budget to 7 months/i)).toBeInTheDocument();
  });

  it('should rollback optimistic state on action failure and retain user input', async () => {
    renderPlanner();
    const mayHeader = screen.getByText('May').closest('button');
    if (mayHeader?.getAttribute('aria-expanded') === 'false') {
      await act(async () => {
        fireEvent.click(mayHeader!);
      });
    }

    let resolveAction: any;
    const actionPromise = new Promise(res => { resolveAction = res; });
    (saveBulkBudgets as jest.Mock).mockReturnValue(actionPromise);

    const inputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(inputs[1], { target: { value: '999' } }); // May's input

    const saveBtn = screen.getAllByRole('button', { name: /save month/i })[1]; // May's Save Button
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await act(async () => {
      resolveAction({ success: false, error: 'DB Error' });
    });

    await waitFor(() => {
      expect(screen.getByText('DB Error')).toBeInTheDocument();
    });
    expect(inputs[1]).toHaveValue('999'); // Input retained!
  });

  it('should guard against consecutive duplicate submissions during isPending window', async () => {
    renderPlanner();
    const mayHeader = screen.getByText('May').closest('button');
    if (mayHeader?.getAttribute('aria-expanded') === 'false') {
      await act(async () => {
        fireEvent.click(mayHeader!);
      });
    }

    let resolveAction: any;
    const actionPromise = new Promise(res => { resolveAction = res; });
    (saveBulkBudgets as jest.Mock).mockReturnValue(actionPromise);

    const saveBtn = screen.getAllByRole('button', { name: /save month/i })[1];
    await act(async () => {
      fireEvent.click(saveBtn);
      fireEvent.click(saveBtn); // Second click
    });

    expect(saveBulkBudgets).toHaveBeenCalledTimes(1); // Guarded!
    await act(async () => {
      resolveAction({ success: true });
    });
  });
});
