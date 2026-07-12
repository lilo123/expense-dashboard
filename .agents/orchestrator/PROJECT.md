# Project: Financial Retirement Planner

## Architecture
- Module/package boundaries, data flow, shared interfaces
- Dual Entry architecture: public Quick Check widget (`src/app/page.tsx`, `QuickCheckWidget.tsx`) vs authenticated 7-tab SPA (`/plans`, `/plans/new`, `/plans/[id]`).
- State Management: Dual-representation Zustand store (`src/store/useRetirementStore.tsx`) hydrated via URL search params (`/auth?redirect=/plans/new...`).
- Pure Business Logic Engines: Zod validation schemas in `src/lib/planner/types.ts`, pure TS engines for tax (`taxEngine.ts`), pension (`pensionEngine.ts`), spending (`spendingEngine.ts`), drawdown & simulation (`drawdownEngine.ts`, `simulator.ts`).
- Web Worker Simulation Engine: 125 years of empirical market returns (1900-2025) in `src/content/historicalMarketData.ts` (static interleaved `Float64Array`). Web Worker (`src/lib/planner/simulation.worker.ts`) executing 1,000 Monte Carlo block bootstrap paths in parallel using in-place numerical sorting (`subarray().sort()`) and Transferable Objects for zero-copy IPC.
- Security & Backend: Supabase migrations (`supabase/migrations/20260624000000_retirement_planner.sql`) with strict RLS (`auth.uid() = user_id`). Server Actions (`src/app/actions/retirementActions.ts`) with BOLA defense and Premium entitlement checks (`profiles.tier === 'premium'`). In `SimulationTab.tsx`, Premium Tier Historical Range Selector (20 yr, 50 yr, 125 yr) with An-yen frosted glass Premium Lock card for free tiers.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Core Domain Types & Pure Business Logic Engines | `src/lib/planner/types.ts`, `taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`, and unit tests | none | DONE |
| 2 | Web Worker Simulation Engine & Market Data | `src/content/historicalMarketData.ts`, `src/lib/planner/simulation.worker.ts`, and unit tests | M1 | DONE |
| 3 | Database Migration & Server Actions (BOLA & Premium Defenses) | `supabase/migrations/20260624000000_retirement_planner.sql`, `src/app/actions/retirementActions.ts`, and unit tests | M1 | DONE |
| 4 | Dual Entry UI, Zustand Store & Premium Range Selector | `src/store/useRetirementStore.tsx`, `src/app/page.tsx` (`QuickCheckWidget.tsx`), `/plans` dashboard, 7-tab Detailed Plan Builder (`/plans/new`, `/plans/[id]`), `SimulationTab.tsx`, and unit tests | M1, M2, M3 | DONE |
| 5 | Final Milestone - E2E Test Verification & Adversarial Hardening | Phase 1 (Pass 100% of E2E test suite Tiers 1-4), Phase 2 (Adversarial Coverage Hardening Tier 5) | M1, M2, M3, M4, TEST_READY.md | IN_PROGRESS |

## Interface Contracts
### `src/lib/planner/types.ts` ↔ Engines & Store
- Zod schemas: `Household`, `Account`, `Spending`, `Pension`, `LifeEvent`, `SimulationConfig`, `SimulationResultsSummary`, `QuickCheckParams`.
- Exported TypeScript types inferred from Zod schemas.

### `src/lib/planner/simulation.worker.ts` ↔ `src/store/useRetirementStore.tsx`
- Web Worker message contract: `{ action: 'simulate', config: SimulationConfig, marketData: Float64Array }`.
- Response contract: Transferable Object containing simulation results buffer / summary.

### `src/app/actions/retirementActions.ts` ↔ Frontend Components
- `savePlan(plan: Household & { id?: string }): Promise<{ success: boolean, planId?: string, error?: string }>` with BOLA defense and Premium checks.
- `getPlans(): Promise<{ success: boolean, plans?: any[], error?: string }>`
- `getPlan(id: string): Promise<{ success: boolean, plan?: any, error?: string }>`

## Code Layout
- Domain types & engines: `src/lib/planner/*.ts`
- Web worker: `src/lib/planner/simulation.worker.ts`
- Market data: `src/content/historicalMarketData.ts`
- Zustand store: `src/store/useRetirementStore.tsx`
- Server actions: `src/app/actions/retirementActions.ts`
- Supabase migration: `supabase/migrations/20260624000000_retirement_planner.sql`
- Frontend UI: `src/app/page.tsx` (QuickCheckWidget), `src/app/(dashboard)/plans/**`
- Unit tests: `__tests__/planner/*.spec.ts`
- E2E tests: `e2e/*.spec.ts`
