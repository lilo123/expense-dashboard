import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CalculatorParams } from '@/app/calculator/CalculatorParams';
import { SimulationConfig, SimulationSummary } from '@/types/simulation';

// Mock next/dynamic to render synchronously
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (fn: any) => {
    return function DynamicComponent(props: any) {
      const { SimulationProvider } = require('../../src/SimulationProvider');
      return <SimulationProvider {...props} />;
    };
  },
}));

// Mock nuqs
let mockQueryState: any = {
  initialPortfolio: 1000000,
  duration: 30,
  equities: 60,
  bonds: 40,
  cash: 0,
  withdrawalStrategy: 'constant_dollar',
  initialWithdrawal: 40000,
  marketDataMode: 'us',
  timelineMode: 'retirement_only',
  currentAge: 30,
  retirementAge: 60,
  additionalContribution: 10000,
  simulationMode: 'historical',
  startYearMin: 1871,
  startYearMax: 2025,
  minWithdrawalLimitEnabled: false,
  maxWithdrawalLimitEnabled: false,
  minWithdrawalLimit: 20000,
  maxWithdrawalLimit: 100000,
  additionalIncome: [],
  extraWithdrawals: [],
  rebalancePortfolio: true,
  rebalanceFrequency: 1,
  glidePathPace: 'evenly',
  equitiesFee: 0.04,
  bondsFee: 0.05,
  cashGrowthRate: 1.5,
  annualWithdrawal: 40000,
  inflationAdjustedFirstYearWithdrawal: true,
};

let mockSetQuery = jest.fn();

jest.mock('nuqs', () => ({
  useQueryStates: jest.fn(() => [mockQueryState, mockSetQuery]),
  parseAsFloat: { withDefault: jest.fn((def) => def) },
  parseAsStringLiteral: jest.fn(() => ({ withDefault: jest.fn((def) => def) })),
  parseAsBoolean: { withDefault: jest.fn((def) => def) },
  parseAsJson: jest.fn(() => ({ withDefault: jest.fn((def) => def) })),
}), { virtual: true });

jest.mock('@hookform/resolvers/zod', () => ({
  zodResolver: jest.fn(() => jest.fn((values) => ({ errors: {}, values }))),
}), { virtual: true });

// Mock SimulationProvider context
let mockSimulationContext: any = {
  config: mockQueryState,
  result: {
    totalRuns: 115,
    successfulRuns: 110,
    successRate: 95.65,
    medianEndingBalance: 1500000,
    worstEndingBalance: 0,
    bestEndingBalance: 5000000,
    volatileSpendingCount: 5,
    volatileSpendingPercentage: 4.34,
    largeSpendingCount: 50,
    largeSpendingPercentage: 43.47,
    smallSpendingCount: 10,
    smallSpendingPercentage: 8.69,
    largeEndPortfolioCount: 40,
    largeEndPortfolioPercentage: 34.78,
    smallEndPortfolioCount: 15,
    smallEndPortfolioPercentage: 13.04,
    averageLifetimeSpend: 1200000,
    stdDevEndingBalance: 500000,
    stdDevAllYearsSpending: 15000,
    stdDevRunAverageSpending: 10000,
    zeroPortfolioCount: 5,
    zeroPortfolioPercentage: 4.34,
    runs: [
      {
        startYear: 1871,
        endYear: 1900,
        isSuccessful: true,
        endingBalance: 1500000,
        realEndingBalance: 1500000,
        avgStocksReturn: 0.07,
        avgRealWithdrawal: 40000,
        years: [
          {
            year: 1871,
            age: 1,
            startBalance: 1000000,
            withdrawal: 40000,
            realWithdrawal: 40000,
            portfolioGrowth: 70000,
            endBalance: 1030000,
            inflationRate: 0.02,
            realEndBalance: 1030000,
            feeDeduction: 450,
            equitiesBalance: 618000,
            bondsBalance: 412000,
            cashBalance: 0,
            dividendYield: 20000,
            cumulativeInflation: 1.0,
          }
        ]
      }
    ],
    yearlyAggregates: [],
    defaultHistogramBins: [],
    defaultSpendingBins: [],
  },
  isCalculating: false,
  updateConfig: jest.fn(),
};

jest.mock('../../src/SimulationProvider', () => ({
  SimulationProvider: ({ children }: any) => <>{children}</>,
  useSimulation: () => mockSimulationContext,
}));

describe('CalculatorParams & Views - M4 UI Toggles & Stress Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. Renders Market Data Source toggle and switches between US and Global modes', async () => {
    render(<CalculatorParams />);
    expect(screen.getByText('Market Data Source')).toBeInTheDocument();
    expect(screen.getByText('US Market (Shiller)')).toBeInTheDocument();
    expect(screen.getByText('Global Market (MSCI)')).toBeInTheDocument();

    const globalRadio = screen.getByLabelText('Global Market (MSCI)');
    await act(async () => {
      fireEvent.click(globalRadio);
    });

    expect(mockSetQuery).toHaveBeenCalled();
  });

  it('2. Renders Simulation Mode toggle and switches between Historical and Monte Carlo modes', async () => {
    render(<CalculatorParams />);
    expect(screen.getByText('Simulation Mode')).toBeInTheDocument();
    expect(screen.getByText('Historical Backtesting')).toBeInTheDocument();
    expect(screen.getByText('Scrambled Monte Carlo')).toBeInTheDocument();

    const monteCarloRadio = screen.getByLabelText('Scrambled Monte Carlo');
    await act(async () => {
      fireEvent.click(monteCarloRadio);
    });

    expect(mockSetQuery).toHaveBeenCalled();
  });

  it('3. Renders Timeline & Accumulation toggle and correctly disables/enables accumulation inputs', async () => {
    const { rerender, container } = render(<CalculatorParams />);
    expect(screen.getByText('Timeline & Accumulation')).toBeInTheDocument();
    expect(screen.getByText('Retirement Period Only')).toBeInTheDocument();
    expect(screen.getByText('Retirement & Accumulation Period')).toBeInTheDocument();

    // In retirement_only mode, inputs should be disabled
    const currentAgeInput = container.querySelector('input[name="currentAge"]');
    const retirementAgeInput = container.querySelector('input[name="retirementAge"]');
    const additionalContribInput = container.querySelector('input[name="additionalContribution"]');

    expect(currentAgeInput).toBeDisabled();
    expect(retirementAgeInput).toBeDisabled();
    expect(additionalContribInput).toBeDisabled();

    // Switch to retirement_and_accumulation mode
    mockQueryState = { ...mockQueryState, timelineMode: 'retirement_and_accumulation' };
    mockSimulationContext = { ...mockSimulationContext, config: mockQueryState };

    rerender(<CalculatorParams />);

    expect(currentAgeInput).not.toBeDisabled();
    expect(retirementAgeInput).not.toBeDisabled();
    expect(additionalContribInput).not.toBeDisabled();
  });

  it('4. Renders SummaryView, PortfolioValueView, AvailableSpendingView, and SimulationsListView in Monte Carlo mode', async () => {
    mockQueryState = { ...mockQueryState, simulationMode: 'monte_carlo' };
    mockSimulationContext = { ...mockSimulationContext, config: mockQueryState };

    render(<CalculatorParams />);

    // Verify Monte Carlo specific labels in SummaryView / SimulationsListView
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Value (Real Dollars)')).toBeInTheDocument();
    expect(screen.getByText('Available Spending')).toBeInTheDocument();
    expect(screen.getByText('Simulations')).toBeInTheDocument();
    expect(screen.getByText('Run #1871')).toBeInTheDocument(); // startYear is 1871, displayed as Run #1871 in Monte Carlo mode
  });

  it('5. Switches to Data & Assumptions tab and renders DataAssumptionsView correctly', async () => {
    render(<CalculatorParams />);
    const dataAssumptionsTabBtn = screen.getByRole('button', { name: 'Data & Assumptions' });
    
    await act(async () => {
      fireEvent.click(dataAssumptionsTabBtn);
    });

    expect(screen.getByText('Data, Methodology & Assumptions')).toBeInTheDocument();
    expect(screen.getByText('Historical Market Data Sources (1871–Present)')).toBeInTheDocument();
    expect(screen.getByText('Methodology & 3-Step Order of Operations')).toBeInTheDocument();
    expect(screen.getByText('Definitions & Formulas for 13 Withdrawal Strategies')).toBeInTheDocument();
  });
});
