# Milestone 1.1 — Zod Schemas & Domain Types Handoff Report

## 1. Observation

During the read-only exploration of the `expense-dashboard` repository for Milestone 1.1 (Zod Schemas & Domain Types), the following facts and file states were observed:

- **`PROJECT.md` (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`)**:
  - Requires a "Dual Entry architecture: public Quick Check widget (`src/app/page.tsx`, `QuickCheckWidget.tsx`) vs authenticated 7-tab SPA (`/plans`, `/plans/new`, `/plans/[id]`)."
  - Mandates pure business logic engines powered by Zod validation schemas in `src/lib/planner/types.ts`.
  - Defines the interface contract between `types.ts` and the engines/store: "Zod schemas: `Household`, `Account`, `Spending`, `Pension`, `LifeEvent`, `SimulationConfig`, `SimulationResultsSummary`, `QuickCheckParams`" and "Exported TypeScript types inferred from Zod schemas."

- **`SCOPE.md` (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m1_core_domain_1/SCOPE.md`)**:
  - Identifies Milestone 1.1 as "Zod Schemas & Domain Types" covering `src/lib/planner/types.ts` and `__tests__/planner/types.spec.ts`.
  - Specifies downstream engine requirements that rely on these types:
    - `taxEngine.ts`: US/CA progressive tax brackets.
    - `pensionEngine.ts`: public pension claim-age adjustments and OAS clawbacks.
    - `spendingEngine.ts`: spending withdrawal strategies.
    - `drawdownEngine.ts` & `simulator.ts`: drawdown sequencing.
  - Requires comprehensive unit tests in `__tests__/planner/` to verify 100% passing test coverage via `npm run test __tests__/planner`.

- **`ORIGINAL_REQUEST.md` (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/ORIGINAL_REQUEST.md`)**:
  - Details acceptance criteria: `npm run test __tests__/planner` must execute successfully with 100% passing unit tests across Zod schemas and engines.
  - Emphasizes local implementation with zero git push (`git status`).

- **`package.json` (`/usr/local/google/home/duynguyenn/expense-dashboard/package.json`)**:
  - Confirms `zod` (`^4.4.3`) is installed as a dependency.
  - Confirms `jest` (`^30.4.2`) and `ts-node`/`tsx` are installed, with `"test": "jest"` configured as the test runner script.

- **Existing File Check**:
  - `src/lib/planner/types.ts` was checked and does not exist (`no such file or directory`).
  - `__tests__/planner/types.spec.ts` was checked and does not exist (`no such file or directory`).

---

## 2. Logic Chain

1. **New File Creation**: Since neither `src/lib/planner/types.ts` nor `__tests__/planner/types.spec.ts` exist, the implementation must create both files from scratch, establishing the foundational domain definitions for the entire Financial Retirement Planner feature.
2. **Schema & Type Export Robustness**: The requirements state that downstream engines and store components will import Zod schemas (`Household`, `Account`, etc.) as well as inferred TypeScript types. To guarantee perfect compatibility regardless of whether an importer uses `HouseholdSchema` or `Household` as a value or type, `types.ts` will export both `[Name]Schema` and `[Name]` as value constants, along with `export type [Name] = z.infer<typeof [Name]Schema>`.
3. **Domain Modeling for Downstream Engines**:
   - **`QuickCheckParams`**: Must support the public Quick Check widget and URL hydration parameters (`currentAge`, `retirementAge`, `currentSavings`, `annualSavings`, `targetRetirementSpending`, `currentIncome`, `country`).
   - **`Account`**: Must support drawdown sequencing (`drawdownOrder`) and tax calculations (`costBasis`, `type` enum including taxable, traditional/roth IRA, 401k, TFSA, RRSP, cash, real estate).
   - **`Spending`**: Must support spending withdrawal strategies (`strategy` enum for constant_dollar, percentage_of_portfolio, guardrails, dynamic, along with min/max guardrail thresholds).
   - **`Pension`**: Must support public pension adjustments and clawbacks (`type` enum for social_security, cpp, oas, defined_benefit; `claimAge` with bounds 60 to 72; `monthlyAmount`).
   - **`LifeEvent`**: Must support specific age-based milestone events (`type` enum for expense, income, home_equity_release; `startAge`, `endAge`, `amount`).
   - **`Household`**: Must aggregate members, accounts, pensions, spending, and life events. Must include `userId` for Supabase RLS matching (`auth.uid() = user_id`), `country` (`US` | `CA`), `stateOrProvince`, and `filingStatus` for tax calculations.
   - **`SimulationConfig`**: Must define Web Worker parameters (`simulationPaths` defaulting to 1000, `rangeType` enum for 20_yr, 50_yr, 125_yr, `historicalBlockSize`).
   - **`SimulationResultsSummary`**: Must define the Web Worker output contract (`successRate`, percentile balances, `isPremiumUnlockRequired`, `annualOutcomes`).
4. **Unit Test Suite Rigor**: To achieve 100% coverage and satisfy the acceptance criteria, `__tests__/planner/types.spec.ts` must use Jest (`describe`, `it`, `expect`) to validate:
   - Successful parsing of valid objects for all 8 schemas.
   - Correct application of default values (e.g., `country: 'US'`, `filingStatus: 'single'`, `simulationPaths: 1000`).
   - Rejection of invalid data (e.g., out-of-bounds ages, negative balances, invalid enum types) via `.safeParse()` checking `success: false`.

---

## 3. Caveats

- **Read-Only Scope**: As an Explorer agent, no files were created or modified in `src/` or `__tests__/`. The proposed implementation is fully planned and ready for the Implementer agent.
- **Jest Configuration**: It is assumed that Jest is properly configured in the repository to execute TypeScript test files in `__tests__/` via `ts-node` or `jest-environment-jsdom`/`babel-jest` as defined in `package.json`.
- **Zod Version**: `zod` version `^4.4.3` is specified in `package.json`. The proposed schemas use stable, standard Zod methods (`z.object`, `z.string`, `z.number`, `z.enum`, `z.boolean`, `z.array`, `z.infer`) which are fully compatible across all major Zod versions.

---

## 4. Conclusion & Complete Implementation Plan

The foundational domain types and Zod validation schemas for Milestone 1.1 are fully specified and ready to be implemented. The Implementer agent should create `src/lib/planner/types.ts` and `__tests__/planner/types.spec.ts` with the exact contents provided below.

### File 1: `src/lib/planner/types.ts`

```typescript
import { z } from 'zod';

// 1. QuickCheckParams Schema
export const QuickCheckParamsSchema = z.object({
  currentAge: z.number().min(18).max(100),
  retirementAge: z.number().min(50).max(100),
  currentSavings: z.number().min(0),
  annualSavings: z.number().min(0),
  targetRetirementSpending: z.number().min(0),
  currentIncome: z.number().min(0).optional(),
  country: z.enum(['US', 'CA']).default('US').optional(),
});
export type QuickCheckParams = z.infer<typeof QuickCheckParamsSchema>;
export const QuickCheckParams = QuickCheckParamsSchema;

// 2. Account Schema
export const AccountSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.enum(['taxable', 'traditional_ira', 'roth_ira', '401k', 'tfsa', 'rrsp', 'cash', 'real_estate', 'other']),
  balance: z.number().min(0),
  costBasis: z.number().min(0).optional(),
  annualContribution: z.number().min(0).default(0),
  employerMatch: z.number().min(0).default(0).optional(),
  expectedGrowthRate: z.number().default(0.06).optional(),
  expectedInterestRate: z.number().default(0.02).optional(),
  drawdownOrder: z.number().int().min(1).optional(),
  owner: z.string().optional(),
});
export type Account = z.infer<typeof AccountSchema>;
export const Account = AccountSchema;

// 3. Spending Schema
export const SpendingSchema = z.object({
  strategy: z.enum(['constant_dollar', 'percentage_of_portfolio', 'guardrails', 'dynamic']),
  baselineExpenses: z.number().min(0),
  minimumExpenses: z.number().min(0).optional(),
  maximumExpenses: z.number().min(0).optional(),
  withdrawalPercentage: z.number().min(0).max(1).optional(),
  inflationAdjusted: z.boolean().default(true),
  healthCareExpenses: z.number().min(0).optional(),
});
export type Spending = z.infer<typeof SpendingSchema>;
export const Spending = SpendingSchema;

// 4. Pension Schema
export const PensionSchema = z.object({
  id: z.string(),
  owner: z.string(),
  type: z.enum(['social_security', 'cpp', 'oas', 'defined_benefit', 'other']),
  claimAge: z.number().min(60).max(72),
  monthlyAmount: z.number().min(0),
  inflationAdjusted: z.boolean().default(true),
  futureCOLA: z.number().default(0.02).optional(),
});
export type Pension = z.infer<typeof PensionSchema>;
export const Pension = PensionSchema;

// 5. LifeEvent Schema
export const LifeEventSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.enum(['expense', 'income', 'home_equity_release']),
  startAge: z.number().min(0),
  endAge: z.number().min(0).optional(),
  amount: z.number().min(0),
  inflationAdjusted: z.boolean().default(true),
  owner: z.string().optional(),
});
export type LifeEvent = z.infer<typeof LifeEventSchema>;
export const LifeEvent = LifeEventSchema;

// 6. Household Schema
export const HouseholdMemberSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  currentAge: z.number().min(0).max(120),
  retirementAge: z.number().min(18).max(100),
  lifeExpectancy: z.number().min(50).max(120),
  currentIncome: z.number().min(0).default(0),
});
export type HouseholdMember = z.infer<typeof HouseholdMemberSchema>;

export const HouseholdSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  name: z.string().min(1),
  country: z.enum(['US', 'CA']).default('US'),
  stateOrProvince: z.string().optional(),
  filingStatus: z.enum(['single', 'married_jointly', 'married_separately', 'head_of_household']).default('single'),
  members: z.array(HouseholdMemberSchema).min(1),
  accounts: z.array(AccountSchema),
  pensions: z.array(PensionSchema),
  spending: SpendingSchema,
  lifeEvents: z.array(LifeEventSchema),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Household = z.infer<typeof HouseholdSchema>;
export const Household = HouseholdSchema;

// 7. SimulationConfig Schema
export const SimulationConfigSchema = z.object({
  simulationPaths: z.number().int().min(1).max(10000).default(1000),
  rangeType: z.enum(['20_yr', '50_yr', '125_yr']).default('20_yr'),
  historicalBlockSize: z.number().int().min(1).default(5),
  seed: z.number().optional(),
  startYear: z.number().int().default(new Date().getFullYear()),
  endYear: z.number().int().default(new Date().getFullYear() + 50),
  targetConfidence: z.number().min(0).max(1).default(0.9),
});
export type SimulationConfig = z.infer<typeof SimulationConfigSchema>;
export const SimulationConfig = SimulationConfigSchema;

// 8. SimulationResultsSummary Schema
export const AnnualOutcomeSchema = z.object({
  year: z.number().int(),
  age: z.number().int(),
  medianBalance: z.number(),
  medianSpending: z.number(),
  tenthPercentileBalance: z.number(),
  ninetiethPercentileBalance: z.number(),
});
export type AnnualOutcome = z.infer<typeof AnnualOutcomeSchema>;

export const SimulationResultsSummarySchema = z.object({
  successRate: z.number().min(0).max(1),
  medianFinalBalance: z.number(),
  tenthPercentileFinalBalance: z.number(),
  ninetiethPercentileFinalBalance: z.number(),
  simulationPaths: z.number().int(),
  isPremiumUnlockRequired: z.boolean().default(false),
  rangeType: z.enum(['20_yr', '50_yr', '125_yr']),
  annualOutcomes: z.array(AnnualOutcomeSchema).optional(),
  generatedAt: z.string(),
});
export type SimulationResultsSummary = z.infer<typeof SimulationResultsSummarySchema>;
export const SimulationResultsSummary = SimulationResultsSummarySchema;
```

### File 2: `__tests__/planner/types.spec.ts`

```typescript
import {
  QuickCheckParams,
  Account,
  Spending,
  Pension,
  LifeEvent,
  Household,
  SimulationConfig,
  SimulationResultsSummary,
} from '../../src/lib/planner/types';

describe('Retirement Planner Zod Schemas & Domain Types', () => {
  describe('QuickCheckParams Schema', () => {
    it('should successfully parse valid quick check params with defaults', () => {
      const validData = {
        currentAge: 35,
        retirementAge: 65,
        currentSavings: 100000,
        annualSavings: 15000,
        targetRetirementSpending: 60000,
      };
      const result = QuickCheckParams.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.country).toBe('US');
      }
    });

    it('should fail parsing invalid ages', () => {
      const invalidData = {
        currentAge: 10, // min 18
        retirementAge: 40, // min 50
        currentSavings: 100000,
        annualSavings: 15000,
        targetRetirementSpending: 60000,
      };
      const result = QuickCheckParams.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Account Schema', () => {
    it('should successfully parse valid account data', () => {
      const validData = {
        id: 'acc-1',
        name: '401(k) Match',
        type: '401k',
        balance: 250000,
        annualContribution: 20500,
        employerMatch: 6000,
        drawdownOrder: 2,
      };
      const result = Account.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expectedGrowthRate).toBe(0.06);
      }
    });

    it('should fail parsing invalid account types or negative balances', () => {
      const invalidData = {
        id: 'acc-2',
        name: 'Crypto Wallet',
        type: 'crypto', // invalid enum
        balance: -5000, // invalid balance
      };
      const result = Account.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Spending Schema', () => {
    it('should successfully parse valid spending strategy', () => {
      const validData = {
        strategy: 'guardrails',
        baselineExpenses: 80000,
        minimumExpenses: 60000,
        maximumExpenses: 100000,
      };
      const result = Spending.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.inflationAdjusted).toBe(true);
      }
    });

    it('should fail parsing unknown strategy', () => {
      const invalidData = {
        strategy: 'fixed_random',
        baselineExpenses: 50000,
      };
      const result = Spending.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Pension Schema', () => {
    it('should successfully parse valid pension data', () => {
      const validData = {
        id: 'pen-1',
        owner: 'mem-1',
        type: 'social_security',
        claimAge: 67,
        monthlyAmount: 2500,
      };
      const result = Pension.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should fail parsing claim age outside 60-72 bounds', () => {
      const invalidData = {
        id: 'pen-2',
        owner: 'mem-1',
        type: 'social_security',
        claimAge: 55, // min 60
        monthlyAmount: 2000,
      };
      const result = Pension.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('LifeEvent Schema', () => {
    it('should successfully parse valid life event', () => {
      const validData = {
        id: 'evt-1',
        name: 'Downsize Home',
        type: 'home_equity_release',
        startAge: 75,
        amount: 200000,
      };
      const result = LifeEvent.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should fail parsing invalid life event type', () => {
      const invalidData = {
        id: 'evt-2',
        name: 'World Cruise',
        type: 'vacation', // invalid enum
        startAge: 70,
        amount: 50000,
      };
      const result = LifeEvent.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Household Schema', () => {
    it('should successfully parse full household object with defaults', () => {
      const validData = {
        id: 'house-1',
        userId: 'usr-123',
        name: 'Smith Family Plan',
        members: [
          {
            id: 'mem-1',
            name: 'John Smith',
            currentAge: 45,
            retirementAge: 65,
            lifeExpectancy: 95,
            currentIncome: 120000,
          },
        ],
        accounts: [
          {
            id: 'acc-1',
            name: 'Roth IRA',
            type: 'roth_ira',
            balance: 150000,
            drawdownOrder: 3,
          },
        ],
        pensions: [
          {
            id: 'pen-1',
            owner: 'mem-1',
            type: 'social_security',
            claimAge: 67,
            monthlyAmount: 2800,
          },
        ],
        spending: {
          strategy: 'constant_dollar',
          baselineExpenses: 75000,
        },
        lifeEvents: [],
      };
      const result = Household.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.country).toBe('US');
        expect(result.data.filingStatus).toBe('single');
      }
    });

    it('should fail parsing household without members', () => {
      const invalidData = {
        name: 'Empty Household',
        members: [], // min 1 required
        accounts: [],
        pensions: [],
        spending: { strategy: 'constant_dollar', baselineExpenses: 50000 },
        lifeEvents: [],
      };
      const result = Household.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('SimulationConfig Schema', () => {
    it('should successfully parse config and apply defaults', () => {
      const validData = {
        rangeType: '50_yr',
      };
      const result = SimulationConfig.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.simulationPaths).toBe(1000);
        expect(result.data.historicalBlockSize).toBe(5);
        expect(result.data.targetConfidence).toBe(0.9);
      }
    });
  });

  describe('SimulationResultsSummary Schema', () => {
    it('should successfully parse simulation results summary', () => {
      const validData = {
        successRate: 0.94,
        medianFinalBalance: 1250000,
        tenthPercentileFinalBalance: 250000,
        ninetiethPercentileFinalBalance: 3400000,
        simulationPaths: 1000,
        isPremiumUnlockRequired: false,
        rangeType: '125_yr',
        generatedAt: '2026-06-24T00:00:00.000Z',
      };
      const result = SimulationResultsSummary.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});
```

---

## 5. Verification Method

To verify the implementation once the Implementer agent completes the work, execute the following steps:

1. **File Existence Check**: Verify that `src/lib/planner/types.ts` and `__tests__/planner/types.spec.ts` have been successfully created.
2. **Execute Unit Tests**: Run the test suite using the exact command specified in `SCOPE.md` and `ORIGINAL_REQUEST.md`:
   ```bash
   npm run test __tests__/planner
   ```
   - **Success Condition**: 100% of the test cases pass successfully with zero failures.
3. **Verify Git Status**: Ensure zero commits have been pushed to any remote repository:
   ```bash
   git status
   ```
   - **Success Condition**: All changes exist strictly in the local working directory.
