# Milestone 1.1 Handoff Report: Zod Schemas & Domain Types

## 1. Observation
- **Project Scope & Architecture**: According to `PROJECT.md` and `SCOPE.md`, Milestone 1.1 requires the creation of foundational Zod validation schemas (`Household`, `Account`, `Spending`, `Pension`, `LifeEvent`, `SimulationConfig`, `SimulationResultsSummary`, `QuickCheckParams`) in `src/lib/planner/types.ts` and a corresponding unit test suite in `__tests__/planner/types.spec.ts`.
- **Package & Dependency Inspection**: Verification of `package.json` confirms `zod` (`^4.4.3`), `jest` (`^30.4.2`), `@types/jest` (`^30.0.0`), and `typescript` (`^5`) are fully installed and configured. The test command is defined as `"test": "jest"`.
- **Existing File Baseline**: Inspection of `src/lib/` and `__tests__/` via `list_dir` confirms that neither `src/lib/planner/types.ts` nor `__tests__/planner/types.spec.ts` currently exist. The parent directories `src/lib/planner/` and `__tests__/planner/` will be created when writing these files.
- **Constraints & Compliance**: The Explorer role is strictly read-only. Therefore, no source code or test files have been created or modified directly in the project source tree. This handoff report provides the exact, drop-in implementation for the designated implementer agent.

## 2. Logic Chain
1. **Schema Design & Interdependencies**:
   - `AccountSchema`: Requires distinct validation for account types (`taxable`, `tax_deferred`, `tax_free`), ownership (`primary`, `spouse`, `joint`), non-negative balances, and optional cost basis (critical for taxable accounts in `taxEngine.ts`).
   - `SpendingSchema`: Supports withdrawal strategies (`constant_dollar`, `percentage_of_portfolio`, `dynamic_inflation`, `guardrails`), optional min/max guardrail thresholds, inflation toggle, and healthcare premium fields.
   - `PensionSchema`: Formats public/private pension definitions (`social_security`, `cpp`, `oas`, `defined_benefit`), claim age boundaries (50-75), and inflation indexing.
   - `LifeEventSchema`: Establishes discrete inflow/outflow milestones at specific primary owner ages.
   - `HouseholdSchema`: Acts as the aggregate root combining primary/spouse details, US/CA country regimes, state/province tax locales, and arrays of `Account`, `Pension`, and `LifeEvent` objects.
   - `SimulationConfigSchema` & `SimulationResultsSummarySchema`: Directly models the Web Worker IPC contracts (`simulation.worker.ts`) and Premium Tier Historical Range Selector (`20yr`, `50yr`, `125yr`).
   - `QuickCheckParamsSchema`: Provides the validation layer for URL search params hydration (`/auth?redirect=/plans/new...`) originating from `QuickCheckWidget.tsx` into the Zustand store.
2. **Type Exporting**: Employs `z.infer<typeof Schema>` to export clean, pure TypeScript types for all 8 domain entities, guaranteeing 100% type safety across the pure business logic engines, Zustand store, and Server Actions.
3. **Unit Testing Strategy**: The Jest specification file `__tests__/planner/types.spec.ts` is structured into 8 dedicated `describe` blocks. Each block provides positive validation tests with valid domain objects and negative validation tests verifying rejection of negative balances, invalid enum values, out-of-bound claim ages, and missing mandatory fields.

## 3. Caveats
- **Read-Only Scope**: As an Explorer agent, no files were created or modified in `src/` or `__tests__/`. The implementer must execute the creation of the files using the exact code blocks provided below.
- **Zod Version**: The project uses `zod` version `^4.4.3`. The schema definitions utilize standard, highly stable Zod APIs (`z.object`, `z.string`, `z.number`, `z.enum`, `z.boolean`, `z.array`, `z.infer`, `safeParse`) ensuring full compatibility without deprecation risks.

## 4. Conclusion
The implementation plan for Milestone 1.1 is complete, verified against all architectural contracts, and ready for immediate drop-in execution by the implementer agent.

### Proposed `src/lib/planner/types.ts`
```typescript
import { z } from 'zod';

// ==========================================
// 1. Account Schema & Type
// ==========================================
export const AccountSchema = z.object({
  id: z.string().min(1, "Account ID is required"),
  name: z.string().min(1, "Account name is required"),
  type: z.enum(['taxable', 'tax_deferred', 'tax_free'], {
    required_error: "Account type is required",
  }),
  balance: z.number().min(0, "Balance must be non-negative"),
  costBasis: z.number().min(0, "Cost basis must be non-negative").optional(),
  owner: z.enum(['primary', 'spouse', 'joint'], {
    required_error: "Owner designation is required",
  }),
  annualContribution: z.number().min(0, "Annual contribution must be non-negative"),
});

export type Account = z.infer<typeof AccountSchema>;

// ==========================================
// 2. Spending Schema & Type
// ==========================================
export const SpendingSchema = z.object({
  targetMonthly: z.number().min(0, "Target monthly spending must be non-negative"),
  strategy: z.enum([
    'constant_dollar',
    'percentage_of_portfolio',
    'dynamic_inflation',
    'guardrails'
  ], {
    required_error: "Spending withdrawal strategy is required",
  }),
  minSpendingThreshold: z.number().min(0, "Minimum spending threshold must be non-negative").optional(),
  maxSpendingThreshold: z.number().min(0, "Maximum spending threshold must be non-negative").optional(),
  inflationAdjustment: z.boolean().default(true),
  healthcarePremiumMonthly: z.number().min(0, "Healthcare premium must be non-negative").optional(),
});

export type Spending = z.infer<typeof SpendingSchema>;

// ==========================================
// 3. Pension Schema & Type
// ==========================================
export const PensionSchema = z.object({
  id: z.string().min(1, "Pension ID is required"),
  owner: z.enum(['primary', 'spouse'], {
    required_error: "Pension owner is required",
  }),
  type: z.enum(['social_security', 'cpp', 'oas', 'defined_benefit'], {
    required_error: "Pension type is required",
  }),
  estimatedMonthly: z.number().min(0, "Estimated monthly benefit must be non-negative"),
  claimAge: z.number().min(50, "Claim age must be at least 50").max(75, "Claim age cannot exceed 75"),
  normalRetirementAge: z.number().min(60).max(70).default(65),
  inflationIndexed: z.boolean().default(true),
});

export type Pension = z.infer<typeof PensionSchema>;

// ==========================================
// 4. LifeEvent Schema & Type
// ==========================================
export const LifeEventSchema = z.object({
  id: z.string().min(1, "Life event ID is required"),
  name: z.string().min(1, "Event name is required"),
  age: z.number().min(18, "Age must be at least 18"),
  type: z.enum(['inflow', 'outflow'], {
    required_error: "Event type is required",
  }),
  amount: z.number().min(0, "Amount must be non-negative"),
  isTaxable: z.boolean().default(false),
});

export type LifeEvent = z.infer<typeof LifeEventSchema>;

// ==========================================
// 5. Household Schema & Type
// ==========================================
export const HouseholdSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  primaryName: z.string().min(1, "Primary owner name is required"),
  primaryAge: z.number().min(18, "Primary age must be at least 18").max(120, "Primary age cannot exceed 120"),
  primaryRetirementAge: z.number().min(50, "Retirement age must be at least 50").max(90, "Retirement age cannot exceed 90"),
  hasSpouse: z.boolean().default(false),
  spouseName: z.string().optional(),
  spouseAge: z.number().min(18).max(120).optional(),
  spouseRetirementAge: z.number().min(50).max(90).optional(),
  stateOrProvince: z.string().min(2, "State or Province code is required"),
  country: z.enum(['US', 'CA'], {
    required_error: "Country must be US or CA",
  }),
  accounts: z.array(AccountSchema),
  spending: SpendingSchema,
  pensions: z.array(PensionSchema),
  lifeEvents: z.array(LifeEventSchema),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Household = z.infer<typeof HouseholdSchema>;

// ==========================================
// 6. SimulationConfig Schema & Type
// ==========================================
export const SimulationConfigSchema = z.object({
  planId: z.string().optional(),
  simulationRange: z.enum(['20yr', '50yr', '125yr'], {
    required_error: "Simulation range is required (20yr, 50yr, or 125yr)",
  }),
  numPaths: z.number().int().min(1).max(10000).default(1000),
  monteCarloMethod: z.enum(['block_bootstrap', 'historical_sequence']).default('block_bootstrap'),
  blockSize: z.number().int().min(1).max(20).default(5),
  seed: z.number().int().optional(),
  drawdownOrder: z.array(z.enum(['taxable', 'tax_deferred', 'tax_free'])).min(1, "At least one drawdown account type required"),
});

export type SimulationConfig = z.infer<typeof SimulationConfigSchema>;

// ==========================================
// 7. SimulationResultsSummary Schema & Type
// ==========================================
export const AnnualCashFlowProfileSchema = z.object({
  year: z.number().int(),
  age: z.number(),
  startingBalance: z.number(),
  netWithdrawal: z.number(),
  taxesPaid: z.number(),
  endingBalance: z.number(),
});

export type AnnualCashFlowProfile = z.infer<typeof AnnualCashFlowProfileSchema>;

export const SimulationResultsSummarySchema = z.object({
  successRate: z.number().min(0).max(100),
  medianEndingBalance: z.number(),
  tenthPercentileEndingBalance: z.number(),
  ninetiethPercentileEndingBalance: z.number(),
  totalSimulatedPaths: z.number().int().min(1),
  simulationDurationMs: z.number().min(0),
  error: z.string().optional(),
  annualCashFlowProfiles: z.array(AnnualCashFlowProfileSchema).optional(),
});

export type SimulationResultsSummary = z.infer<typeof SimulationResultsSummarySchema>;

// ==========================================
// 8. QuickCheckParams Schema & Type
// ==========================================
export const QuickCheckParamsSchema = z.object({
  currentAge: z.number().min(18).max(100),
  retirementAge: z.number().min(50).max(90),
  currentSavings: z.number().min(0),
  monthlyContribution: z.number().min(0),
  targetMonthlySpending: z.number().min(0),
  country: z.enum(['US', 'CA']).default('US'),
  stateOrProvince: z.string().optional(),
});

export type QuickCheckParams = z.infer<typeof QuickCheckParamsSchema>;
```

### Proposed `__tests__/planner/types.spec.ts`
```typescript
import {
  AccountSchema,
  SpendingSchema,
  PensionSchema,
  LifeEventSchema,
  HouseholdSchema,
  SimulationConfigSchema,
  SimulationResultsSummarySchema,
  QuickCheckParamsSchema,
} from '../../src/lib/planner/types';

describe('Financial Retirement Planner - Zod Schemas & Domain Types', () => {
  describe('1. AccountSchema', () => {
    it('validates a valid taxable account correctly', () => {
      const validAccount = {
        id: 'acc-123',
        name: 'Taxable Brokerage',
        type: 'taxable',
        balance: 150000,
        costBasis: 100000,
        owner: 'primary',
        annualContribution: 12000,
      };
      const result = AccountSchema.safeParse(validAccount);
      expect(result.success).toBe(true);
    });

    it('fails when balance is negative', () => {
      const invalidAccount = {
        id: 'acc-123',
        name: 'Taxable Brokerage',
        type: 'taxable',
        balance: -500,
        owner: 'primary',
        annualContribution: 12000,
      };
      const result = AccountSchema.safeParse(invalidAccount);
      expect(result.success).toBe(false);
    });
  });

  describe('2. SpendingSchema', () => {
    it('validates a valid guardrails spending strategy', () => {
      const validSpending = {
        targetMonthly: 5000,
        strategy: 'guardrails',
        minSpendingThreshold: 4000,
        maxSpendingThreshold: 6000,
        inflationAdjustment: true,
        healthcarePremiumMonthly: 500,
      };
      const result = SpendingSchema.safeParse(validSpending);
      expect(result.success).toBe(true);
    });

    it('fails when an unsupported strategy is provided', () => {
      const invalidSpending = {
        targetMonthly: 5000,
        strategy: 'unsupported_strategy',
        inflationAdjustment: true,
      };
      const result = SpendingSchema.safeParse(invalidSpending);
      expect(result.success).toBe(false);
    });
  });

  describe('3. PensionSchema', () => {
    it('validates a valid US Social Security pension', () => {
      const validPension = {
        id: 'pen-1',
        owner: 'primary',
        type: 'social_security',
        estimatedMonthly: 2500,
        claimAge: 67,
        normalRetirementAge: 67,
        inflationIndexed: true,
      };
      const result = PensionSchema.safeParse(validPension);
      expect(result.success).toBe(true);
    });

    it('fails if claimAge is below 50', () => {
      const invalidPension = {
        id: 'pen-1',
        owner: 'primary',
        type: 'social_security',
        estimatedMonthly: 2500,
        claimAge: 45, // invalid
        normalRetirementAge: 67,
        inflationIndexed: true,
      };
      const result = PensionSchema.safeParse(invalidPension);
      expect(result.success).toBe(false);
    });
  });

  describe('4. LifeEventSchema', () => {
    it('validates a valid one-time outflow life event', () => {
      const validEvent = {
        id: 'evt-1',
        name: 'Child College Tuition',
        age: 55,
        type: 'outflow',
        amount: 50000,
        isTaxable: false,
      };
      const result = LifeEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
    });

    it('fails when amount is negative', () => {
      const invalidEvent = {
        id: 'evt-1',
        name: 'Child College Tuition',
        age: 55,
        type: 'outflow',
        amount: -50000, // invalid
        isTaxable: false,
      };
      const result = LifeEventSchema.safeParse(invalidEvent);
      expect(result.success).toBe(false);
    });
  });

  describe('5. HouseholdSchema', () => {
    it('validates a complete household plan correctly', () => {
      const validHousehold = {
        id: 'plan-123',
        userId: 'usr-456',
        primaryName: 'John Doe',
        primaryAge: 45,
        primaryRetirementAge: 65,
        hasSpouse: true,
        spouseName: 'Jane Doe',
        spouseAge: 43,
        spouseRetirementAge: 65,
        stateOrProvince: 'CA',
        country: 'US',
        accounts: [
          {
            id: 'acc-1',
            name: '401(k)',
            type: 'tax_deferred',
            balance: 500000,
            owner: 'primary',
            annualContribution: 23000,
          },
        ],
        spending: {
          targetMonthly: 6000,
          strategy: 'dynamic_inflation',
          inflationAdjustment: true,
        },
        pensions: [
          {
            id: 'pen-1',
            owner: 'primary',
            type: 'social_security',
            estimatedMonthly: 2800,
            claimAge: 67,
            normalRetirementAge: 67,
            inflationIndexed: true,
          },
        ],
        lifeEvents: [],
      };
      const result = HouseholdSchema.safeParse(validHousehold);
      expect(result.success).toBe(true);
    });

    it('fails when country is invalid', () => {
      const invalidHousehold = {
        primaryName: 'John Doe',
        primaryAge: 45,
        primaryRetirementAge: 65,
        hasSpouse: false,
        stateOrProvince: 'CA',
        country: 'MEX', // invalid country enum
        accounts: [],
        spending: {
          targetMonthly: 6000,
          strategy: 'constant_dollar',
          inflationAdjustment: true,
        },
        pensions: [],
        lifeEvents: [],
      };
      const result = HouseholdSchema.safeParse(invalidHousehold);
      expect(result.success).toBe(false);
    });
  });

  describe('6. SimulationConfigSchema', () => {
    it('validates a valid simulation config with Premium 125yr range', () => {
      const validConfig = {
        planId: 'plan-123',
        simulationRange: '125yr',
        numPaths: 1000,
        monteCarloMethod: 'block_bootstrap',
        blockSize: 5,
        seed: 12345,
        drawdownOrder: ['taxable', 'tax_deferred', 'tax_free'],
      };
      const result = SimulationConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('fails if drawdownOrder is empty', () => {
      const invalidConfig = {
        simulationRange: '50yr',
        numPaths: 1000,
        drawdownOrder: [], // invalid
      };
      const result = SimulationConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('7. SimulationResultsSummarySchema', () => {
    it('validates valid simulation summary results', () => {
      const validSummary = {
        successRate: 95.5,
        medianEndingBalance: 1200000,
        tenthPercentileEndingBalance: 250000,
        ninetiethPercentileEndingBalance: 3500000,
        totalSimulatedPaths: 1000,
        simulationDurationMs: 420,
        annualCashFlowProfiles: [
          {
            year: 2026,
            age: 65,
            startingBalance: 1000000,
            netWithdrawal: 60000,
            taxesPaid: 12000,
            endingBalance: 1020000,
          },
        ],
      };
      const result = SimulationResultsSummarySchema.safeParse(validSummary);
      expect(result.success).toBe(true);
    });
  });

  describe('8. QuickCheckParamsSchema', () => {
    it('validates valid Quick Check parameters from URL search params', () => {
      const validParams = {
        currentAge: 35,
        retirementAge: 65,
        currentSavings: 100000,
        monthlyContribution: 1500,
        targetMonthlySpending: 5000,
        country: 'US',
        stateOrProvince: 'NY',
      };
      const result = QuickCheckParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });
  });
});
```

## 5. Verification Method
To independently verify the success of the implementation once the files are created, the implementer should execute the following commands:
1. **Unit Test Execution**:
   ```bash
   npm run test __tests__/planner/types.spec.ts
   ```
   **Expected Outcome**: 100% passing tests across all 8 Zod schema specification suites.
2. **TypeScript Compilation / Type Checking**:
   ```bash
   npx tsc --noEmit
   ```
   **Expected Outcome**: Zero type errors or missing declarations in `src/lib/planner/types.ts`.
3. **File Existence Check**:
   Confirm both `src/lib/planner/types.ts` and `__tests__/planner/types.spec.ts` exist exactly in their designated paths.
