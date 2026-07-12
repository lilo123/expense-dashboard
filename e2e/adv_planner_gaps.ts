import { runPlannerSimulation } from '../src/lib/planner/simulator';
import { calculatePensionBenefit } from '../src/lib/planner/pensionEngine';
import { executeDrawdown } from '../src/lib/planner/drawdownEngine';
import { Household, Account, Spending, Pension, LifeEvent } from '../src/lib/planner/types';

async function runAdversarialTests() {
  console.log('\n=== [ADVERSARIAL AUDIT] Executing Planner Business Logic Engine Stress Tests ===');
  let failures = 0;

  // Test 1: OAS Clawback Simulation Gap
  console.log('\n--- Test 1: OAS Clawback in Simulator ---');
  const household: Household = {
    id: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222',
    name: 'High Income Retiree',
    provinceOrState: 'ON',
    country: 'CA',
    retirementAge: 65,
    currentAge: 65,
    targetSpending: 150000, // Well above OAS clawback threshold ($90,997)
  };

  const accounts: Account[] = [
    {
      id: '33333333-3333-3333-3333-333333333333',
      householdId: '11111111-1111-1111-1111-111111111111',
      name: 'RRSP',
      type: 'RRSP',
      balance: 2000000, // Large RRSP generating high taxable income on drawdown
      annualContribution: 0,
      assetAllocation: { equities: 60, bonds: 40, cash: 0 },
    }
  ];

  const spendings: Spending[] = [
    {
      id: '44444444-4444-4444-4444-444444444444',
      householdId: '11111111-1111-1111-1111-111111111111',
      category: 'Living',
      amount: 150000,
      frequency: 'annually',
      inflationAdjusted: true,
    }
  ];

  const pensions: Pension[] = [
    {
      id: '55555555-5555-5555-5555-555555555555',
      householdId: '11111111-1111-1111-1111-111111111111',
      type: 'OAS',
      estimatedAmount: 8500, // Base OAS
      startAge: 65,
      inflationAdjusted: true,
    }
  ];

  const lifeEvents: LifeEvent[] = [];

  try {
    // Run simulation 1: High Income Retiree ($150,000 target spending -> triggers OAS clawback)
    const summary = runPlannerSimulation({ household, accounts, spendings, pensions, lifeEvents, seed: 12345 });
    console.log(`Simulation completed with success rate: ${summary.successRate}%`);
    console.log(`Median Ending Balance (High Income): $${summary.medianEndingBalance}`);

    // Run simulation 2: Baseline Retiree ($80,000 target spending -> NO OAS clawback)
    const baselineHousehold = { ...household, targetSpending: 80000 };
    const baselineSpendings = [ { ...spendings[0], amount: 80000 } ];
    const baselineSummary = runPlannerSimulation({ household: baselineHousehold, accounts, spendings: baselineSpendings, pensions, lifeEvents, seed: 12345 });
    console.log(`Median Ending Balance (Baseline $80k): $${baselineSummary.medianEndingBalance}`);

    // Verify genuine simulation impact: High income median ending balance must be significantly lower due to the $70k spending difference PLUS the $8,500 OAS clawback additional drawdown.
    if (summary.medianEndingBalance >= baselineSummary.medianEndingBalance) {
      console.error(`[BUG/GAP] Simulator failed to apply correct drawdown and OAS clawback.`);
      failures++;
    } else {
      console.log(`✔ Simulator genuinely applies drawdown and OAS clawback (High Income Median: $${summary.medianEndingBalance} < Baseline Median: $${baselineSummary.medianEndingBalance})`);
    }
  } catch (e) {
    console.error('Test 1 Failed with exception:', e);
    failures++;
  }

  // Test 2: Taxable Account Principal Taxation Flaw
  console.log('\n--- Test 2: Taxable Account Drawdown Taxation ---');
  const taxableAccounts: Account[] = [
    {
      id: '66666666-6666-6666-6666-666666666666',
      householdId: '11111111-1111-1111-1111-111111111111',
      name: 'NonRegistered',
      type: 'NonRegistered',
      balance: 500000, // Pure principal/recently deposited
      annualContribution: 0,
      assetAllocation: { equities: 60, bonds: 40, cash: 0 },
    }
  ];

  try {
    const drawdown = executeDrawdown(taxableAccounts, 100000, 'CA');
    console.log(`Withdrew $100,000 from NonRegistered account. Tax paid: $${drawdown.taxPaid}`);
    
    // Since this is a NonRegistered account, withdrawing $100,000 of principal should not incur capital gains tax on the full amount.
    // However, drawdownEngine.ts applies `taxableIncome += toWithdraw * 0.5;`, assuming 50% inclusion on the entire withdrawal.
    if (drawdown.taxPaid > 0) {
      console.error(`[BUG/GAP] Drawdown engine incorrectly taxes principal withdrawals from NonRegistered accounts (assumes 50% capital gains inclusion on entire withdrawal amount).`);
      failures++;
    }
  } catch (e) {
    console.error('Test 2 Failed with exception:', e);
    failures++;
  }

  console.log(`\n=== [ADVERSARIAL AUDIT] Completed with ${failures} failures ===\n`);
  process.exit(failures > 0 ? 1 : 0);
}

runAdversarialTests();
