export type WithdrawalStrategy =
  | 'constant_dollar'
  | 'percent_of_portfolio'
  | 'one_over_n'
  | 'vpw'
  | 'cvpw'
  | 'dynamic_swr'
  | 'guyton_klinger'
  | 'vanguard_dynamic'
  | 'endowment'
  | 'rule_95'
  | 'cape_based'
  | 'sensible'
  | 'hebeler_autopilot';

export interface CashFlow {
  name: string;
  annualAmount: number;
  startYearOffset: number;
  duration: number;
  inflated: boolean;
  inflationStart: 'immediately' | 'when_starts';
}

export interface QuickCheckParams {
  initialPortfolio: number;
  annualWithdrawal: number;
  duration: number;
  equities: number;
  bonds: number;
  cash: number;
  withdrawalStrategy: WithdrawalStrategy;
}

export interface SimulationConfig {
  id?: string;
  userId?: string;
  householdId?: string;
  initialPortfolio: number;
  duration: number;
  equities: number;
  bonds: number;
  cash: number;
  withdrawalStrategy: WithdrawalStrategy;
  marketDataMode?: 'us' | 'global';
  timelineMode?: 'retirement_only' | 'retirement_and_accumulation';
  currentAge?: number;
  retirementAge?: number;
  additionalContribution?: number;
  simulationMode?: 'historical' | 'monte_carlo';

  // --- Legacy / Base Parameters (kept for compatibility/fallbacks) ---
  initialWithdrawal: number;
  minWithdrawal?: number;
  maxWithdrawal?: number;
  capitalPreservationRule?: boolean;
  prosperityRule?: boolean;
  inflationRule?: boolean;
  percentageRate?: number;
  remainingYearsWeighting?: number;
  vpwInitialRate?: number;
  expectedMarketReturn?: number;
  expectedBondReturn?: number;
  cvpwInitialRate?: number;
  cvpwWeighting?: number;
  dynamicSwrInitialRate?: number;
  portfolioHealthLowerBound?: number;
  portfolioHealthUpperBound?: number;
  guardrailThreshold?: number;
  ceilingPercentage?: number;
  floorPercentage?: number;
  endowmentWeighting?: number;
  rule95TriggerFloor?: number;
  rule95SpendingCut?: number;
  capeInitialRate?: number;
  capeWeighting?: number;
  sensibleBaseRate?: number;
  sensibleExtrasRate?: number;
  hebelerWeighting?: number;

  // --- ficalc.app Global & Guardrail Parameters ---
  retirementStartingAge?: number;
  startYearMin?: number;
  startYearMax?: number;
  minWithdrawalLimitEnabled?: boolean;
  maxWithdrawalLimitEnabled?: boolean;
  minWithdrawalLimit?: number;
  maxWithdrawalLimit?: number;

  // --- ficalc.app Supplemental Cash Flows ---
  additionalIncome?: CashFlow[];
  extraWithdrawals?: CashFlow[];

  // --- ficalc.app Rebalancing & Fees ---
  rebalancePortfolio?: boolean;
  rebalanceFrequency?: number;
  glidePathPace?: 'evenly' | 'slowly' | 'quickly';
  equitiesFee?: number;
  bondsFee?: number;
  cashGrowthRate?: number;

  // --- ficalc.app Strategy-Specific Parameters ---
  annualWithdrawal?: number;
  inflationAdjustedFirstYearWithdrawal?: boolean;
  percentageOfPortfolio?: number;
  gkInitialWithdrawal?: number;
  gkWithdrawalUpperLimit?: number;
  gkWithdrawalLowerLimit?: number;
  gkUpperLimitAdjustment?: number;
  gkLowerLimitAdjustment?: number;
  gkModifiedWithdrawalRule?: boolean;
  gkIgnoreLastFifteenYears?: boolean;
  ninetyFiveWithdrawalRate?: number;
  ninetyFivePercentage?: number;
  capeWithdrawalRate?: number;
  capeWeight?: number;
  cvpwMode?: boolean;
  cvpwRate?: number;
  cvpwTargetPortfolio?: number;
  oneOverNTargetPortfolio?: number;
  sensibleBaseWithdrawalRate?: number;
  sensibleExtrasWithdrawalRate?: number;
  endowmentPreviousWithdrawalRatio?: number;
  endowmentPercentOfPortfolio?: number;
  dynamicSwrRoiAssumption?: number;
  dynamicSwrInflationAssumption?: number;
  hebelerFirstYearWithdrawalRate?: number;
  hebelerPreviousWithdrawalRatio?: number;
  vanguardDynamicSpendingWithdrawalRate?: number;
  vanguardDynamicSpendingFloor?: number;
  vanguardDynamicSpendingCeiling?: number;

  glidePath?: boolean;
  targetEquities?: number;
  glidePathDuration?: number;
}

export interface MarketDataPoint {
  year: number;
  month: number;
  startCpi: number;
  endCpi: number;
  cape: number;
  dividendYields: number;
  stockMarketGrowth: number;
  bondsGrowth: number;
}

export interface SimulationYearResult {
  year: number;
  age: number;
  startBalance: number;
  withdrawal: number;
  realWithdrawal: number;
  portfolioGrowth: number;
  endBalance: number;
  inflationRate: number;
  realEndBalance: number;
  feeDeduction: number;
  equitiesBalance: number;
  bondsBalance: number;
  cashBalance: number;
  dividendYield: number;
  cumulativeInflation: number;
}

export interface SimulationRunResult {
  startYear: number;
  endYear: number;
  isSuccessful: boolean;
  endingBalance: number;
  realEndingBalance: number;
  avgStocksReturn: number;
  avgRealWithdrawal: number;
  years: SimulationYearResult[];
}

export interface YearlyAggregate {
  age: number;
  p10Balance: number;
  p50Balance: number;
  p90Balance: number;
  p10Spend: number;
  p50Spend: number;
  p90Spend: number;
}

export interface SimulationSummary {
  totalRuns: number;
  successfulRuns: number;
  successRate: number;
  medianEndingBalance: number;
  worstEndingBalance: number;
  bestEndingBalance: number;
  volatileSpendingCount: number;
  volatileSpendingPercentage: number;
  largeSpendingCount: number;
  largeSpendingPercentage: number;
  smallSpendingCount: number;
  smallSpendingPercentage: number;
  largeEndPortfolioCount: number;
  largeEndPortfolioPercentage: number;
  smallEndPortfolioCount: number;
  smallEndPortfolioPercentage: number;
  averageLifetimeSpend: number;
  stdDevEndingBalance: number;
  stdDevAllYearsSpending: number;
  stdDevRunAverageSpending: number;
  zeroPortfolioCount: number;
  zeroPortfolioPercentage: number;
  runs: SimulationRunResult[];
  yearlyAggregates: YearlyAggregate[];
  defaultHistogramBins: {
    binMin: number;
    binMax: number;
    count: number;
    label: string;
    startYears: number[];
  }[];
  defaultSpendingBins: {
    binMin: number;
    binMax: number;
    count: number;
    label: string;
    startYears: number[];
  }[];
  balancesBuffer?: Float64Array;
  withdrawalsBuffer?: Float64Array;
  growthBuffer?: Float64Array;
}

export type SimulationResultsSummary = SimulationSummary;
