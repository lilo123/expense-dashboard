# Task: M1.3 Pension Engine Implementation (`src/lib/planner/pensionEngine.ts` & `__tests__/planner/pensionEngine.spec.ts`)

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Objective
Implement `src/lib/planner/pensionEngine.ts` as a pure TypeScript business logic engine with zero side effects, and implement its dedicated unit test suite `__tests__/planner/pensionEngine.spec.ts` achieving 100% test coverage and full passing verification via `npm run test __tests__/planner`.

## Architectural Specification (Synthesized from Explorers 1, 2, and 3)

### 1. Module Design (`src/lib/planner/pensionEngine.ts`)
- **Pure Function Contract**: The pension engine must be entirely pure, free of side effects, external database queries, or store state hooks, optimized for rapid zero-copy Web Worker execution across 1,000 Monte Carlo paths.
- **Interface Contracts**: Must import Zod schemas and inferred types from `src/lib/planner/types.ts` as needed (`Pension`, `Household`).
- **Data Structures**:
  ```typescript
  export interface PensionInput {
    pension: Pension;
    birthYear: number;
    currentAge: number;
    yearsElapsed: number;
    inflationRate: number;
    netIncomeForOas?: number;
  }

  export interface PensionOutput {
    pensionId: string;
    type: Pension['type'];
    owner: Pension['owner'];
    grossAmount: number;
    clawbackAmount: number;
    netAmount: number;
    claimAgeAdjustmentFactor: number;
  }
  ```

### 2. Core Exported Functions & Statutory Math
- `calculateSocialSecurityNra(birthYear: number): { years: number; months: number; totalMonths: number }`:
  - `<=1937` (65), `1938-1942` (65 + 2mo/yr), `1943-1954` (66), `1955-1959` (66 + 2mo/yr), `>=1960` (67). Returns years, months, and total months (`years * 12 + months`).
- `calculateSocialSecurityAdjustment(birthYear: number, startAge: number): number`:
  - Evaluates month delta `M = Math.round(startAge * 12) - nra.totalMonths`.
  - If `M < 0`, first 36 months early reduce factor by `5 / 900` per month, additional months early (up to 60 total) reduce factor by `5 / 1200` per month (clamped to minimum startAge 62).
  - If `M > 0`, delayed months increase factor by `2 / 300` per month up to age 70 (clamped past 70).
- `calculateCppAdjustment(startAge: number): number`:
  - Evaluates month delta `M = Math.round(clampedAge * 12) - 780` (clamped between 60 and 70).
  - If `M < 0`, reduction of `0.006` per month down to age 60 (max 36% reduction).
  - If `M > 0`, increase of `0.007` per month up to age 70 (max 42% increase).
- `calculateOasAdjustment(startAge: number): number`:
  - Claiming before 65 is disallowed (0 cashflow before 65, factor defaults to 1.0 at 65).
  - Delayed months after 65 increase factor by `0.006` per month up to age 70 (max 36% increase).
- `calculateOasClawback(grossOas: number, netIncome: number): number`:
  - Net income threshold `$90,997`, clawback rate `15%`. `clawback = Math.min(grossOas, Math.max(0, (netIncome - 90997) * 0.15))`.
- `calculatePensionBenefit(input: PensionInput): PensionOutput`:
  - For Defined Benefit, adjustment factor is fixed at 1.0.
  - For all pension types, if `pension.inflationAdjusted` is true, gross base amount is multiplied by `Math.pow(1 + inflationRate, Math.max(0, yearsElapsed))`.
  - If `currentAge < pension.startAge` or `pension.baseAmount <= 0`, immediately return 0 for gross and net amounts.
- `calculateAllPensions(household: Household, currentYear: number, inflationRate: number, netIncomeForOas?: number): PensionOutput[]`:
  - Iterates over `household.pensions`, correctly binds `birthYear` and `retirementAge` matching `owner === 'spouse'` to `household.spouseBirthYear` / `spouseRetirementAge`, calculates `currentAge = currentYear - birthYear` and `yearsElapsed = currentYear - (birthYear + retirementAge)`, and invokes `calculatePensionBenefit`.

### 3. Comprehensive Unit Test Suite (`__tests__/planner/pensionEngine.spec.ts`)
- Must use Jest `describe/it` blocks to achieve 100% test coverage across 6 distinct test suites:
  1. `calculateSocialSecurityNra`: Test birth years `<=1937`, `1938-1942`, `1943-1954`, `1955-1959`, and `>=1960`.
  2. `calculateSocialSecurityAdjustment`: Test early claim at 62 (NRA 67 & 66), exact NRA claim, delayed claim at 70 (NRA 67 & 66), clamping past 70.
  3. `calculateCppAdjustment`: Test early claim at 60 (0.64 factor), standard claim at 65 (1.0 factor), delayed claim at 70 (1.42 factor), out-of-bounds clamping (<60 or >70).
  4. `calculateOasAdjustment` & `calculateOasClawback`: Test claim before 65, exact 65 claim, delayed claim at 70 (1.36 factor). Test clawback below $90,997 (0 clawback), partial clawback above $90,997, full clawback exceeding gross OAS.
  5. `calculatePensionBenefit`: Test Defined Benefit (1.0 factor), `currentAge < startAge` (0 payout), `baseAmount <= 0`, `inflationAdjusted: true` vs `false`.
  6. `calculateAllPensions`: Test household with primary SS and spouse CPP/OAS, verifying correct binding of `spouseBirthYear`, `currentAge`, and `yearsElapsed`.

## Verification Protocol (You must run and verify these)
1. Run `npx tsc --noEmit` to verify complete type safety.
2. Run `npm run test __tests__/planner` to ensure 100% passing tests across `types.spec.ts`, `taxEngine.spec.ts`, and `pensionEngine.spec.ts`.
3. Verify `git status` confirms all changes are strictly local with zero commits pushed to remote git repositories.
4. Produce a self-contained `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_pension_engine_1`) documenting all commands run, passing test logs, and verified evidence.
