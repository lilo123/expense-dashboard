# Project Plan: Expense Dashboard - Retirement Calculator Expansion

## Goal
Expand the Next.js retirement calculator with Global Market Data toggle, Accumulation Phase inputs, Timeline toggle, and Simulation Mode toggle (Historical vs. Scrambled Monte Carlo).

## Milestones & Execution Plan

### 1. M1: Core Types & Schemas Definition [DONE]
- Define Zod validation schemas (`Household`, `Account`, `Spending`, `Pension`, `LifeEvent`, `SimulationConfig`, `SimulationResultsSummary`, `QuickCheckParams`).
- Implement pure TypeScript business logic engines for tax, pension, spending, and drawdown.

### 2. M2: Global Market Data Ingestion & Processing [DONE]
- Parse verified MSCI World Index CSV (`/usr/local/google/home/duynguyenn/Downloads/chart.csv`).
- Bundle 125 years of empirical market returns into static interleaved `Float64Array`.

### 3. M3: Simulation Engine Expansion (Web Worker) [DONE]
- Implement dedicated Web Worker (`simulation.worker.ts`) executing 1,000 Monte Carlo block bootstrap simulation paths in parallel.

### 4. E2E Testing Track [DONE]
- Design comprehensive opaque-box test suite (`TEST_READY.md`).

### 5. M4: UI Inputs & Toggles Implementation [IN_PROGRESS]
- Build `QuickCheckWidget.tsx`, dual-representation Zustand store, authenticated `/plans` dashboard, and 7-tab Detailed Plan Builder.
- Implement Premium Tier Historical Range Selector (20 yr, 50 yr, 125 yr) with Premium Lock card.
- Verify with unit tests and E2E tests.

### 6. M5: Final Milestone (E2E Test Pass & Coverage Hardening) [PLANNED]
- Phase 1: Pass 100% of E2E test suite (Tiers 1-4) defined in `TEST_READY.md`.
- Phase 2: Adversarial coverage hardening (Tier 5) using Challenger → Worker → Reviewer loop.
