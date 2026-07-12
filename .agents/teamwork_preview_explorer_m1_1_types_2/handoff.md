# Milestone 1.1 Analysis & Implementation Plan: Zod Schemas & Domain Types

**Explorer**: Stellar Teamwork Explorer (Milestone 1.1)  
**Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m1_1_types_2`  
**Date**: 2026-06-23

---

## 1. Observation

During our read-only investigation of the `lilo123/expense-dashboard` codebase and documentation, we observed the following verifiable facts:

1. **Required Zod Schemas & Domain Contracts**:
   - `PROJECT.md` (lines 20–24), `SCOPE.md` (lines 3–4), and `ORIGINAL_REQUEST.md` (lines 12–14) explicitly mandate the definition of eight Zod validation schemas in `src/lib/planner/types.ts`: `Household`, `Account`, `Spending`, `Pension`, `LifeEvent`, `SimulationConfig`, `SimulationResultsSummary`, `QuickCheckParams`.
   - All pure TypeScript engines (`taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`), Web Worker simulation contracts, Zustand store hydration, and Server Actions depend directly on the exported Zod schemas and their inferred TypeScript types (`z.infer<typeof Schema>`).

2. **System Architecture & Domain Specifications**:
   - `PROJECT.md` (lines 5–9) and `ARCHITECTURE.md` (lines 295–317) detail the **Dual Entry Architecture**:
     - **Quick Check Widget**: Uses `QuickCheckParams` (portfolio, withdrawal, years, taxJurisdiction) to pass state via URL search parameters (`/auth?redirect=%2Fplans%2Fnew&portfolio=1000000&withdrawal=4&years=30`) for hydration in `useRetirementStore.tsx`.
     - **Premium Tier Historical Range Selector**: Inside `SimulationConfig`, requires `historicalRange` options: `most_recent_20_years` (2005–2025), `most_recent_50_years` (1975–2025), or `all_125_years` (1900–2025).
     - **Pure TS Business Logic Engines**:
       - `taxEngine.ts`: US/CA progressive marginal brackets, capital gains, dividend tax credits (requires `taxJurisdiction`, `stateProvince`, `costBasis` on taxable accounts).
       - `pensionEngine.ts`: Public pension claim-age adjustments and OAS clawbacks (requires `type` of `social_security` | `cpp` | `oas` | `defined_benefit`, `baseAmount`, `startAge`, `owner`).
       - `spendingEngine.ts`: Withdrawal strategies including `constant_dollar`, `vanguard_dynamic` (with min/max clamps), and `yale_endowment` (with blend weight).
       - `drawdownEngine.ts` / `simulator.ts`: Drawdown sequencing (`taxable_first` vs `proportional` vs `tax_deferred_first`).
     - **Server Actions & State Management**: `savePlan(plan: Household & { id?: string })` requires `Household` to function as the aggregate root enclosing `accounts`, `spending`, `pensions`, `lifeEvents`, and `simulationConfig`, while `useRetirementStore` separates `draftPlan.household` demographics.

3. **Codebase Configuration & Existing File State**:
   - `package.json` confirms `zod` (`^4.4.3`), `jest` (`^30.4.2`), and `typescript` (`^5`) are installed.
   - `jest.config.ts` configures Jest with `testEnvironment: 'jsdom'` and a module path alias `^@/(.*)$` mapping to `<rootDir>/src/$1`.
   - `view_file` verification confirmed that `src/lib/planner/types.ts` and `__tests__/planner/types.spec.ts` do not currently exist.

---

## 2. Logic Chain

Based on the direct observations, we established the following step-by-step reasoning for the implementation plan:

1. **Validation & Type Safety Foundation**:
   - Because Zod schemas serve as both runtime boundaries (for URL hydration, Server Actions BOLA defenses, and Web Worker IPC) and compile-time TypeScript type definitions, each schema must use precise validators (`min`, `max`, `nonnegative`, `positive`, `enum`) and export its inferred type via `export type X = z.infer<typeof XSchema>;`.

2. **Dual-Role `Household` Schema Design**:
   - Because `savePlan` accepts a full plan object (`Household & { id?: string }`) while `useRetirementStore` tracks sub-stores (`draftPlan.household`, `draftPlan.accounts`), making `accounts`, `spending`, `pensions`, `lifeEvents`, and `simulationConfig` optional properties on `HouseholdSchema` satisfies both the standalone demographic representation and the complete aggregate root entity perfectly.

3. **Domain Engine Alignment**:
   - To support `taxEngine.ts`, `AccountSchema` must include `costBasis` for taxable capital gains, and `HouseholdSchema` must enforce `taxJurisdiction: z.enum(['US', 'CA'])`.
   - To support `pensionEngine.ts`, `PensionSchema` must support `owner: z.enum(['primary', 'spouse'])`, `type: z.enum(['social_security', 'cpp', 'oas', 'defined_benefit'])`, and realistic age bounds (`50` to `80`).
   - To support `spendingEngine.ts`, `SpendingSchema` must include optional `minWithdrawal`, `maxWithdrawal` (Vanguard Dynamic clamps), and `yaleWeight` (Yale Endowment blend weight).
   - To support `drawdownEngine.ts` and `simulation.worker.ts`, `SimulationConfigSchema` must include `drawdownStrategy: z.enum(['taxable_first', 'proportional', 'tax_deferred_first'])`, `historicalRange: z.enum(['most_recent_20_years', 'most_recent_50_years', 'all_125_years'])`, `numPaths`, `inflationRate`, `retirementHorizon`, and `seed`.

4. **Hermetic Test Suite Coverage**:
   - To guarantee 100% passing unit test coverage required by `SCOPE.md` (`npm run test __tests__/planner`), `__tests__/planner/types.spec.ts` must use Jest's `describe`/`it` structure, importing from `@/lib/planner/types` and comprehensively asserting `parse` success for valid payloads and `parse` rejection/error boundaries for invalid data across all eight schemas.

---

## 3. Caveats

- **Scope Boundary**: This investigation is strictly read-only for Milestone 1.1. No code files or test files were created or modified during this exploration phase.
- **Engine Implementation Details**: While the schemas provide the foundational data structures and validation rules, the specific arithmetic implementations of the tax, pension, spending, and drawdown engines belong to subsequent milestones (M1.2–M1.5) and will depend on these types.
- **Supabase RLS & Server Actions**: The schemas include optional `id` and `user_id` fields on `Household` to anticipate Supabase database persistence in M3, ensuring zero breaking changes when server actions are implemented.

---

## 4. Conclusion

The implementation of Milestone 1.1 is fully ready for execution. The implementer can directly create `src/lib/planner/types.ts` and `__tests__/planner/types.spec.ts` using the concrete, production-ready specifications below.

### Concrete Source File: `src/lib/planner/types.ts`
```typescript
import { z } from 'zod';

// 1. Account Schema
export const AccountSchema = z.object({
  id: z.string().min(1, "Account ID is required"),
  name: z.string().min(1, "Account name is required"),
  type: z.enum(['taxable', 'tax_deferred', 'tax_free']),
  balance: z.number().nonnegative("Balance must be non-negative"),
  costBasis: z.number().nonnegative("Cost basis must be non-negative"),
  expectedReturnOverride: z.number().optional(),
  owner: z.enum(['primary', 'spouse', 'joint']),
});
export type Account = z.infer<typeof AccountSchema>;

// 2. Spending Schema
export const SpendingSchema = z.object({
  initialBase: z.number().positive("Initial spending base must be positive"),
  strategy: z.enum(['constant_dollar', 'vanguard_dynamic', 'yale_endowment']),
  minWithdrawal: z.number().positive("Minimum withdrawal floor must be positive").optional(),
  maxWithdrawal: z.number().positive("Maximum withdrawal ceiling must be positive").optional(),
  yaleWeight: z.number().min(0).max(1, "Yale weight must be between 0 and 1").optional(),
  inflationAdjusted: z.boolean(),
});
export type Spending = z.infer<typeof SpendingSchema>;

// 3. Pension Schema
export const PensionSchema = z.object({
  id: z.string().min(1, "Pension ID is required"),
  owner: z.enum(['primary', 'spouse']),
  type: z.enum(['social_security', 'cpp', 'oas', 'defined_benefit']),
  baseAmount: z.number().nonnegative("Base amount must be non-negative"),
  startAge: z.number().min(50).max(80, "Start age must be between 50 and 80"),
  inflationAdjusted: z.boolean(),
});
export type Pension = z.infer<typeof PensionSchema>;

// 4. LifeEvent Schema
export const LifeEventSchema = z.object({
  id: z.string().min(1, "Life event ID is required"),
  name: z.string().min(1, "Life event name is required"),
  age: z.number().positive("Age must be positive"),
  type: z.enum(['expense', 'income']),
  amount: z.number().positive("Amount must be positive"),
  inflationAdjusted: z.boolean(),
});
export type LifeEvent = z.infer<typeof LifeEventSchema>;

// 5. SimulationConfig Schema
export const SimulationConfigSchema = z.object({
  drawdownStrategy: z.enum(['taxable_first', 'proportional', 'tax_deferred_first']),
  historicalRange: z.enum(['most_recent_20_years', 'most_recent_50_years', 'all_125_years']),
  numPaths: z.number().int().positive().default(1000),
  inflationRate: z.number().nonnegative().default(0.025),
  retirementHorizon: z.number().int().positive().default(30),
  seed: z.number().int().optional(),
});
export type SimulationConfig = z.infer<typeof SimulationConfigSchema>;

// 6. Household Schema
export const HouseholdSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().optional(),
  name: z.string().min(1, "Household name is required"),
  taxJurisdiction: z.enum(['US', 'CA']),
  stateProvince: z.string().min(1, "State or province is required"),
  birthYear: z.number().int().min(1900).max(2100),
  retirementAge: z.number().int().min(50).max(80),
  spouseBirthYear: z.number().int().min(1900).max(2100).optional(),
  spouseRetirementAge: z.number().int().min(50).max(80).optional(),
  accounts: z.array(AccountSchema).optional(),
  spending: SpendingSchema.optional(),
  pensions: z.array(PensionSchema).optional(),
  lifeEvents: z.array(LifeEventSchema).optional(),
  simulationConfig: SimulationConfigSchema.optional(),
});
export type Household = z.infer<typeof HouseholdSchema>;

// 7. SimulationResultsSummary Schema
export const SimulationResultsSummarySchema = z.object({
  successRate: z.number().min(0).max(100),
  medianFinalBalance: z.number(),
  tenthPercentileFinalBalance: z.number(),
  ninetiethPercentileFinalBalance: z.number(),
  annualEndingBalances: z.array(
    z.object({
      year: z.number().int(),
      p10: z.number(),
      p50: z.number(),
      p90: z.number(),
    })
  ).optional(),
});
export type SimulationResultsSummary = z.infer<typeof SimulationResultsSummarySchema>;

// 8. QuickCheckParams Schema
export const QuickCheckParamsSchema = z.object({
  portfolio: z.number().nonnegative("Portfolio must be non-negative"),
  withdrawal: z.number().positive("Withdrawal must be positive"),
  years: z.number().int().positive("Years must be positive"),
  taxJurisdiction: z.enum(['US', 'CA']).optional(),
});
export type QuickCheckParams = z.infer<typeof QuickCheckParamsSchema>;
```

### Concrete Test Suite: `__tests__/planner/types.spec.ts`
```typescript
import {
  AccountSchema,
  SpendingSchema,
  PensionSchema,
  LifeEventSchema,
  SimulationConfigSchema,
  HouseholdSchema,
  SimulationResultsSummarySchema,
  QuickCheckParamsSchema,
} from '@/lib/planner/types';

describe('Zod Validation Schemas & Domain Types', () => {
  describe('AccountSchema', () => {
    it('should successfully parse a valid taxable account', () => {
      const validAccount = {
        id: 'acc-1',
        name: 'Brokerage Account',
        type: 'taxable',
        balance: 500000,
        costBasis: 400000,
        owner: 'primary',
      };
      expect(() => AccountSchema.parse(validAccount)).not.toThrow();
    });

    it('should fail if balance or costBasis is negative', () => {
      const invalidAccount = {
        id: 'acc-2',
        name: '401k',
        type: 'tax_deferred',
        balance: -1000,
        costBasis: 0,
        owner: 'primary',
      };
      expect(() => AccountSchema.parse(invalidAccount)).toThrow();
    });

    it('should fail on invalid account type', () => {
      const invalidAccount = {
        id: 'acc-3',
        name: 'Crypto',
        type: 'unknown_type',
        balance: 10000,
        costBasis: 10000,
        owner: 'primary',
      };
      expect(() => AccountSchema.parse(invalidAccount)).toThrow();
    });
  });

  describe('SpendingSchema', () => {
    it('should successfully parse constant_dollar strategy', () => {
      const spending = {
        initialBase: 50000,
        strategy: 'constant_dollar',
        inflationAdjusted: true,
      };
      expect(() => SpendingSchema.parse(spending)).not.toThrow();
    });

    it('should successfully parse vanguard_dynamic strategy with min/max clamps', () => {
      const spending = {
        initialBase: 50000,
        strategy: 'vanguard_dynamic',
        minWithdrawal: 40000,
        maxWithdrawal: 60000,
        inflationAdjusted: true,
      };
      expect(() => SpendingSchema.parse(spending)).not.toThrow();
    });

    it('should fail if yaleWeight is out of bounds [0, 1]', () => {
      const spending = {
        initialBase: 50000,
        strategy: 'yale_endowment',
        yaleWeight: 1.5,
        inflationAdjusted: true,
      };
      expect(() => SpendingSchema.parse(spending)).toThrow();
    });
  });

  describe('PensionSchema', () => {
    it('should successfully parse social_security pension', () => {
      const pension = {
        id: 'pen-1',
        owner: 'primary',
        type: 'social_security',
        baseAmount: 35000,
        startAge: 67,
        inflationAdjusted: true,
      };
      expect(() => PensionSchema.parse(pension)).not.toThrow();
    });

    it('should fail if startAge is out of realistic bounds', () => {
      const pension = {
        id: 'pen-2',
        owner: 'primary',
        type: 'social_security',
        baseAmount: 35000,
        startAge: 40, // min is 50
        inflationAdjusted: true,
      };
      expect(() => PensionSchema.parse(pension)).toThrow();
    });
  });

  describe('LifeEventSchema', () => {
    it('should successfully parse expense life event', () => {
      const event = {
        id: 'evt-1',
        name: 'College Tuition',
        age: 65,
        type: 'expense',
        amount: 25000,
        inflationAdjusted: true,
      };
      expect(() => LifeEventSchema.parse(event)).not.toThrow();
    });

    it('should fail on negative amount or empty name', () => {
      const event = {
        id: 'evt-2',
        name: '',
        age: 65,
        type: 'expense',
        amount: -5000,
        inflationAdjusted: true,
      };
      expect(() => LifeEventSchema.parse(event)).toThrow();
    });
  });

  describe('SimulationConfigSchema', () => {
    it('should successfully parse default config with all_125_years', () => {
      const config = {
        drawdownStrategy: 'taxable_first',
        historicalRange: 'all_125_years',
      };
      const parsed = SimulationConfigSchema.parse(config);
      expect(parsed.numPaths).toBe(1000);
      expect(parsed.inflationRate).toBe(0.025);
      expect(parsed.retirementHorizon).toBe(30);
    });

    it('should successfully parse premium configs', () => {
      const config = {
        drawdownStrategy: 'proportional',
        historicalRange: 'most_recent_20_years',
        numPaths: 500,
        inflationRate: 0.03,
        retirementHorizon: 40,
        seed: 12345,
      };
      expect(() => SimulationConfigSchema.parse(config)).not.toThrow();
    });
  });

  describe('HouseholdSchema', () => {
    it('should successfully parse basic household demographics without optional aggregates', () => {
      const household = {
        name: 'Smith Family',
        taxJurisdiction: 'US',
        stateProvince: 'CA',
        birthYear: 1980,
        retirementAge: 65,
      };
      expect(() => HouseholdSchema.parse(household)).not.toThrow();
    });

    it('should successfully parse complete aggregate root with accounts, spending, pensions, lifeEvents, and simulationConfig', () => {
      const completePlan = {
        id: 'plan-123',
        user_id: 'user-456',
        name: 'Smith Family Plan',
        taxJurisdiction: 'US',
        stateProvince: 'CA',
        birthYear: 1980,
        retirementAge: 65,
        spouseBirthYear: 1982,
        spouseRetirementAge: 65,
        accounts: [
          {
            id: 'acc-1',
            name: 'Brokerage',
            type: 'taxable',
            balance: 1000000,
            costBasis: 800000,
            owner: 'joint',
          },
        ],
        spending: {
          initialBase: 60000,
          strategy: 'constant_dollar',
          inflationAdjusted: true,
        },
        pensions: [
          {
            id: 'pen-1',
            owner: 'primary',
            type: 'social_security',
            baseAmount: 30000,
            startAge: 67,
            inflationAdjusted: true,
          },
        ],
        lifeEvents: [],
        simulationConfig: {
          drawdownStrategy: 'taxable_first',
          historicalRange: 'all_125_years',
        },
      };
      expect(() => HouseholdSchema.parse(completePlan)).not.toThrow();
    });

    it('should fail if birthYear or retirementAge are invalid', () => {
      const invalidHousehold = {
        name: 'Smith Family',
        taxJurisdiction: 'US',
        stateProvince: 'CA',
        birthYear: 1800, // min 1900
        retirementAge: 65,
      };
      expect(() => HouseholdSchema.parse(invalidHousehold)).toThrow();
    });
  });

  describe('SimulationResultsSummarySchema', () => {
    it('should successfully parse valid simulation summary results', () => {
      const summary = {
        successRate: 95.5,
        medianFinalBalance: 2500000,
        tenthPercentileFinalBalance: 500000,
        ninetiethPercentileFinalBalance: 6000000,
        annualEndingBalances: [
          { year: 1, p10: 950000, p50: 1050000, p90: 1150000 },
        ],
      };
      expect(() => SimulationResultsSummarySchema.parse(summary)).not.toThrow();
    });

    it('should fail if successRate is outside [0, 100]', () => {
      const summary = {
        successRate: 105,
        medianFinalBalance: 2500000,
        tenthPercentileFinalBalance: 500000,
        ninetiethPercentileFinalBalance: 6000000,
      };
      expect(() => SimulationResultsSummarySchema.parse(summary)).toThrow();
    });
  });

  describe('QuickCheckParamsSchema', () => {
    it('should successfully parse valid QuickCheck parameters from URL query hydration', () => {
      const params = {
        portfolio: 1000000,
        withdrawal: 40000,
        years: 30,
        taxJurisdiction: 'US',
      };
      expect(() => QuickCheckParamsSchema.parse(params)).not.toThrow();
    });

    it('should fail if portfolio is negative or years is not positive', () => {
      const invalidParams = {
        portfolio: -100000,
        withdrawal: 40000,
        years: 0,
      };
      expect(() => QuickCheckParamsSchema.parse(invalidParams)).toThrow();
    });
  });
});
```

---

## 5. Verification Method

To independently verify the success of the implementation once the implementer creates the files, execute the following specific commands:

1. **Verify Unit Test Suite Execution & 100% Passing Coverage**:
   ```bash
   npm run test __tests__/planner/types.spec.ts
   ```
   *Expected Result*: Jest runs `__tests__/planner/types.spec.ts` successfully, passing all test suites with zero failures.

2. **Verify TypeScript Compilation & Strict Type Checking**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected Result*: Clean execution with zero TypeScript compile-time errors.

3. **Verify Git Status & Local-Only Principle**:
   ```bash
   git status
   ```
   *Expected Result*: Confirms all modified/created files are strictly local, with zero commits pushed to any remote repository.

4. **Invalidation Conditions**:
   - Any test failure in `__tests__/planner/types.spec.ts`.
   - TypeScript compile errors in `src/lib/planner/types.ts` or consuming files.
   - Any git push or remote branch modification.
