# Scope: M3 - Database Migration & Server Actions (BOLA & Premium Defenses)

## Architecture
- Implement Supabase migrations (`supabase/migrations/20260624000000_retirement_planner.sql`) with strict Row Level Security (`auth.uid() = user_id`).
- Implement Server Actions (`src/app/actions/retirementActions.ts`) with BOLA defense and Premium entitlement checks (`profiles.tier === 'premium'`).
- Implement comprehensive unit tests in `__tests__/planner/` to verify 100% passing test coverage (`npm run test __tests__/planner`).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Supabase Migration & RLS | `supabase/migrations/20260624000000_retirement_planner.sql` | M1 | DONE (20260624000000_retirement_planner.sql created, verified CLEAN) |
| 2 | Server Actions (BOLA & Premium Defenses) | `src/app/actions/retirementActions.ts`, `__tests__/planner/retirementActions.spec.ts` | M3.1 | DONE (retirementActions.ts & spec created, tests 11/11 passing, verified CLEAN) |

## Interface Contracts
### `src/app/actions/retirementActions.ts` ↔ Frontend Components
- `savePlan(plan: Household & { id?: string }): Promise<{ success: boolean, planId?: string, error?: string }>` with BOLA defense and Premium checks.
- `getPlans(): Promise<{ success: boolean, plans?: any[], error?: string }>`
- `getPlan(id: string): Promise<{ success: boolean, plan?: any, error?: string }>`
