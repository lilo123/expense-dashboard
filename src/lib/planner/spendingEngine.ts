import { Spending } from './types';

export function calculateTotalSpending(
  spendings: Spending[],
  cumulativeInflation: number = 1.0
): number {
  return spendings.reduce((total, s) => {
    let annualAmount = s.frequency === 'monthly' ? s.amount * 12 : s.amount;
    if (s.inflationAdjusted) {
      annualAmount *= cumulativeInflation;
    }
    return total + annualAmount;
  }, 0);
}

export function adjustSpendingForMarketCondition(
  targetSpending: number,
  portfolioGrowthLastYear: number,
  withdrawalStrategy: string
): number {
  if (withdrawalStrategy === 'guyton_klinger' && portfolioGrowthLastYear < 0) {
    return targetSpending * 0.90;
  }
  if (withdrawalStrategy === 'rule_95') {
    return targetSpending * 0.95;
  }
  return targetSpending;
}
