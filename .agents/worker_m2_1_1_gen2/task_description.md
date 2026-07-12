# Task Description: M2.1 Historical Market Data Refinement (Worker 1 gen2)

## Objective
Implement the integer validation check `!Number.isInteger(year)` in `getYearMarketData` within `src/content/historicalMarketData.ts` based on the synthesized recommendations of the Explorer agents. Verify the implementation by running `npx tsc --noEmit`, `npm run test __tests__/planner/historicalMarketData.spec.ts`, and `npm run test __tests__/planner/adv_historicalMarketData.spec.ts`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Attached Skill Path
Load the Jetski skill at:
  `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/greenfield_development/SKILL.md`

## Synthesized Explorer Recommendations

### `src/content/historicalMarketData.ts`
Modify the guard condition in `getYearMarketData` (around line 74) to include `!Number.isInteger(year)`.

```typescript
// before
export function getYearMarketData(year: number): { stocks: number; bonds: number; inflation: number } | null {
  if (year < 1901 || year > 2025) {
    return null;
  }
  const index = (year - 1901) * 3;

// after
export function getYearMarketData(year: number): { stocks: number; bonds: number; inflation: number } | null {
  if (!Number.isInteger(year) || year < 1901 || year > 2025) {
    return null;
  }
  const index = (year - 1901) * 3;
```

## Output Requirements
- Write your completion report to `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/worker_m2_1_1_gen2`).
- Include passing test results and verification commands in your handoff report.
- Send a message back to me when complete.
