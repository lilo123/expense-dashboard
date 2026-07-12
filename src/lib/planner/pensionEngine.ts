import { Pension } from './types';

const OAS_CLAWBACK_THRESHOLD = 90997;
const OAS_CLAWBACK_RATE = 0.15;

export function calculatePensionBenefit(
  pension: Pension,
  currentAge: number,
  netIncomeForOas: number = 0
): number {
  if (currentAge < pension.startAge) {
    return 0;
  }

  let baseAmount = pension.estimatedAmount;

  if (pension.type === 'CPP') {
    const diffYears = pension.startAge - 65;
    if (diffYears < 0) {
      const reduction = Math.min(0.36, Math.abs(diffYears) * 0.072);
      baseAmount *= (1 - reduction);
    } else if (diffYears > 0) {
      const increase = Math.min(0.42, diffYears * 0.084);
      baseAmount *= (1 + increase);
    }
  } else if (pension.type === 'SocialSecurity') {
    const diffYears = pension.startAge - 67;
    if (diffYears < 0) {
      const reduction = Math.min(0.30, Math.abs(diffYears) * 0.0667);
      baseAmount *= (1 - reduction);
    } else if (diffYears > 0) {
      const increase = Math.min(0.24, diffYears * 0.08);
      baseAmount *= (1 + increase);
    }
  }

  if (pension.type === 'OAS' && netIncomeForOas > OAS_CLAWBACK_THRESHOLD) {
    const clawback = (netIncomeForOas - OAS_CLAWBACK_THRESHOLD) * OAS_CLAWBACK_RATE;
    baseAmount = Math.max(0, baseAmount - clawback);
  }

  return baseAmount;
}
