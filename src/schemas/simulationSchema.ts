import { z } from 'zod';

export const withdrawalStrategySchema = z.enum([
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
  'hebeler_autopilot'
]);

export const cashFlowSchema = z.object({
  name: z.string(),
  annualAmount: z.number().min(0),
  startYearOffset: z.number().min(0),
  duration: z.number().min(1),
  inflated: z.boolean(),
  inflationStart: z.enum(['immediately', 'when_starts']),
});

export const quickCheckParamsSchema = z.object({
  initialPortfolio: z.number().min(10000).max(10000000),
  annualWithdrawal: z.number().min(1000).max(1000000),
  duration: z.number().min(10).max(65),
  equities: z.number().min(0).max(100),
  bonds: z.number().min(0).max(100),
  cash: z.number().min(0).max(100),
  withdrawalStrategy: withdrawalStrategySchema,
});

export const simulationConfigSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  householdId: z.string().optional(),
  initialPortfolio: z.number().min(10000).max(10000000), // Updated to max 10M
  duration: z.number().min(10).max(65),
  equities: z.number().min(0).max(100),
  bonds: z.number().min(0).max(100),
  cash: z.number().min(0).max(100),
  withdrawalStrategy: withdrawalStrategySchema,
  marketDataMode: z.enum(['us', 'global']).default('us'),
  timelineMode: z.enum(['retirement_only', 'retirement_and_accumulation']).default('retirement_only'),
  currentAge: z.number().min(0).max(150).optional(),
  retirementAge: z.number().min(0).max(150).optional(),
  additionalContribution: z.number().min(0).max(10000000).optional(),
  simulationMode: z.enum(['historical', 'monte_carlo']).default('historical'),
  initialWithdrawal: z.number().min(1000).max(1000000),
  minWithdrawal: z.number().min(0).max(1000000).optional(),
  maxWithdrawal: z.number().min(0).max(1000000).optional(),
  capitalPreservationRule: z.boolean().optional(),
  prosperityRule: z.boolean().optional(),
  inflationRule: z.boolean().optional(),
  glidePath: z.boolean().optional(),
  targetEquities: z.number().min(0).max(100).optional(),
  glidePathDuration: z.number().min(1).max(60).optional(),
  // --- Legacy dynamic parameters ---
  percentageRate: z.number().min(0.1).max(20).optional(),
  remainingYearsWeighting: z.number().min(0.1).max(5).optional(),
  vpwInitialRate: z.number().min(0.1).max(20).optional(),
  expectedMarketReturn: z.number().min(0).max(15).optional(),
  expectedBondReturn: z.number().min(0).max(15).optional(),
  cvpwInitialRate: z.number().min(0.1).max(20).optional(),
  cvpwWeighting: z.number().min(0).max(100).optional(),
  dynamicSwrInitialRate: z.number().min(0.1).max(20).optional(),
  portfolioHealthLowerBound: z.number().min(0.1).max(1.0).optional(),
  portfolioHealthUpperBound: z.number().min(1.0).max(3.0).optional(),
  guardrailThreshold: z.number().min(5).max(50).optional(),
  ceilingPercentage: z.number().min(0).max(20).optional(),
  floorPercentage: z.number().min(0).max(20).optional(),
  endowmentWeighting: z.number().min(0).max(100).optional(),
  rule95TriggerFloor: z.number().min(-50).max(0).optional(),
  rule95SpendingCut: z.number().min(50).max(100).optional(),
  capeInitialRate: z.number().min(0.1).max(20).optional(),
  capeWeighting: z.number().min(0).max(100).optional(),
  sensibleBaseRate: z.number().min(0.1).max(20).optional(),
  sensibleExtrasRate: z.number().min(0).max(50).optional(),
  hebelerWeighting: z.number().min(0).max(100).optional(),
  // --- ficalc.app Global & Guardrail Parameters ---
  retirementStartingAge: z.number().min(0).max(150).optional(),
  startYearMin: z.number().min(1871).max(2025).optional(),
  startYearMax: z.number().min(1871).max(2025).optional(),
  minWithdrawalLimitEnabled: z.boolean().optional(),
  maxWithdrawalLimitEnabled: z.boolean().optional(),
  minWithdrawalLimit: z.number().min(0).max(1000000).optional(),
  maxWithdrawalLimit: z.number().min(0).max(1000000).optional(),
  additionalIncome: z.array(cashFlowSchema).optional(),
  extraWithdrawals: z.array(cashFlowSchema).optional(),
  rebalancePortfolio: z.boolean().optional(),
  rebalanceFrequency: z.number().min(1).max(20).optional(),
  glidePathPace: z.enum(['evenly', 'slowly', 'quickly']).optional(),
  equitiesFee: z.number().min(0).max(10).optional(),
  bondsFee: z.number().min(0).max(10).optional(),
  cashGrowthRate: z.number().min(0).max(20).optional(),
  annualWithdrawal: z.number().min(1000).max(1000000).optional(),
  inflationAdjustedFirstYearWithdrawal: z.boolean().optional(),
  percentageOfPortfolio: z.number().min(0).max(100).optional(),
  gkInitialWithdrawal: z.number().min(0).max(1000000).optional(),
  gkWithdrawalUpperLimit: z.number().min(0).max(100).optional(),
  gkWithdrawalLowerLimit: z.number().min(0).max(100).optional(),
  gkUpperLimitAdjustment: z.number().min(0).max(100).optional(),
  gkLowerLimitAdjustment: z.number().min(0).max(100).optional(),
  gkModifiedWithdrawalRule: z.boolean().optional(),
  gkIgnoreLastFifteenYears: z.boolean().optional(),
  ninetyFiveWithdrawalRate: z.number().min(0).max(100).optional(),
  ninetyFivePercentage: z.number().min(0).max(100).optional(),
  capeWithdrawalRate: z.number().min(0).max(100).optional(),
  capeWeight: z.number().min(0).max(100).optional(),
  cvpwMode: z.boolean().optional(),
  cvpwRate: z.number().min(0).max(100).optional(),
  cvpwTargetPortfolio: z.number().min(0).max(10000000).optional(),
  oneOverNTargetPortfolio: z.number().min(0).max(10000000).optional(),
  sensibleBaseWithdrawalRate: z.number().min(0).max(100).optional(),
  sensibleExtrasWithdrawalRate: z.number().min(0).max(100).optional(),
  endowmentPreviousWithdrawalRatio: z.number().min(0).max(100).optional(),
  endowmentPercentOfPortfolio: z.number().min(0).max(100).optional(),
  dynamicSwrRoiAssumption: z.number().min(0).max(100).optional(),
  dynamicSwrInflationAssumption: z.number().min(0).max(100).optional(),
  hebelerFirstYearWithdrawalRate: z.number().min(0).max(100).optional(),
  hebelerPreviousWithdrawalRatio: z.number().min(0).max(100).optional(),
  vanguardDynamicSpendingWithdrawalRate: z.number().min(0).max(100).optional(),
  vanguardDynamicSpendingFloor: z.number().min(0).max(100).optional(),
  vanguardDynamicSpendingCeiling: z.number().min(0).max(100).optional(),
}).refine((data) => (data.equities + data.bonds + data.cash) === 100, {
  message: 'Asset allocation must equal exactly 100%',
  path: ['equities'],
}).refine((data) => {
  if (data.minWithdrawal !== undefined && data.maxWithdrawal !== undefined) {
    return data.minWithdrawal <= data.maxWithdrawal;
  }
  return true;
}, {
  message: 'Min withdrawal cannot exceed max withdrawal',
  path: ['minWithdrawal'],
}).refine((data) => {
  if (data.minWithdrawalLimitEnabled && data.maxWithdrawalLimitEnabled && data.minWithdrawalLimit !== undefined && data.maxWithdrawalLimit !== undefined) {
    return data.minWithdrawalLimit <= data.maxWithdrawalLimit;
  }
  return true;
}, {
  message: 'Min withdrawal limit cannot exceed max withdrawal limit',
  path: ['minWithdrawalLimit'],
}).refine((data) => !data.glidePath || (data.targetEquities !== undefined && data.targetEquities >= 0 && data.targetEquities <= 100), {
  message: 'Target equities must be between 0 and 100 when glide path is enabled',
  path: ['targetEquities']
}).refine((data) => {
  if (data.timelineMode === 'retirement_and_accumulation') {
    return data.currentAge !== undefined && data.retirementAge !== undefined && data.currentAge <= data.retirementAge;
  }
  return true;
}, {
  message: 'Current age and retirement age must be provided and current age must be less than or equal to retirement age when accumulation is enabled',
  path: ['currentAge'],
});

export type SimulationConfigSchemaType = z.infer<typeof simulationConfigSchema>;
