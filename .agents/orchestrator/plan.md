# Project Plan: Financial Retirement Planner

## Goal
Implement a robust Financial Retirement Planner feature into `expense-dashboard` modeled after Foresight Planner, with Dual Entry architecture, Web Worker Monte Carlo simulation, Supabase RLS/BOLA defenses, and Premium Tier Historical Range Selector.

## Execution Strategy
Utilize the Project Pattern with Dual Track (Implementation Track + E2E Testing Track). Top-level Project Orchestrator delegates milestones to sub-orchestrators.

## Step-by-Step Plan
1. **Phase 1: Foundation & Test Infrastructure (Current)**
   - Dispatch M1 Sub-orchestrator to implement Zod schemas and pure TS business logic engines in `src/lib/planner/`.
   - Dispatch E2E Testing Orchestrator to design opaque-box E2E test infrastructure and test cases (Tiers 1-4) in `e2e/`, publishing `TEST_READY.md`.
   - Verify M1 via unit tests (`npm run test __tests__/planner`).

2. **Phase 2: Simulation Engine & Backend Security**
   - Dispatch M2 Sub-orchestrator to implement historical market data (`src/content/historicalMarketData.ts`) and Web Worker (`src/lib/planner/simulation.worker.ts`).
   - Dispatch M3 Sub-orchestrator to implement Supabase migration (`supabase/migrations/20260624000000_retirement_planner.sql`) and Server Actions (`src/app/actions/retirementActions.ts`) with BOLA & Premium defenses.
   - Verify M2 & M3 via unit tests.

3. **Phase 3: Frontend UI & State Management**
   - Dispatch M4 Sub-orchestrator to implement Zustand store (`src/store/useRetirementStore.tsx`), `QuickCheckWidget.tsx`, authenticated `/plans` dashboard, 7-tab Detailed Plan Builder, and `SimulationTab.tsx` with Premium Range Selector & Lock card.
   - Verify M4 via unit tests.

4. **Phase 4: Final Verification & Adversarial Hardening**
   - Dispatch M5 Sub-orchestrator for Phase 1 (Pass 100% of E2E test suite Tiers 1-4) and Phase 2 (Adversarial Coverage Hardening Tier 5).
   - Confirm zero git commits pushed to remote.
   - Deliver final report to user.
