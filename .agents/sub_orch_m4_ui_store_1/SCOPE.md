# Scope: M4 - Dual Entry UI, Zustand Store & Premium Range Selector

## Architecture
- Build a dual-representation Zustand store (`src/store/useRetirementStore.tsx`) hydrated via URL search params (`/auth?redirect=/plans/new...`).
- Build a public `QuickCheckWidget.tsx` on `src/app/page.tsx` that executes in-memory simulations and passes parameters via URL search params to hydrate the Zustand store.
- Build the authenticated `/plans` dashboard and 7-tab Detailed Plan Builder (`/plans/new`, `/plans/[id]`).
- In `SimulationTab.tsx`, implement a Premium Tier Historical Range Selector (20 yr, 50 yr, 125 yr) with an An-yen frosted glass Premium Lock card for free tiers (`profiles.tier !== 'premium'`).
- Implement comprehensive unit tests in `__tests__/planner/` to verify 100% passing test coverage (`npm run test __tests__/planner`).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Zustand Store & URL Hydration | `src/store/useRetirementStore.tsx`, `__tests__/planner/useRetirementStore.spec.ts` | M1, M2, M3 | PLANNED |
| 2 | Public Quick Check Widget | `src/app/page.tsx` (`QuickCheckWidget.tsx`), `__tests__/planner/quickCheckWidget.spec.ts` | M4.1 | PLANNED |
| 3 | Authenticated Dashboard & 7-Tab Builder | `/plans` dashboard, `/plans/new`, `/plans/[id]`, 7-tab Detailed Plan Builder | M4.1 | PLANNED |
| 4 | Simulation Tab & Premium Range Selector | `SimulationTab.tsx`, Premium Tier Historical Range Selector (20/50/125 yr), An-yen frosted glass Premium Lock card | M4.1, M4.3 | PLANNED |

## Interface Contracts
### `src/store/useRetirementStore.tsx` ↔ Web Worker & UI
- Zustand store manages simulation config, household state, active tab, and simulation results summary.
- Communicates with Web Worker (`src/lib/planner/simulation.worker.ts`) for background simulation execution.
- Hydrated from URL search params when navigated from Quick Check widget.
