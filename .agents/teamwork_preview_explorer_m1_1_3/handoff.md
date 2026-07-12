# Handoff Report: Milestone M1.1 (Update SimulationConfig & Schema)

## 1. Observation
- **`PROJECT.md` (Lines 18-26)** defines the interface contract between `SimulationConfig` and `simulation.worker.ts`:
  ```markdown
  ### `SimulationConfig` ↔ `simulation.worker.ts`
  - `marketDataMode`: `'us' | 'global'`
  - `timelineMode`: `'retirement_only' | 'retirement_and_accumulation'`
  - `currentAge`: `number` (optional/disabled in retirement_only)
  - `retirementAge`: `number` (optional/disabled in retirement_only)
  - `additionalContribution`: `number` (optional/disabled in retirement_only)
  - `simulationMode`: `'historical' | 'monte_carlo'`
  ```
- **`.agents/sub_orch_m1_1/SCOPE.md` (Lines 12-19)** defines the contract and default values for `SimulationConfig`:
  ```markdown
  ### `SimulationConfig`
  - `marketDataMode`: `'us' | 'global'` (default `'us'`)
  - `timelineMode`: `'retirement_only' | 'retirement_and_accumulation'` (default `'retirement_only'`)
  - `currentAge`: `number` (optional)
  - `retirementAge`: `number` (optional)
  - `additionalContribution`: `number` (optional)
  - `simulationMode`: `'historical' | 'monte_carlo'` (default `'historical'`)
  ```
- **`src/types/simulation.ts` (Lines 25-117)** defines the `SimulationConfig` interface but currently lacks `marketDataMode`, `timelineMode`, `currentAge`, `retirementAge`, `additionalContribution`, and `simulationMode`.
- **`src/schemas/simulationSchema.ts` (Lines 28-133)** defines `simulationConfigSchema` using Zod but lacks the definitions and validation rules for the 6 new configuration properties.
- **`package.json` (Lines 5-13)** defines the project scripts for validation: `"build": "next build"`, `"test": "jest"`, `"test:e2e": "playwright test"`.

## 2. Logic Chain
1. **TypeScript Interface Alignment**: To satisfy the contracts in `PROJECT.md` and `SCOPE.md`, `SimulationConfig` in `src/types/simulation.ts` must be updated to include `marketDataMode`, `timelineMode`, and `simulationMode` as required literal union types (since defaults will be supplied by Zod upon parsing), and `currentAge`, `retirementAge`, `additionalContribution` as optional numbers.
2. **Zod Schema & Defaults**: To enforce the default values specified in `SCOPE.md` (`'us'`, `'retirement_only'`, `'historical'`), `simulationConfigSchema` in `src/schemas/simulationSchema.ts` must define these fields using `z.enum([...]).default(...)`. The numerical fields (`currentAge`, `retirementAge`, `additionalContribution`) should be defined with appropriate `min`/`max` bounds and marked `.optional()`.
3. **Validation Refinement for Accumulation Mode**: `PROJECT.md` notes that `currentAge`, `retirementAge`, and `additionalContribution` are applicable when `timelineMode` is `'retirement_and_accumulation'`. To ensure runtime safety and logical consistency, `simulationConfigSchema` should include a `.refine()` check ensuring that when `timelineMode === 'retirement_and_accumulation'`, `currentAge` and `retirementAge` are defined and `currentAge <= retirementAge`.

## 3. Caveats
- **Read-Only Exploration**: As Explorer 3, no code changes were implemented. The proposed changes must be applied by an implementer agent.
- **Downstream Consumer Impact**: Adding these fields to `SimulationConfig` will make `marketDataMode`, `timelineMode`, and `simulationMode` required in objects explicitly typed as `SimulationConfig`. Any existing mock data or instantiations in tests/UI that bypass Zod parsing (`simulationConfigSchema.parse`) may need to be updated to include the default values explicitly.

## 4. Conclusion
The implementer agent should apply the following precise updates:

### Update `src/types/simulation.ts`
Insert the 6 new properties into the `SimulationConfig` interface (e.g., right after `withdrawalStrategy: WithdrawalStrategy;` at line 31):
```typescript
  marketDataMode: 'us' | 'global';
  timelineMode: 'retirement_only' | 'retirement_and_accumulation';
  currentAge?: number;
  retirementAge?: number;
  additionalContribution?: number;
  simulationMode: 'historical' | 'monte_carlo';
```

### Update `src/schemas/simulationSchema.ts`
1. Insert the 6 new property schemas into `simulationConfigSchema` (e.g., right after `withdrawalStrategy: withdrawalStrategySchema,` at line 34):
```typescript
  marketDataMode: z.enum(['us', 'global']).default('us'),
  timelineMode: z.enum(['retirement_only', 'retirement_and_accumulation']).default('retirement_only'),
  currentAge: z.number().min(0).max(150).optional(),
  retirementAge: z.number().min(0).max(150).optional(),
  additionalContribution: z.number().min(0).max(10000000).optional(),
  simulationMode: z.enum(['historical', 'monte_carlo']).default('historical'),
```
2. Chain a new `.refine()` block at the end of `simulationConfigSchema` (after line 133):
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

## 5. Verification Method
After implementing the changes, the implementer must verify correctness using the following commands:
1. **Type Checking & Build**: Run Next.js build to verify TypeScript compilation across the entire project:
   ```bash
   npm run build
   ```
2. **Unit Tests**: Run Jest to ensure schema validations and existing calculation tests pass:
   ```bash
   npm run test
   ```
3. **Manual File Inspection**: Inspect `src/types/simulation.ts` and `src/schemas/simulationSchema.ts` to ensure no syntax errors or duplicate properties were introduced.
