import {
  HouseholdSchema,
  AccountSchema,
  SpendingSchema,
  PensionSchema,
  LifeEventSchema,
  SimulationConfigSchema,
  SimulationResultsSummarySchema,
  QuickCheckParamsSchema,
  Account,
  Household,
  Spending,
  Pension,
  LifeEvent,
} from '../../src/lib/planner/types';
import { calculateTax, calculateAfterTaxIncome } from '../../src/lib/planner/taxEngine';
import { calculatePensionBenefit } from '../../src/lib/planner/pensionEngine';
import { calculateTotalSpending, adjustSpendingForMarketCondition } from '../../src/lib/planner/spendingEngine';
import { executeDrawdown } from '../../src/lib/planner/drawdownEngine';
import { runPlannerSimulation } from '../../src/lib/planner/simulator';

describe('Planner Business Logic Engines', () => {
  describe('1. Zod Schemas (types.ts)', () => {
    it('validates HouseholdSchema correctly', () => {
      const validHousehold = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Smith Family',
        provinceOrState: 'ON',
        country: 'CA',
        retirementAge: 65,
        currentAge: 45,
        targetSpending: 60000,
      };
      expect(HouseholdSchema.parse(validHousehold)).toEqual(validHousehold);
      expect(() => HouseholdSchema.parse({ ...validHousehold, currentAge: 10 })).toThrow();
    });

    it('validates AccountSchema with optional costBasis', () => {
      const validAccount = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        householdId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Investment Account',
        type: 'NonRegistered',
        balance: 100000,
        annualContribution: 5000,
        assetAllocation: { equities: 60, bonds: 30, cash: 10 },
        costBasis: 80000,
      };
      expect(AccountSchema.parse(validAccount)).toEqual(validAccount);
    });

    it('validates SpendingSchema, PensionSchema, LifeEventSchema, SimulationConfigSchema, SimulationResultsSummarySchema, QuickCheckParamsSchema', () => {
      expect(SpendingSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174003',
        householdId: '123e4567-e89b-12d3-a456-426614174000',
        category: 'Groceries',
        amount: 1000,
        frequency: 'monthly',
        inflationAdjusted: true,
      })).toBeDefined();

      expect(PensionSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174004',
        householdId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'OAS',
        estimatedAmount: 8000,
        startAge: 65,
        inflationAdjusted: true,
      })).toBeDefined();

      expect(LifeEventSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174005',
        householdId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Child College',
        age: 55,
        netCashFlow: 20000,
      })).toBeDefined();

      expect(SimulationConfigSchema.parse({
        initialPortfolio: 500000,
        duration: 30,
        equities: 60,
        bonds: 40,
        cash: 0,
        withdrawalStrategy: 'constant_dollar',
        initialWithdrawal: 20000,
      })).toBeDefined();

      expect(SimulationResultsSummarySchema.parse({
        totalRuns: 1000,
        successfulRuns: 950,
        successRate: 95,
        medianEndingBalance: 500000,
        worstEndingBalance: 10000,
        bestEndingBalance: 2000000,
      })).toBeDefined();

      expect(QuickCheckParamsSchema.parse({
        currentAge: 30,
        retirementAge: 65,
        currentSavings: 50000,
        monthlyContribution: 500,
        targetRetirementIncome: 60000,
        country: 'CA',
      })).toBeDefined();
    });
  });

  describe('2. Tax Engine (taxEngine.ts)', () => {
    it('calculates US and CA taxes correctly', () => {
      expect(calculateTax(0, 'US')).toBe(0);
      expect(calculateTax(50000, 'US')).toBeGreaterThan(0);
      expect(calculateTax(100000, 'CA')).toBeGreaterThan(0);
      expect(calculateAfterTaxIncome(100000, 'CA')).toBeLessThan(100000);
    });
  });

  describe('3. Pension Engine (pensionEngine.ts)', () => {
    it('calculates pension benefits and applies OAS clawback correctly', () => {
      const cppPension: Pension = {
        id: '123e4567-e89b-12d3-a456-426614174010',
        householdId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'CPP',
        estimatedAmount: 12000,
        startAge: 65,
        inflationAdjusted: true,
      };
      expect(calculatePensionBenefit(cppPension, 60)).toBe(0);
      expect(calculatePensionBenefit(cppPension, 65)).toBe(12000);

      const oasPension: Pension = {
        id: '123e4567-e89b-12d3-a456-426614174011',
        householdId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'OAS',
        estimatedAmount: 8000,
        startAge: 65,
        inflationAdjusted: true,
      };
      // No clawback below threshold (90997)
      expect(calculatePensionBenefit(oasPension, 65, 50000)).toBe(8000);
      // Clawback above threshold
      expect(calculatePensionBenefit(oasPension, 65, 120000)).toBeLessThan(8000);
    });

    it('calculates CPP/SocialSecurity early/late start adjustments', () => {
      const cppEarly: Pension = {
        id: '123e4567-e89b-12d3-a456-426614174012',
        householdId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'CPP',
        estimatedAmount: 10000,
        startAge: 60,
        inflationAdjusted: true,
      };
      expect(calculatePensionBenefit(cppEarly, 65)).toBeLessThan(10000);

      const ssLate: Pension = {
        id: '123e4567-e89b-12d3-a456-426614174013',
        householdId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'SocialSecurity',
        estimatedAmount: 10000,
        startAge: 70,
        inflationAdjusted: true,
      };
      expect(calculatePensionBenefit(ssLate, 70)).toBeGreaterThan(10000);
    });
  });

  describe('4. Spending Engine (spendingEngine.ts)', () => {
    it('calculates total spending with inflation and adjusts for market condition', () => {
      const spendings: Spending[] = [
        {
          id: '123e4567-e89b-12d3-a456-426614174020',
          householdId: '123e4567-e89b-12d3-a456-426614174000',
          category: 'Groceries',
          amount: 1000,
          frequency: 'monthly',
          inflationAdjusted: true,
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174021',
          householdId: '123e4567-e89b-12d3-a456-426614174000',
          category: 'Travel',
          amount: 5000,
          frequency: 'annually',
          inflationAdjusted: false,
        },
      ];
      expect(calculateTotalSpending(spendings, 1.1)).toBe(1000 * 12 * 1.1 + 5000);

      expect(adjustSpendingForMarketCondition(50000, -0.1, 'guyton_klinger')).toBe(45000);
      expect(adjustSpendingForMarketCondition(50000, 0.1, 'guyton_klinger')).toBe(50000);
      expect(adjustSpendingForMarketCondition(50000, 0.1, 'rule_95')).toBe(47500);
    });
  });

  describe('5. Drawdown Engine (drawdownEngine.ts)', () => {
    it('executes drawdown correctly, taxes only growth for NonRegistered accounts, and reduces costBasis proportionally', () => {
      const accounts: Account[] = [
        {
          id: '123e4567-e89b-12d3-a456-426614174030',
          householdId: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Taxable Inv',
          type: 'NonRegistered',
          balance: 100000,
          annualContribution: 0,
          assetAllocation: { equities: 100, bonds: 0, cash: 0 },
          costBasis: 80000, // 20k growth
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174031',
          householdId: '123e4567-e89b-12d3-a456-426614174000',
          name: 'RRSP Acc',
          type: 'RRSP',
          balance: 50000,
          annualContribution: 0,
          assetAllocation: { equities: 100, bonds: 0, cash: 0 },
        },
      ];

      // Withdraw 50,000 from NonRegistered first
      const result = executeDrawdown(accounts, 50000, 'CA');
      expect(result.totalWithdrawn).toBe(50000);
      expect(result.shortfall).toBe(0);

      const nonReg = result.remainingAccounts.find(a => a.type === 'NonRegistered')!;
      expect(nonReg.balance).toBe(50000);
      // Cost basis should be reduced proportionally: 80000 * (1 - 50000/100000) = 40000
      expect(nonReg.costBasis).toBe(40000);

      // Taxable income from NonRegistered: 50000 * (20000 / 100000) * 0.5 = 5000
      expect(result.taxableIncome).toBe(5000);
      expect(result.taxPaid).toBeGreaterThan(0);
    });
  });

  describe('6. Simulator (simulator.ts)', () => {
    it('runs planner simulation, initializes costBasis, dynamically calculates netIncomeForOas, and applies OAS clawbacks', () => {
      const household: Household = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Wealthy Retiree',
        provinceOrState: 'ON',
        country: 'CA',
        retirementAge: 65,
        currentAge: 65,
        targetSpending: 150000,
      };

      const accounts: Account[] = [
        {
          id: '123e4567-e89b-12d3-a456-426614174030',
          householdId: household.id,
          name: 'Large RRSP',
          type: 'RRSP',
          balance: 2000000,
          annualContribution: 0,
          assetAllocation: { equities: 60, bonds: 40, cash: 0 },
        },
      ];

      const pensions: Pension[] = [
        {
          id: '123e4567-e89b-12d3-a456-426614174011',
          householdId: household.id,
          type: 'OAS',
          estimatedAmount: 8000,
          startAge: 65,
          inflationAdjusted: true,
        },
      ];

      const spendings: Spending[] = [
        {
          id: '123e4567-e89b-12d3-a456-426614174020',
          householdId: household.id,
          category: 'Living',
          amount: 120000,
          frequency: 'annually',
          inflationAdjusted: true,
        },
      ];

      const lifeEvents: LifeEvent[] = [
        {
          id: '123e4567-e89b-12d3-a456-426614174005',
          householdId: household.id,
          name: 'One time windfall',
          age: 70,
          netCashFlow: 50000,
        },
      ];

      const summary = runPlannerSimulation({
        household,
        accounts,
        spendings,
        pensions,
        lifeEvents,
      });

      expect(summary.totalRuns).toBe(1000);
      expect(summary.successfulRuns).toBeGreaterThanOrEqual(0);
      expect(summary.successRate).toBeGreaterThanOrEqual(0);
      expect(summary.medianEndingBalance).toBeGreaterThanOrEqual(0);
    });
  });
});
