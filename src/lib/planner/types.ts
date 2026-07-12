import { z } from 'zod';

export const HouseholdSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  provinceOrState: z.string(),
  country: z.enum(['US', 'CA']),
  retirementAge: z.number().min(50).max(80),
  currentAge: z.number().min(18).max(80),
  targetSpending: z.number().min(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const AccountSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  name: z.string(),
  type: z.enum(['RRSP', 'TFSA', 'NonRegistered', 'TraditionalIRA', 'RothIRA', '401k', 'Taxable']),
  balance: z.number().min(0),
  annualContribution: z.number().min(0),
  assetAllocation: z.object({
    equities: z.number().min(0).max(100),
    bonds: z.number().min(0).max(100),
    cash: z.number().min(0).max(100),
  }),
  costBasis: z.number().min(0).optional(),
});

export const SpendingSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  category: z.string(),
  amount: z.number().min(0),
  frequency: z.enum(['monthly', 'annually']),
  inflationAdjusted: z.boolean(),
});

export const PensionSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  type: z.enum(['CPP', 'OAS', 'SocialSecurity', 'DefinedBenefit']),
  estimatedAmount: z.number().min(0),
  startAge: z.number().min(60).max(75),
  inflationAdjusted: z.boolean(),
});

export const LifeEventSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  name: z.string(),
  age: z.number().min(18).max(100),
  netCashFlow: z.number(),
});

export const SimulationConfigSchema = z.object({
  initialPortfolio: z.number().min(0),
  duration: z.number().min(1).max(100),
  equities: z.number().min(0).max(100),
  bonds: z.number().min(0).max(100),
  cash: z.number().min(0).max(100),
  withdrawalStrategy: z.enum([
    'constant_dollar',
    'percent_of_portfolio',
    'one_over_n',
    'vpw',
    'cvpw',
    'dynamic_swr',
    'guyton_klinger',
    'vanguard_dynamic',
    'endowment',
    'rule_95',
    'cape_based',
    'sensible',
    'hebeler_autopilot',
  ]),
  marketDataMode: z.enum(['us', 'global']).optional(),
  timelineMode: z.enum(['retirement_only', 'retirement_and_accumulation']).optional(),
  currentAge: z.number().optional(),
  retirementAge: z.number().optional(),
  additionalContribution: z.number().optional(),
  simulationMode: z.enum(['historical', 'monte_carlo']).optional(),
  initialWithdrawal: z.number().min(0),
  rangeSelection: z.enum(['20', '50', '125']).optional(),
});

export const SimulationResultsSummarySchema = z.object({
  totalRuns: z.number(),
  successfulRuns: z.number(),
  successRate: z.number(),
  medianEndingBalance: z.number(),
  worstEndingBalance: z.number(),
  bestEndingBalance: z.number(),
});

export const QuickCheckParamsSchema = z.object({
  currentAge: z.number().min(18).max(80),
  retirementAge: z.number().min(50).max(80),
  currentSavings: z.number().min(0),
  monthlyContribution: z.number().min(0),
  targetRetirementIncome: z.number().min(0),
  country: z.enum(['US', 'CA']),
});

export type Household = z.infer<typeof HouseholdSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type Spending = z.infer<typeof SpendingSchema>;
export type Pension = z.infer<typeof PensionSchema>;
export type LifeEvent = z.infer<typeof LifeEventSchema>;
export type PlannerSimulationConfig = z.infer<typeof SimulationConfigSchema>;
export type SimulationResultsSummary = z.infer<typeof SimulationResultsSummarySchema>;
export type QuickCheckParams = z.infer<typeof QuickCheckParamsSchema>;
