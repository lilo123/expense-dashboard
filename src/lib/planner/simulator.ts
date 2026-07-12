import { Household, Account, Spending, Pension, LifeEvent, SimulationResultsSummary } from './types';
import { calculatePensionBenefit } from './pensionEngine';
import { calculateTotalSpending } from './spendingEngine';
import { executeDrawdown } from './drawdownEngine';

function mulberry32(a: number) {
  return function() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimulationInput {
  household: Household;
  accounts: Account[];
  spendings: Spending[];
  pensions: Pension[];
  lifeEvents: LifeEvent[];
  rangeSelection?: '20' | '50' | '125';
  seed?: number; // Added optional seed parameter
}

export function runPlannerSimulation(input: SimulationInput): SimulationResultsSummary {
  const totalRuns = 1000;
  let successfulRuns = 0;
  const endingBalances: number[] = [];
  // Use explicit seed if provided, otherwise generate a dynamic seed for genuine Monte Carlo randomness
  const prng = mulberry32(input.seed !== undefined ? input.seed : Math.floor(Math.random() * 100000000));

  const duration = Math.max(1, input.household.retirementAge - input.household.currentAge + 30);

  for (let run = 0; run < totalRuns; run++) {
    let currentAccounts: Account[] = input.accounts.map(a => ({ ...a, assetAllocation: { ...a.assetAllocation }, costBasis: a.costBasis ?? a.balance }));
    let isSuccessful = true;
    let cumulativeInflation = 1.0;

    for (let year = 0; year < duration; year++) {
      const currentAge = input.household.currentAge + year;
      cumulativeInflation *= 1.025;

      let baseTotalPension = 0;
      for (const p of input.pensions) {
        baseTotalPension += calculatePensionBenefit(p, currentAge, 0);
      }

      let targetSpending = calculateTotalSpending(input.spendings, cumulativeInflation);

      for (const le of input.lifeEvents) {
        if (le.age === currentAge) {
          targetSpending -= le.netCashFlow;
        }
      }

      const initialDrawdownNeeded = Math.max(0, targetSpending - baseTotalPension);
      let drawdownTaxableIncome = 0;

      if (initialDrawdownNeeded > 0) {
        const drawdown = executeDrawdown(currentAccounts, initialDrawdownNeeded, input.household.country);
        currentAccounts = drawdown.remainingAccounts;
        drawdownTaxableIncome = drawdown.taxableIncome;
        if (drawdown.shortfall > 0) {
          isSuccessful = false;
        }
      }

      const netIncomeForOas = baseTotalPension + drawdownTaxableIncome;
      let actualTotalPension = 0;
      for (const p of input.pensions) {
        actualTotalPension += calculatePensionBenefit(p, currentAge, netIncomeForOas);
      }

      const clawbackShortfall = baseTotalPension - actualTotalPension;
      if (clawbackShortfall > 0) {
        const additionalDrawdown = executeDrawdown(currentAccounts, clawbackShortfall, input.household.country);
        currentAccounts = additionalDrawdown.remainingAccounts;
        if (additionalDrawdown.shortfall > 0) {
          isSuccessful = false;
        }
      }

      const marketReturn = 0.05 + (prng() * 0.12 - 0.06);
      for (const acc of currentAccounts) {
        acc.balance *= (1 + marketReturn);
      }
    }

    const finalBalance = currentAccounts.reduce((sum, a) => sum + a.balance, 0);
    endingBalances.push(finalBalance);
    if (isSuccessful && finalBalance > 0) {
      successfulRuns++;
    }
  }

  endingBalances.sort((a, b) => a - b);
  const successRate = (successfulRuns / totalRuns) * 100;
  const medianEndingBalance = endingBalances[Math.floor(totalRuns / 2)] || 0;
  const worstEndingBalance = endingBalances[0] || 0;
  const bestEndingBalance = endingBalances[totalRuns - 1] || 0;

  return {
    totalRuns,
    successfulRuns,
    successRate,
    medianEndingBalance,
    worstEndingBalance,
    bestEndingBalance,
  };
}
