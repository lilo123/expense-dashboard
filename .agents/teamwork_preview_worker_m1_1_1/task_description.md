# Task Description: Worker 1 (M1.1)

## Objective
Implement the changes recommended by the Explorers to `src/types/simulation.ts` and `src/schemas/simulationSchema.ts` to add `marketDataMode`, `timelineMode`, `currentAge`, `retirementAge`, `additionalContribution`, and `simulationMode` per `PROJECT.md` and `SCOPE.md`.

## Mandatory Integrity Warning
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Loaded Skill
Load the Jetski skill at:
`/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

## Input Information
- `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m1_1/SCOPE.md`
- Explorer handoff reports in `.agents/teamwork_preview_explorer_m1_1_1/handoff.md`, `.agents/teamwork_preview_explorer_m1_1_2/handoff.md`, `.agents/teamwork_preview_explorer_m1_1_3/handoff.md`

## Synthesized Implementation Plan

### 1. Update `src/types/simulation.ts`
Add the 6 new properties to the `SimulationConfig` interface:
```typescript
  marketDataMode: 'us' | 'global';
  timelineMode: 'retirement_only' | 'retirement_and_accumulation';
  currentAge?: number;
  retirementAge?: number;
  additionalContribution?: number;
  simulationMode: 'historical' | 'monte_carlo';
```
*Note*: If making `marketDataMode`, `timelineMode`, and `simulationMode` required causes TypeScript errors in existing files/tests where `SimulationConfig` objects are created directly without Zod parsing, you may make them optional (`marketDataMode?: 'us' | 'global';`, etc.) or update the affected object literals to ensure 100% passing builds and tests.

### 2. Update `src/schemas/simulationSchema.ts`
Add the 6 new property schemas to `simulationConfigSchema`:
```typescript
  marketDataMode: z.enum(['us', 'global']).default('us'),
  timelineMode: z.enum(['retirement_only', 'retirement_and_accumulation']).default('retirement_only'),
  currentAge: z.number().min(0).max(150).optional(),
  retirementAge: z.number().min(0).max(150).optional(),
  additionalContribution: z.number().min(0).max(10000000).optional(),
  simulationMode: z.enum(['historical', 'monte_carlo']).default('historical'),
```
Chain a `.refine()` block at the end of `simulationConfigSchema`:
```typescript
.refine((data) => {
  if (data.timelineMode === 'retirement_and_accumulation') {
    return data.currentAge !== undefined && data.retirementAge !== undefined && data.currentAge <= data.retirementAge;
  }
  return true;
}, {
  message: 'Current age and retirement age must be provided and current age must be less than or equal to retirement age when accumulation is enabled',
  path: ['currentAge'],
});
```

## Verification Requirements
You MUST run the following commands and ensure they pass successfully:
1. `npx tsc --noEmit`
2. `npm run test`
3. `npm run build`

## Output Requirements
Write `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m1_1_1`) documenting the changes made, the exact verification commands run, and their passing results.

## Completion Criteria
`handoff.md` is written with passing verification results and you send a completion message to your parent.
