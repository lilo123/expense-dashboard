# Original User Request

## 2026-06-23T19:24:19Z

Implement a robust Financial Retirement Planner feature into `expense-dashboard` modeled after Foresight Planner, featuring a Dual Entry architecture (public Quick Check widget and authenticated 7-tab SPA) and a post-login Premium Tier Historical Range Selector (20 yr, 50 yr, 125 yr), running 1,000 parallel Monte Carlo block bootstrap simulation paths via Web Worker.

Working directory: /usr/local/google/home/duynguyenn/expense-dashboard
Integrity mode: development

## Requirements

### R1. Core Domain Types & Pure Business Logic Engines
Define Zod validation schemas (`Household`, `Account`, `Spending`, `Pension`, `LifeEvent`, `SimulationConfig`, `SimulationResultsSummary`, `QuickCheckParams`) in `src/lib/planner/types.ts`. Implement pure TypeScript business logic engines for US/CA progressive tax brackets (`taxEngine.ts`), public pension claim-age adjustments and OAS clawbacks (`pensionEngine.ts`), spending withdrawal strategies (`spendingEngine.ts`), and drawdown sequencing (`drawdownEngine.ts`, `simulator.ts`).

### R2. Web Worker Simulation Engine & Market Data
Bundle 125 years of empirical market returns (1900–2025) into a static interleaved `Float64Array` (`src/content/historicalMarketData.ts`) with index offsets for 20-year and 50-year ranges. Implement a dedicated Web Worker (`simulation.worker.ts`) that executes 1,000 Monte Carlo block bootstrap simulation paths in parallel using in-place numerical sorting (`subarray().sort()`) and Transferable Objects for zero-copy IPC.

### R3. Dual Entry UI & Premium Range Selector
Build a public `QuickCheckWidget.tsx` on `src/app/page.tsx` that executes in-memory simulations and passes parameters via URL search params (`/auth?redirect=/plans/new...`) to hydrate a dual-representation Zustand store (`useRetirementStore.tsx`). Build the authenticated `/plans` dashboard and 7-tab Detailed Plan Builder (`/plans/new`, `/plans/[id]`). In `SimulationTab.tsx`, implement a Premium Tier Historical Range Selector (20 yr, 50 yr, 125 yr) with an An-yen frosted glass Premium Lock card for free tiers.

### R4. Local Implementation, BOLA Defenses & Zero Git Push
Implement Supabase migrations (`20260624000000_retirement_planner.sql`) with strict Row Level Security (`auth.uid() = user_id`) and Server Actions (`retirementActions.ts`) with BOLA defense and Premium entitlement checks (`profiles.tier === 'premium'`). All work must be executed locally; do NOT push anything to git.

## Acceptance Criteria

### Verification & Testing Suite
- [ ] `npm run test __tests__/planner` executes successfully with 100% passing unit tests across Zod schemas, tax/pension/spending/drawdown engines, Zustand store URL hydration, and Server Actions.
- [ ] `npx tsx e2e/run_e2e.ts` executes successfully with 100% passing Playwright E2E integration tests verifying Dual Entry state handoff, Premium Lock validation, and automated `@axe-core/playwright` accessibility audits (zero WCAG 2.1 AA/AAA violations).
- [ ] `git status` verifies all changes exist strictly in the local working directory with zero commits pushed to remote git repositories.

<latest_turn_user_message>
go ahead, do NOT push it to git production environment
</latest_turn_user_message>

## 2026-06-24T23:21:25Z

Your previous invocation encountered a temporary HTTP 502 Server Error while Worker 1 Iteration 3 was actively monitoring `task-31` (`npx tsx e2e/run_e2e.ts`). Please resume your orchestrator execution loop, verify the progress of Worker 1 Iteration 3, and continue managing the M5.1 verification swarm towards the final victory claim.

## 2026-07-03T19:45:21Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Expand the Next.js retirement calculator at `/usr/local/google/home/duynguyenn/expense-dashboard` with a Global Market Data toggle (MSCI World Index), Accumulation Phase contribution inputs, a Timeline Calculation toggle (Retirement Only vs. Retirement & Accumulation), and a Simulation Mode toggle (Historical Backtesting vs. Scrambled Monte Carlo).

Working directory: `/usr/local/google/home/duynguyenn/expense-dashboard`
Integrity mode: demo

> [!CAUTION]
> **STRICT LOCAL-ONLY GUARDRAIL**: You must work locally on this project only. Do NOT push anything to GitHub or execute any `git push` commands until explicit approval is granted by the user.

## Requirements

### R1. Global Market Data Toggle
Parse the verified MSCI World Index CSV file located at `/usr/local/google/home/duynguyenn/Downloads/chart.csv` containing historical monthly return data starting from `12/1969`. Include a user-facing toggle in the general input section that allows users to switch the underlying stock return data between the US market and the Global market.

### R2. Accumulation Phase & Timeline Calculation Toggle
Update the general input section to include new fields for "Current Age" and "Additional Yearly Contributions." Introduce a toggle to switch between two distinct calculation behaviors:
1. **Retirement Period Only**: Disables and greys out the Retirement Age, Current Age, and Additional Yearly Contributions fields. This mode maintains the current application logic, simulating only the withdrawal phase.
2. **Retirement & Accumulation Period**: Combines both phases into a single continuous timeline. For example, if a user plans to work for 20 years and retire for 30 years, the total calculation period is 50 years. The first 20 years (accumulation phase) will apply zero withdrawals, add the yearly contributions, and compound market interest. The final 30 years will function as the standard retirement withdrawal phase.

### R3. Simulation Mode Toggle (Historical Backtesting vs. Scrambled Monte Carlo)
Introduce a toggle in the UI to switch between `Historical Backtesting` (sequential historical periods in chronological order) and `Scrambled Monte Carlo`. When `Scrambled Monte Carlo` is active, the model will generate 1,000 unique simulations by randomly drawing annual returns from the historical dataset using a seeded pseudo-random number generator (e.g., Mulberry32) so that results are deterministic and reproducible across page reloads. For example, for a 50-year timeline, the calculator will randomly select 50 individual years of returns from the available data pool to build each of the 1,000 distinct combinations, and the existing views (`SummaryView`, `PortfolioValueView`, `AvailableSpendingView`, `SimulationsListView`) will seamlessly render these 1,000 runs.

## Acceptance Criteria

### Build & Type Safety
- [ ] `npx tsc --noEmit` completes successfully with zero TypeScript compilation or type errors.
- [ ] `npm run build` completes successfully, generating an optimized production build with zero errors.

### Automated Logic Verification
- [ ] Automated verification script confirms that when `Retirement & Accumulation Period` is active, the accumulation years correctly apply zero withdrawals, add the configured yearly contributions, and compound market returns.
- [ ] Automated verification script confirms that when `Scrambled Monte Carlo` is active, the simulation engine generates exactly 1,000 simulation runs and that the results are deterministic across multiple invocations.

<latest_turn_user_message>
go
</latest_turn_user_message>
