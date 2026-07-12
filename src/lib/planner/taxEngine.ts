export interface TaxBracket {
  threshold: number;
  rate: number;
}

export const US_TAX_BRACKETS_2026: TaxBracket[] = [
  { threshold: 0, rate: 0.10 },
  { threshold: 11600, rate: 0.12 },
  { threshold: 47150, rate: 0.22 },
  { threshold: 100525, rate: 0.24 },
  { threshold: 191950, rate: 0.32 },
  { threshold: 243725, rate: 0.35 },
  { threshold: 609350, rate: 0.37 },
];

export const CA_TAX_BRACKETS_2026: TaxBracket[] = [
  { threshold: 0, rate: 0.15 },
  { threshold: 55867, rate: 0.205 },
  { threshold: 111733, rate: 0.26 },
  { threshold: 173205, rate: 0.29 },
  { threshold: 246752, rate: 0.33 },
];

export function calculateTax(taxableIncome: number, country: 'US' | 'CA'): number {
  if (taxableIncome <= 0) return 0;

  const brackets = country === 'US' ? US_TAX_BRACKETS_2026 : CA_TAX_BRACKETS_2026;
  let totalTax = 0;

  for (let i = 0; i < brackets.length; i++) {
    const currentBracket = brackets[i];
    const nextBracket = brackets[i + 1];

    if (taxableIncome > currentBracket.threshold) {
      const taxableAmountInBracket = nextBracket
        ? Math.min(taxableIncome - currentBracket.threshold, nextBracket.threshold - currentBracket.threshold)
        : taxableIncome - currentBracket.threshold;

      totalTax += taxableAmountInBracket * currentBracket.rate;
    } else {
      break;
    }
  }

  return totalTax;
}

export function calculateAfterTaxIncome(grossIncome: number, country: 'US' | 'CA'): number {
  const tax = calculateTax(grossIncome, country);
  return Math.max(0, grossIncome - tax);
}
