# Scope: M1 - Core Types & Schemas Definition

## Architecture
- `src/types/simulation.ts`: Defines TypeScript interfaces for simulation configuration.
- `src/schemas/simulationSchema.ts`: Defines Zod validation schemas.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1.1: Update SimulationConfig & Schema | `src/types/simulation.ts`, `src/schemas/simulationSchema.ts` | none | DONE |

## Interface Contracts
### `SimulationConfig`
- `marketDataMode`: `'us' | 'global'` (default `'us'`)
- `timelineMode`: `'retirement_only' | 'retirement_and_accumulation'` (default `'retirement_only'`)
- `currentAge`: `number` (optional)
- `retirementAge`: `number` (optional)
- `additionalContribution`: `number` (optional)
- `simulationMode`: `'historical' | 'monte_carlo'` (default `'historical'`)

## Key Outputs
- `src/types/simulation.ts`: Updated `SimulationConfig` interface with `marketDataMode`, `timelineMode`, `currentAge`, `retirementAge`, `additionalContribution`, and `simulationMode`.
- `src/schemas/simulationSchema.ts`: Updated `simulationConfigSchema` with Zod property schemas, defaults, and accumulation refinement (`currentAge <= retirementAge`).
- `src/app/calculator/CalculatorParams.tsx`: Updated `useQueryStates` with new query states and defaults; resolved `react-hook-form` type check requirements.
- `jest.config.ts`: Added `<rootDir>/.agents/` to `testPathIgnorePatterns`.
- `__tests__/lib/adv_simulation_schema.test.ts`: Added adversarial test suite for `simulationConfigSchema`.
- `__tests__/simulationSchemaStress.test.ts`: Added stress test suite for `simulationConfigSchema`.
- Verification results: `npx tsc --noEmit`, `npm run test` (24 test suites, 165 tests passed), `npm run build` all passed successfully.
