import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DealsClient from '@/app/(dashboard)/deals/DealsClient';
import { DealRow } from '@/lib/dealValidators';

jest.mock('@/app/actions/deals', () => ({
  createDealAction: jest.fn(),
  updateDealAction: jest.fn(),
  deleteDealAction: jest.fn(),
  toggleChecklistItemAction: jest.fn(),
}));

describe('DealsClient Component', () => {
  const mockRates = { CAD: 1.0, USD: 0.8 }; // 1 CAD = 0.8 USD, 1 USD = 1.25 CAD

  const mockDeals: DealRow[] = [
    {
      id: 'deal-1',
      user_id: 'user-1',
      company: 'Amex Cobalt',
      type: 'credit_card',
      status: 'active',
      currency: 'CAD',
      bonus_amount: 500,
      open_date: '2026-01-01',
      note: 'Active Cobalt card',
      type_specific_data: { card_name: 'Cobalt', target_spend: 3000, spend_progress: 1500, action_date: '2026-06-01' },
      deal_checklist_items: []
    },
    {
      id: 'deal-2',
      user_id: 'user-1',
      company: 'Chase Sapphire',
      type: 'credit_card',
      status: 'claimed',
      currency: 'USD',
      bonus_amount: 800,
      open_date: '2026-02-01',
      note: 'Claimed bonus',
      type_specific_data: { card_name: 'CSP', target_spend: 4000, spend_progress: 4000, action_date: '2026-05-01' },
      deal_checklist_items: []
    },
    {
      id: 'deal-3',
      user_id: 'user-1',
      company: 'RBC Chequing',
      type: 'bank_account',
      status: 'closed',
      currency: 'CAD',
      bonus_amount: 350,
      open_date: '2026-03-01',
      note: 'Closed account after bonus',
      type_specific_data: { action_date: '2026-07-01' },
      deal_checklist_items: []
    },
    {
      id: 'deal-4',
      user_id: 'user-1',
      company: 'TD High Interest',
      type: 'bank_account',
      status: 'exploring',
      currency: 'CAD',
      bonus_amount: 200,
      open_date: '2026-04-01',
      note: 'Exploring offer',
      type_specific_data: { action_date: '2026-08-01' },
      deal_checklist_items: []
    },
    {
      id: 'deal-5',
      user_id: 'user-1',
      company: 'Scotiabank Gold',
      type: 'credit_card',
      status: 'ready_to_claim',
      currency: 'CAD',
      bonus_amount: 400,
      open_date: '2026-04-15',
      note: 'Hit min spend',
      type_specific_data: { card_name: 'Gold Amex', action_date: '2026-09-01' },
      deal_checklist_items: []
    },
    {
      id: 'deal-6',
      user_id: 'user-1',
      company: 'BMO Inactive',
      type: 'bank_account',
      status: 'canceled',
      currency: 'CAD',
      bonus_amount: 300,
      open_date: '2026-05-01',
      note: 'Canceled deal',
      type_specific_data: { action_date: '2026-10-01' },
      deal_checklist_items: []
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('renders status filter and category filter MultiSelectDropdowns', () => {
    const { container } = render(
      <DealsClient initialDeals={mockDeals} initialDisplayCurrency="CAD" exchangeRates={mockRates} />
    );

    const categoryButton = container.querySelector('#category-filter');
    const statusButton = container.querySelector('#status-filter');

    expect(categoryButton).toBeInTheDocument();
    expect(statusButton).toBeInTheDocument();
  });

  it('filters deals by status when selected in MultiSelectDropdown', () => {
    const { container } = render(
      <DealsClient initialDeals={mockDeals} initialDisplayCurrency="CAD" exchangeRates={mockRates} />
    );

    expect(screen.getByText('Amex Cobalt')).toBeInTheDocument();
    expect(screen.getByText('BMO Inactive')).toBeInTheDocument();

    // Open status filter dropdown
    const statusButton = container.querySelector('#status-filter') as HTMLElement;
    fireEvent.click(statusButton);

    // Click 'Canceled' option checkbox
    const canceledCheckbox = screen.getByLabelText('Canceled');
    fireEvent.click(canceledCheckbox);

    // Only canceled deal should be displayed
    expect(screen.getByText('BMO Inactive')).toBeInTheDocument();
    expect(screen.queryByText('Amex Cobalt')).not.toBeInTheDocument();
    expect(screen.queryByText('Chase Sapphire')).not.toBeInTheDocument();
  });

  it('combines category and status filter (matchCategory && matchStatus)', () => {
    const { container } = render(
      <DealsClient initialDeals={mockDeals} initialDisplayCurrency="CAD" exchangeRates={mockRates} />
    );

    // Filter by category: Credit Card
    const categoryButton = container.querySelector('#category-filter') as HTMLElement;
    fireEvent.click(categoryButton);
    const creditCardCheckbox = screen.getByLabelText('Credit Card');
    fireEvent.click(creditCardCheckbox);

    // Filter by status: Active
    const statusButton = container.querySelector('#status-filter') as HTMLElement;
    fireEvent.click(statusButton);
    const activeCheckbox = screen.getByLabelText('Active');
    fireEvent.click(activeCheckbox);

    // Amex Cobalt is credit_card + active
    expect(screen.getByText('Amex Cobalt')).toBeInTheDocument();
    // Scotiabank Gold is credit_card + ready_to_claim -> hidden
    expect(screen.queryByText('Scotiabank Gold')).not.toBeInTheDocument();
    // RBC Chequing is bank_account + closed -> hidden
    expect(screen.queryByText('RBC Chequing')).not.toBeInTheDocument();
  });

  it('correctly calculates Claimed, Pending, and excludes Canceled deals in CAD', () => {
    render(
      <DealsClient initialDeals={mockDeals} initialDisplayCurrency="CAD" exchangeRates={mockRates} />
    );

    // Claimed = deal-2 (800 USD -> 1000 CAD) + deal-3 (350 CAD) = 1350 CAD
    expect(screen.getByText('Claimed (CAD)')).toBeInTheDocument();
    expect(screen.getByText('CA$1,350')).toBeInTheDocument();

    // Pending = deal-1 (500 CAD) + deal-4 (200 CAD) + deal-5 (400 CAD) = 1100 CAD
    expect(screen.getByText('Pending (CAD)')).toBeInTheDocument();
    expect(screen.getByText('CA$1,100')).toBeInTheDocument();

    // Total = 1350 + 1100 = 2450 CAD
    expect(screen.getByText('Total Value (CAD)')).toBeInTheDocument();
    expect(screen.getByText('CA$2,450')).toBeInTheDocument();

    // Native sub-caption under Total Value: exact unconverted sums (excluding canceled deal-6)
    // CAD native sum = 500 + 350 + 200 + 400 = 1450 CAD
    // USD native sum = 800 USD
    expect(screen.getByText(/Native:\s*CA\$1,450\s*CAD\s*•\s*\$800\s*USD/)).toBeInTheDocument();
  });

  it('toggles display currency to USD and updates sums and pill active state', () => {
    render(
      <DealsClient initialDeals={mockDeals} initialDisplayCurrency="CAD" exchangeRates={mockRates} />
    );

    // Click USD toggle pill
    const usdButton = screen.getByRole('button', { name: 'USD' });
    fireEvent.click(usdButton);

    // Claimed = deal-2 (800 USD) + deal-3 (350 CAD * 0.8 = 280 USD) = 1080 USD
    expect(screen.getByText('Claimed (USD)')).toBeInTheDocument();
    expect(screen.getByText('$1,080')).toBeInTheDocument();

    // Pending = deal-1 (500 * 0.8 = 400 USD) + deal-4 (200 * 0.8 = 160 USD) + deal-5 (400 * 0.8 = 320 USD) = 880 USD
    expect(screen.getByText('Pending (USD)')).toBeInTheDocument();
    expect(screen.getByText('$880')).toBeInTheDocument();

    // Total = 1080 + 880 = 1960 USD
    expect(screen.getByText('Total Value (USD)')).toBeInTheDocument();
    expect(screen.getByText('$1,960')).toBeInTheDocument();

    // Native caption remains unchanged: CA$1,450 CAD • $800 USD
    expect(screen.getByText(/Native:\s*CA\$1,450\s*CAD\s*•\s*\$800\s*USD/)).toBeInTheDocument();

    // Preference persisted to localStorage
    expect(localStorage.getItem('deals_display_currency')).toBe('USD');
  });

  it('renders individual deal cards with their native bonus currency', () => {
    render(
      <DealsClient initialDeals={mockDeals} initialDisplayCurrency="CAD" exchangeRates={mockRates} />
    );

    // Deal cards keep native bonus currency
    expect(screen.getByText('$800')).toBeInTheDocument(); // Chase Sapphire (USD)
    expect(screen.getByText('CA$500')).toBeInTheDocument(); // Amex Cobalt (CAD)
  });

  it('defaults new deal form currency to active display currency', () => {
    render(
      <DealsClient initialDeals={mockDeals} initialDisplayCurrency="CAD" exchangeRates={mockRates} />
    );

    // Switch to USD
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));

    // Open Add Deal Modal
    fireEvent.click(screen.getByRole('button', { name: /add deal/i }));

    // Pick a deal type to advance to step 2
    fireEvent.click(screen.getByText('Credit Card'));

    // Check currency select field value
    const currencySelect = screen.getByLabelText(/currency/i);
    expect(currencySelect).toBeInTheDocument();
    expect(currencySelect).toHaveValue('USD');
  });

  it('sorts deals by amount using FX conversion', () => {
    // mockRates: CAD: 1.0, USD: 0.8
    // deal-1: 500 CAD
    // deal-2: 800 USD -> in CAD: 800 / 0.8 = 1000 CAD
    // In highest-to-lowest, 800 USD (1000 CAD) comes before 500 CAD
    render(
      <DealsClient initialDeals={[mockDeals[0], mockDeals[1]]} initialDisplayCurrency="CAD" exchangeRates={mockRates} />
    );

    // Open sort popover
    fireEvent.click(screen.getByRole('button', { name: /Sort:/i }));

    // Select Amount metric
    const amountRadio = screen.getByLabelText('Amount');
    fireEvent.click(amountRadio);

    const dealTitles = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    expect(dealTitles[0]).toBe('Chase Sapphire'); // 800 USD = 1000 CAD > 500 CAD
    expect(dealTitles[1]).toBe('Amex Cobalt');
  });

  it('handles lowercase currency strings in deals with case-insensitive FX conversion', () => {
    const dealsWithLowercase: DealRow[] = [
      {
        id: 'lc-1',
        user_id: 'user-1',
        company: 'Lowercase USD',
        type: 'credit_card',
        status: 'claimed',
        currency: 'usd',
        bonus_amount: 100,
        open_date: '2026-01-01',
        note: null,
        deal_checklist_items: []
      }
    ];

    render(
      <DealsClient initialDeals={dealsWithLowercase} initialDisplayCurrency="CAD" exchangeRates={mockRates} />
    );

    // 100 usd / 0.8 = 125 CAD
    expect(screen.getByText('Claimed (CAD)')).toBeInTheDocument();
    expect(screen.getAllByText('CA$125').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Native:\s*CA\$0\s*CAD\s*•\s*\$100\s*USD/)).toBeInTheDocument();
  });

  it('safely falls back to default rates when empty exchange rates are passed', () => {
    render(
      <DealsClient initialDeals={[mockDeals[0]]} initialDisplayCurrency="USD" exchangeRates={{} as any} />
    );

    // Default rate for CAD=1.0, USD=0.73 fallback
    // 500 CAD * 0.73 = 365 USD
    expect(screen.getByText('Pending (USD)')).toBeInTheDocument();
    expect(screen.getAllByText('$365').length).toBeGreaterThanOrEqual(1);
  });

  it('gracefully handles deals with custom/invalid currency codes without crashing', () => {
    const dealWithCustomCurrency: DealRow[] = [
      {
        id: 'custom-1',
        user_id: 'user-1',
        company: 'Aeroplan Deal',
        type: 'credit_card',
        status: 'active',
        currency: 'POINTS',
        bonus_amount: 50000,
        open_date: '2026-01-01',
        note: null,
        deal_checklist_items: []
      }
    ];

    render(
      <DealsClient initialDeals={dealWithCustomCurrency} initialDisplayCurrency="CAD" exchangeRates={mockRates} />
    );

    // Card should render without fatal error
    expect(screen.getByText('Aeroplan Deal')).toBeInTheDocument();
    expect(screen.getAllByText(/50,000 POINTS/).length).toBeGreaterThanOrEqual(1);
  });

  it('trims whitespace in search input properly', () => {
    render(
      <DealsClient initialDeals={mockDeals} initialDisplayCurrency="CAD" exchangeRates={mockRates} />
    );

    const searchInput = screen.getByPlaceholderText('Search deals...');
    fireEvent.change(searchInput, { target: { value: '   Cobalt   ' } });

    expect(screen.getByText('Amex Cobalt')).toBeInTheDocument();
    expect(screen.queryByText('Chase Sapphire')).not.toBeInTheDocument();
  });

  it('sorts deals by amount ascending when lowest direction is selected', () => {
    render(
      <DealsClient initialDeals={[mockDeals[0], mockDeals[1]]} initialDisplayCurrency="CAD" exchangeRates={mockRates} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Sort:/i }));
    fireEvent.click(screen.getByLabelText('Amount'));
    fireEvent.click(screen.getByLabelText('Lowest'));

    const dealTitles = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    expect(dealTitles[0]).toBe('Amex Cobalt'); // 500 CAD < 1000 CAD
    expect(dealTitles[1]).toBe('Chase Sapphire');
  });

  it('links all form labels in DealFormModal for accessibility and inspection', () => {
    render(
      <DealsClient initialDeals={mockDeals} initialDisplayCurrency="USD" exchangeRates={mockRates} />
    );

    fireEvent.click(screen.getByRole('button', { name: /add deal/i }));
    fireEvent.click(screen.getByText('Credit Card'));

    expect(screen.getByLabelText('Company')).toHaveAttribute('id', 'deal-company');
    expect(screen.getByLabelText('Status')).toHaveAttribute('id', 'deal-status');
    expect(screen.getByLabelText('Bonus Amount')).toHaveAttribute('id', 'deal-bonus-amount');
    expect(screen.getByLabelText('Currency')).toHaveAttribute('id', 'deal-currency');
    expect(screen.getByLabelText('Open Date')).toHaveAttribute('id', 'deal-open-date');
    expect(screen.getByLabelText('Card Name')).toHaveAttribute('id', 'deal-card-name');
    expect(screen.getByLabelText('Target Spend')).toHaveAttribute('id', 'deal-target-spend');
    expect(screen.getByLabelText('Spend Progress')).toHaveAttribute('id', 'deal-spend-progress');
    expect(screen.getByLabelText('Next Action Date')).toHaveAttribute('id', 'deal-action-date-cc');
    expect(screen.getByLabelText('Note')).toHaveAttribute('id', 'deal-note');
  });
});

