## 2026-06-23T21:33:37Z

You are a teamwork_preview_worker. Your identity is Spending Engine Worker.
Your working directory is: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_spending_engine

Load the Jetski skill at:
  /google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md

Your mission is to implement Milestone 1.4: Spending Engine (src/lib/planner/spendingEngine.ts) and its comprehensive unit tests (__tests__/planner/spendingEngine.spec.ts).

Here is the synthesized specification and findings from 3 independent Explorers:

### 1. Architectural Style & Interfaces (src/lib/planner/spendingEngine.ts)
The module must be implemented as pure TypeScript functions with zero side effects, importing Zod schemas and inferred types from src/lib/planner/types.ts, matching the design patterns of taxEngine.ts and pensionEngine.ts.

Define the following interfaces:
```typescript
import { Spending, Household } from './types';

export interface SpendingInput {
  spending: Spending;
  currentPortfolioBalance: number;
  initialPortfolioBalance: number;
  yearsElapsed: number;
  inflationRate: number;
  priorYearWithdrawal?: number;
}

export interface SpendingOutput {
  strategy: Spending['strategy'];
  targetWithdrawal: number; // Requested withdrawal before portfolio balance clamping
  actualWithdrawal: number; // Final withdrawal clamped by currentPortfolioBalance
  inflationFactor: number;
  unconstrainedWithdrawal?: number;
  floor?: number;
  ceiling?: number;
  stabilityComponent?: number;
  marketComponent?: number;
  isClampedByFloor?: boolean; // For vanguard_dynamic: true if unconstrained < effectiveMin
  isClampedByCeiling?: boolean; // For vanguard_dynamic: true if unconstrained > effectiveMax
  isClampedByPortfolio: boolean; // True if targetWithdrawal > currentPortfolioBalance
}
```

### 2. Implementation Mechanics & Helpers
Implement the following pure helper functions and delegators:

1. **calculateInflationFactor**: `const inflationFactor = spending.inflationAdjusted ? Math.pow(1 + Math.max(-1.0, inflationRate), Math.max(0, yearsElapsed)) : 1.0;`
2. **calculateConstantDollar(input: SpendingInput): SpendingOutput**:
   - `targetWithdrawal = spending.initialBase * inflationFactor`.
   - `clampedBalance = Math.max(0, currentPortfolioBalance)`.
   - `actualWithdrawal = Math.min(targetWithdrawal, clampedBalance)`.
   - `isClampedByPortfolio = targetWithdrawal > clampedBalance`.
3. **calculateVanguardDynamic(input: SpendingInput): SpendingOutput**:
   - If `initialPortfolioBalance > 0`, `baseRate = spending.initialBase / initialPortfolioBalance`, `unconstrainedWithdrawal = Math.max(0, currentPortfolioBalance) * baseRate`.
   - If `initialPortfolioBalance <= 0`, fallback `unconstrainedWithdrawal = spending.initialBase * inflationFactor` (guards against division by zero).
   - `rawMin = spending.minWithdrawal ?? spending.initialBase`, `rawMax = spending.maxWithdrawal ?? spending.initialBase`.
   - Handle inverted clamps defensively: `effectiveMin = Math.min(rawMin, rawMax) * inflationFactor`, `effectiveMax = Math.max(rawMin, rawMax) * inflationFactor`.
   - Clamp unconstrained withdrawal between floor (`effectiveMin`) and ceiling (`effectiveMax`), setting `isClampedByFloor` and `isClampedByCeiling` accordingly.
   - Clamp final `targetWithdrawal` by `clampedBalance` to compute `actualWithdrawal` and `isClampedByPortfolio`.
4. **calculateYaleEndowment(input: SpendingInput): SpendingOutput**:
   - `w = Math.max(0, Math.min(1, spending.yaleWeight ?? 0.7))`.
   - If `yearsElapsed <= 0` or `priorYearWithdrawal === undefined`, `stabilityComponent = spending.initialBase * inflationFactor`.
   - Otherwise, `stabilityComponent = Math.max(0, priorYearWithdrawal) * (spending.inflationAdjusted ? (1 + Math.max(-1.0, inflationRate)) : 1.0)`.
   - If `initialPortfolioBalance > 0`, `marketComponent = Math.max(0, currentPortfolioBalance) * (spending.initialBase / initialPortfolioBalance)`.
   - If `initialPortfolioBalance <= 0`, fallback `marketComponent = spending.initialBase * inflationFactor`.
   - `targetWithdrawal = w * stabilityComponent + (1 - w) * marketComponent`.
   - Compute `actualWithdrawal` and `isClampedByPortfolio`.
5. **calculateSpendingWithdrawal(input: SpendingInput): SpendingOutput**: Branches cleanly based on `input.spending.strategy`.
6. **calculateHouseholdSpending(household: Household, currentPortfolioBalance: number, initialPortfolioBalance: number, currentYear: number, inflationRate: number, priorYearWithdrawal?: number): SpendingOutput | null**:
   - Returns `null` if `!household.spending`.
   - Calculates `yearsElapsed = currentYear - (household.birthYear + household.retirementAge)`.
   - Delegates to `calculateSpendingWithdrawal`.

### 3. Unit Test Suite (__tests__/planner/spendingEngine.spec.ts)
Implement a comprehensive unit test suite covering:
- **Happy Path**: Constant Dollar (with/without inflation), Vanguard Dynamic (unconstrained, floor/ceiling clamps in bull/bear markets), Yale Endowment (weighting mechanics with/without priorYearWithdrawal), and calculateHouseholdSpending.
- **Boundary Cases**: `yearsElapsed <= 0`, `inflationRate === 0`, `initialPortfolioBalance === 0`, `currentPortfolioBalance === 0`, `yaleWeight === 0` or `1`, `minWithdrawal === maxWithdrawal`, and `household.spending === undefined`.
- **Adversarial Testing**: Missing optional parameters in `Spending` (bypassing Zod), inverted clamps (`minWithdrawal > maxWithdrawal`), extreme `yearsElapsed` (e.g. 1000), hyperinflation (`inflationRate: 10.0`), deflation (`inflationRate: -0.05`), negative balances, and division-by-zero resilience.

### 4. Verification Requirements
Run the following commands using run_command to independently verify your implementation:
1. `npm run test __tests__/planner/spendingEngine.spec.ts` (verify 100% passing tests)
2. `npm run test __tests__/planner` (verify zero regressions across types.spec.ts, taxEngine.spec.ts, pensionEngine.spec.ts)
3. `npx tsc --noEmit` (verify clean static analysis)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

When complete, write your handoff report to handoff.md in your working directory, documenting the verified commands, test output, and code contracts, and send a message back to me.
