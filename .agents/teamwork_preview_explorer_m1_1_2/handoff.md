# Handoff Report: Explorer 2 (M1.1)

## Observation
- **`PROJECT.md` (lines 18-26)** defines the interface contract between `SimulationConfig` and `simulation.worker.ts`:
  ```
  ### `SimulationConfig` ↔ `simulation.worker.ts`
  - `marketDataMode`: `'us' | 'global'`
  - `timelineMode`: `'retirement_only' | 'retirement_and_accumulation'`
  - `currentAge`: `number` (optional/disabled in retirement_only)
  - `retirementAge`: `number` (optional/disabled in retirement_only)
  - `additionalContribution`: `number` (optional/disabled in retirement_only)
  - `simulationMode`: `'historical' | 'monte_carlo'`
  ```
- **`.agents/sub_orch_m1_1/SCOPE.md` (lines 12-20)** confirms these fields and specifies default values:
  ```
  ### `SimulationConfig`
  - `marketDataMode`: `'us' | 'global'` (default `'us'`)
  - `timelineMode`: `'retirement_only' | 'retirement_and_accumulation'` (default `'retirement_only'`)
  - `currentAge`: `number` (optional)
  - `retirementAge`: `number` (optional)
  - `additionalContribution`: `number` (optional)
  - `simulationMode`: `'historical' | 'monte_carlo'` (default `'historical'`)
  ```
- **`src/types/simulation.ts` (lines 25-117)** defines the `SimulationConfig` interface but currently lacks `marketDataMode`, `timelineMode`, `currentAge`, `retirementAge`, `additionalContribution`, and `simulationMode`.
- **`src/schemas/simulationSchema.ts` (lines 28-135)** defines `simulationConfigSchema` using Zod, with `SimulationConfigSchemaType` inferred from it. It currently lacks the new configuration fields and has existing `.refine()` blocks for cross-field validations (e.g., `minWithdrawal <= maxWithdrawal`, asset allocation summing to 100).

## Logic Chain
1. To satisfy the contracts in `PROJECT.md` and `SCOPE.md`, `SimulationConfig` in `src/types/simulation.ts` must be updated to include `marketDataMode`, `timelineMode`, and `simulationMode` as required literal union types, and `currentAge`, `retirementAge`, and `additionalContribution` as optional number types.
2. `simulationConfigSchema` in `src/schemas/simulationSchema.ts` must be updated with corresponding Zod definitions. To ensure Zod's inferred output type matches the required fields in `SimulationConfig`, `.default()` must be used for `marketDataMode` (`'us'`), `timelineMode` (`'retirement_only'`), and `simulationMode` (`'historical'`).
3. For `currentAge` and `retirementAge`, `z.number().min(0).max(150).optional()` aligns with the existing `retirementStartingAge` validation in `simulationConfigSchema`.
4. For `additionalContribution`, `z.number().min(0).max(10000000).optional()` aligns with existing portfolio and withdrawal bounds.
5. Per `PROJECT.md`, `currentAge`, `retirementAge`, and `additionalContribution` are intended for `retirement_and_accumulation`. A `.refine()` block should be added to `simulationConfigSchema` to ensure that when `timelineMode === 'retirement_and_accumulation'`, `currentAge` and `retirementAge` are defined and `currentAge < retirementAge`.

## Caveats
- No caveats. The requirements in `PROJECT.md` and `SCOPE.md` are fully aligned with the proposed type and schema definitions.

## Conclusion
The recommended fix strategy is to update `src/types/simulation.ts` and `src/schemas/simulationSchema.ts` with the exact definitions below:

### 1. Proposed Additions to `SimulationConfig` in `src/types/simulation.ts`
Add the following properties to the `SimulationConfig` interface (e.g., right after `withdrawalStrategy`):
```typescript
  marketDataMode: 'us' | 'global';
  timelineMode: 'retirement_only' | 'retirement_and_accumulation';
  currentAge?: number;
  retirementAge?: number;
  additionalContribution?: number;
  simulationMode: 'historical' | 'monte_carlo';
```

### 2. Proposed Additions to `simulationConfigSchema` in `src/schemas/simulationSchema.ts`
Add the following property schemas to `simulationConfigSchema`:
```typescript
  marketDataMode: z.enum(['us', 'global']).default('us'),
  timelineMode: z.enum(['retirement_only', 'retirement_and_accumulation']).default('retirement_only'),
  currentAge: z.number().min(0).max(150).optional(),
  retirementAge: z.number().min(0).max(150).optional(),
  additionalContribution: z.number().min(0).max(10000000).optional(),
  simulationMode: z.enum(['historical', 'monte_carlo']).default('historical'),
```

### 3. Proposed Refinement in `src/schemas/simulationSchema.ts`
Chain the following `.refine()` block to `simulationConfigSchema`:
```typescript
.refine((data) => {
  if (data.timelineMode === 'retirement_and_accumulation') {
    return data.currentAge !== undefined && data.retirementAge !== undefined && data.currentAge < data.retirementAge;
  }
  return true;
}, {
  message: 'Current age must be defined and less than retirement age when accumulation is enabled',
  path: ['currentAge'],
})
```

## Verification Method
After implementing the changes, verify the correctness of the types and schemas by running:
1. `blaze build //...` (or the project's TypeScript compilation / build command) to verify there are no TypeScript compilation errors.
2. `blaze test //...` (or the project's test runner) to ensure existing tests pass and schema validations function correctly.
3. Inspect `src/types/simulation.ts` and `src/schemas/simulationSchema.ts` to confirm the exact properties and refinement logic are in place.
