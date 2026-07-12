# Handoff Report: Milestone M1.1 (Update SimulationConfig & Schema)

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
- **`.agents/sub_orch_m1_1/SCOPE.md` (lines 12-19)** specifies the exact default values and optionality for `SimulationConfig`:
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
- **`src/schemas/simulationSchema.ts` (lines 28-111)** defines `simulationConfigSchema` using `z.object({...})` but currently lacks the validation definitions for the six new configuration properties.
- **`src/schemas/simulationSchema.ts` (lines 111-133)** demonstrates the existing pattern of using `.refine()` blocks for cross-field validations (e.g., asset allocation sum, min/max withdrawal comparisons).
- **`package.json` (lines 5-13)** defines project scripts including `"build": "next build"` and `"test": "jest"`.

## Logic Chain
1. **TypeScript Interface Updates**: Based on `PROJECT.md` and `SCOPE.md`, `SimulationConfig` in `src/types/simulation.ts` must be expanded to include the six new properties. `marketDataMode`, `timelineMode`, and `simulationMode` are required union string literal types, while `currentAge`, `retirementAge`, and `additionalContribution` are optional number types.
2. **Zod Schema Definition & Defaults**: In `src/schemas/simulationSchema.ts`, `simulationConfigSchema` must include Zod definitions matching the TypeScript interface. Per `SCOPE.md`, `marketDataMode` needs `.default('us')`, `timelineMode` needs `.default('retirement_only')`, and `simulationMode` needs `.default('historical')`.
3. **Zod Validation Constraints**: To maintain consistency with existing schema rules (e.g., `retirementStartingAge` which uses `.min(0).max(150)` and financial metrics using `.min(0).max(10000000)`), `currentAge` and `retirementAge` should be constrained to `z.number().min(0).max(150).optional()`, and `additionalContribution` to `z.number().min(0).max(10000000).optional()`.
4. **Cross-Field Refinement**: `PROJECT.md` specifies that `currentAge`, `retirementAge`, and `additionalContribution` are relevant for `retirement_and_accumulation`. Following the existing `.refine()` patterns in `src/schemas/simulationSchema.ts`, adding a `.refine()` check to ensure `currentAge <= retirementAge` when both are provided in `retirement_and_accumulation` mode will prevent invalid simulation timeframes.

## Caveats
- **Downstream Consumer Impact**: Adding required fields (`marketDataMode`, `timelineMode`, `simulationMode`) to `SimulationConfig` without optional flags in TypeScript may cause type errors in existing UI components or test mocks if they construct `SimulationConfig` objects directly without relying on `simulationConfigSchema.parse()` (which provides the defaults). Implementers of subsequent milestones (M3, M4) will need to ensure these fields are populated or parsed correctly.
- **Read-Only Scope**: As an Explorer agent, no changes were implemented or directly tested against the Next.js build system.

## Conclusion
The recommended fix strategy is to update `src/types/simulation.ts` and `src/schemas/simulationSchema.ts` with the new properties and validation rules as follows:

### 1. Proposed Changes to `src/types/simulation.ts`
Insert the new properties into the `SimulationConfig` interface (e.g., right after `withdrawalStrategy: WithdrawalStrategy;` at line 32):

```typescript
  // --- M1 Core Simulation Modes & Timeline Parameters ---
  marketDataMode: 'us' | 'global';
  timelineMode: 'retirement_only' | 'retirement_and_accumulation';
  currentAge?: number;
  retirementAge?: number;
  additionalContribution?: number;
  simulationMode: 'historical' | 'monte_carlo';
```

### 2. Proposed Changes to `src/schemas/simulationSchema.ts`
Add the property definitions to `simulationConfigSchema` (e.g., after `withdrawalStrategy: withdrawalStrategySchema,` at line 34):

```typescript
  // --- M1 Core Simulation Modes & Timeline Parameters ---
  marketDataMode: z.enum(['us', 'global']).default('us'),
  timelineMode: z.enum(['retirement_only', 'retirement_and_accumulation']).default('retirement_only'),
  currentAge: z.number().min(0).max(150).optional(),
  retirementAge: z.number().min(0).max(150).optional(),
  additionalContribution: z.number().min(0).max(10000000).optional(),
  simulationMode: z.enum(['historical', 'monte_carlo']).default('historical'),
```

Chain an additional `.refine()` block to `simulationConfigSchema` (e.g., at the end of the existing refinements around line 133):

```typescript
.refine((data) => {
  if (data.timelineMode === 'retirement_and_accumulation') {
    if (data.currentAge !== undefined && data.retirementAge !== undefined) {
      return data.currentAge <= data.retirementAge;
    }
  }
  return true;
}, {
  message: 'Current age cannot exceed retirement age in accumulation mode',
  path: ['currentAge'],
});
```

## Verification Method
To independently verify the changes once implemented:
1. **TypeScript Type Check**: Run `npm run build` or `npx tsc --noEmit` from the project root (`/usr/local/google/home/duynguyenn/expense-dashboard`) to verify that `src/types/simulation.ts` and `src/schemas/simulationSchema.ts` compile successfully without type errors.
2. **Unit Tests & Schema Validation**: Run `npm test` or `npx jest` to execute the test suite and ensure that existing tests pass and Zod schema defaults/refinements function correctly.
3. **Invalidation Conditions**: The verification fails if `z.infer<typeof simulationConfigSchema>` diverges from `SimulationConfig`, or if existing components fail to compile due to missing default values in unparsed config objects.
