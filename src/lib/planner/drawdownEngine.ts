import { Account } from './types';
import { calculateTax } from './taxEngine';

export interface DrawdownResult {
  remainingAccounts: Account[];
  totalWithdrawn: number;
  taxPaid: number;
  shortfall: number;
  taxableIncome: number;
}

export function executeDrawdown(
  accounts: Account[],
  targetAmount: number,
  country: 'US' | 'CA'
): DrawdownResult {
  const remainingAccounts: Account[] = accounts.map(a => ({
    ...a,
    assetAllocation: { ...a.assetAllocation }
  }));

  let amountNeeded = targetAmount;
  let taxableIncome = 0;
  let totalWithdrawn = 0;

  const order: Record<string, number> = {
    Taxable: 1,
    NonRegistered: 1,
    TraditionalIRA: 2,
    '401k': 2,
    RRSP: 2,
    RothIRA: 3,
    TFSA: 3,
  };

  remainingAccounts.sort((a, b) => (order[a.type] || 99) - (order[b.type] || 99));

  for (const account of remainingAccounts) {
    if (amountNeeded <= 0) break;
    if (account.balance <= 0) continue;

    const available = account.balance;
    const toWithdraw = Math.min(available, amountNeeded);

    amountNeeded -= toWithdraw;
    totalWithdrawn += toWithdraw;

    if (account.type === 'TraditionalIRA' || account.type === '401k' || account.type === 'RRSP') {
      taxableIncome += toWithdraw;
    } else if (account.type === 'Taxable' || account.type === 'NonRegistered') {
      const costBasis = account.costBasis ?? account.balance;
      const growth = Math.max(0, account.balance - costBasis);
      const growthRatio = account.balance > 0 ? growth / account.balance : 0;
      const taxableGrowth = toWithdraw * growthRatio;
      taxableIncome += taxableGrowth * 0.5;
      if (account.balance > 0) {
        account.costBasis = Math.max(0, costBasis * (1 - toWithdraw / account.balance));
      }
    }

    account.balance -= toWithdraw;
  }

  const taxPaid = calculateTax(taxableIncome, country);
  const shortfall = Math.max(0, amountNeeded);

  return {
    remainingAccounts,
    totalWithdrawn,
    taxPaid,
    shortfall,
    taxableIncome,
  };
}
