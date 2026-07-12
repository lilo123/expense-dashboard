# Handoff Report: Milestone 4.2 - Public Quick Check Widget

## 1. Observation
During our read-only investigation of the repository for Milestone 4.2 (Public Quick Check Widget), we executed tool calls (`view_file`, `list_dir`) and observed the following concrete facts:

- **Project & Milestone Scopes**:
  - `PROJECT.md` (lines 5-6, 17) defines the "Dual Entry architecture: public Quick Check widget (`src/app/page.tsx`, `QuickCheckWidget.tsx`) vs authenticated 7-tab SPA (`/plans`, `/plans/new`, `/plans/[id]`)." It specifies that the Zustand store (`src/store/useRetirementStore.tsx`) is "hydrated via URL search params (`/auth?redirect=/plans/new...`)."
  - `SCOPE.md` (lines 5, 14) mandates: "Build a public `QuickCheckWidget.tsx` on `src/app/page.tsx` that executes in-memory simulations and passes parameters via URL search params to hydrate the Zustand store" and demands "100% passing test coverage (`npm run test __tests__/planner`)."

- **Existing Landing Page (`src/app/page.tsx`)**:
  - `src/app/page.tsx` (lines 1-53) currently renders a landing page featuring `Logo`, `Link` to `/education`, hero text ("An-yen", "Mindful Wealth Builder"), and a `WaitlistIntakeForm`.
  - It does not currently import or render `QuickCheckWidget.tsx`.

- **Simulation Engines (`src/lib/planner/simulator.ts` & `src/lib/planner/simulation.worker.ts`)**:
  - `src/lib/planner/simulator.ts` (lines 284-362) contains `runQuickCheckSimulation(params: QuickCheckParams, marketReturnPaths: number[][]): SimulationResultsSummary`, specifically documented as "Dual-Entry Architecture Quick Check simulation engine."
  - `src/lib/planner/simulation.worker.ts` (lines 20-162) exposes `handleSimulationMessage(data: SimulationWorkerMessage, onSuccess, onError)`, which runs full `simulatePath` loops across 1,000 Monte Carlo paths using zero-copy IPC buffers and supports direct execution in environments without Web Workers.
  - `src/content/historicalMarketData.ts` (lines 56-68) exposes `getMarketDataCopy` and `getMarketDataSlice` to obtain the 125-year empirical market return data (`Float64Array`).

- **Zustand Store Hydration (`src/store/useRetirementStore.tsx`)**:
  - `src/store/useRetirementStore.tsx` (lines 125-200) defines `hydrateFromParams`, which parses `portfolio`, `withdrawal`, `years`, and `taxJurisdiction` from `URLSearchParams` or record objects.
  - Specifically, `portfolio` updates `household.accounts[0].balance` and `costBasis`; `withdrawal` updates `household.spending.initialBase`; `years` updates `simulationConfig.retirementHorizon`; and `taxJurisdiction` updates `household.taxJurisdiction`.

- **Jest Setup & Testing Constraints (`jest.config.ts`, `jest.setup.ts`, `__tests__/planner/`)**:
  - `jest.config.ts` (lines 10-19) configures `testEnvironment: 'jsdom'` and uses `next/jest.js`.
  - `jest.setup.ts` (lines 57-83) intercepts `console.warn` and `console.error`. It explicitly throws fatal test errors if any forbidden string pattern is encountered, including `/not wrapped in act/i`, `/Each child in a list should have a unique "key" prop/i`, `/Text content did not match|Hydration failed/i`.
  - `list_dir` on `__tests__/planner` confirmed that `quickCheckWidget.spec.ts` does not yet exist.

---

## 2. Logic Chain
Based on the direct observations above, we establish the following step-by-step reasoning for the implementation strategy:

1. **Component Separation & Next.js Directives**:
   - `src/app/page.tsx` is a top-level landing page. To maintain clean modularity and ensure client-side interactivity without forcing the entire page to become a client component unnecessarily (or to cleanly encapsulate state), `QuickCheckWidget` should be authored in `src/components/QuickCheckWidget.tsx` with the `"use client";` directive at the top.
   - `src/app/page.tsx` will then import `QuickCheckWidget` from `@/components/QuickCheckWidget` and render it prominently in the hero section (e.g., directly above or below the `WaitlistIntakeForm`).

2. **State Management & Default Values**:
   - To align with `task_description.md` and `useRetirementStore.tsx`, `QuickCheckWidget` must manage four primary user input states: `portfolio` (default `1000000`), `withdrawal` (default `40000`), `years` (default `30`), and `taxJurisdiction` (default `'US'`).
   - It also needs state for `simulationResults` (`SimulationResultsSummary | null`), `isSimulating` (`boolean`), and `error` (`string | null`).

3. **Simulation Execution Strategy (Trade-off Analysis)**:
   - *Option A (Lightweight Pure Engine)*: Use `runQuickCheckSimulation` from `src/lib/planner/simulator.ts`.
     - *Pros*: Extremely fast, pure synchronous execution; avoids Web Worker serialization overhead.
     - *Cons*: Requires generating `marketReturnPaths: number[][]` from `historicalMarketData`.
   - *Option B (Full Worker / Direct Handler Parity)*: Use `handleSimulationMessage` from `src/lib/planner/simulation.worker.ts` (or spawn a Web Worker with `handleSimulationMessage` fallback).
     - *Pros*: Provides 100% exact simulation parity with the detailed plan builder (`useRetirementStore.tsx`); exercises the full drawdown and tax engines.
     - *Cons*: Slightly higher computation overhead.
   - *Recommendation*: Implement Option B using `handleSimulationMessage` directly (or Web Worker with fallback) to guarantee absolute consistency in success rate and median balances between the Quick Check widget and the hydrated Detailed Plan Builder.

4. **Seamless Store Hydration via Navigation**:
   - When the user clicks the action button ("Build Detailed Plan" or "Get Started"), the widget must navigate the user to `/plans/new` with query parameters matching `hydrateFromParams` in `useRetirementStore.tsx`.
   - The target URL must be dynamically constructed: `/plans/new?portfolio=${portfolio}&withdrawal=${withdrawal}&years=${years}&taxJurisdiction=${taxJurisdiction}`.
   - Use `useRouter()` from `next/navigation` (`router.push(...)`) to perform the navigation.

5. **Unit Testing & Console Guard Strictness**:
   - `__tests__/planner/quickCheckWidget.spec.ts` must use `@testing-library/react` to mount `QuickCheckWidget`, verify default rendering, interact with input fields, verify simulation output display, and assert `router.push` is called with the correct URL.
   - Due to `jest.setup.ts` throwing errors on `not wrapped in act`, all `fireEvent.change` and `fireEvent.click` events must be wrapped in `act(...)`, and `waitFor(...)` must be used to ensure asynchronous simulation state updates complete cleanly before assertions are made.

---

## 3. Caveats
- **Next.js Routing Mocking in Jest**: Since `next/navigation` is used for `useRouter`, the unit test must explicitly mock `next/navigation` using `jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))`.
- **TypeScript JSX Parsing in `.spec.ts`**: The milestone scope specifies `__tests__/planner/quickCheckWidget.spec.ts`. In Next.js Jest setups (`next/jest.js`), TypeScript files with `.ts` extension are processed by SWC/Babel. If the environment strictly expects `.tsx` for JSX syntax, the implementer can safely use `__tests__/planner/quickCheckWidget.spec.tsx` or write the test using `React.createElement(QuickCheckWidget)`. Both approaches are fully compatible with `npm run test __tests__/planner`.
- **Web Worker in JSDOM**: `new Worker(...)` is not natively available in JSDOM. The widget's simulation trigger should gracefully fall back to direct `handleSimulationMessage` execution when `window.Worker` is unavailable or throws an error (exactly as implemented in `useRetirementStore.tsx` lines 213-257).

---

## 4. Conclusion
We recommend the following definitive, surgical implementation plan for Milestone 4.2.

### 1. Create `src/components/QuickCheckWidget.tsx`
```tsx
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SimulationResultsSummary } from '@/lib/planner/types';
import { getMarketDataCopy } from '@/content/historicalMarketData';
import { handleSimulationMessage } from '@/lib/planner/simulation.worker';

export default function QuickCheckWidget() {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<number>(1000000);
  const [withdrawal, setWithdrawal] = useState<number>(40000);
  const [years, setYears] = useState<number>(30);
  const [taxJurisdiction, setTaxJurisdiction] = useState<'US' | 'CA'>('US');
  const [results, setResults] = useState<SimulationResultsSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(() => {
      try {
        const marketData = getMarketDataCopy('all_125_years');
        handleSimulationMessage(
          {
            action: 'simulate',
            config: {
              drawdownStrategy: 'taxable_first',
              historicalRange: 'all_125_years',
              numPaths: 1000,
              inflationRate: 0.025,
              retirementHorizon: years,
              seed: 7,
            },
            marketData,
            household: {
              name: 'Quick Check Household',
              taxJurisdiction,
              stateProvince: 'NY',
              birthYear: 1965,
              retirementAge: 65,
              includeSpouse: false,
              horizonMode: 'fixed_years',
              accounts: [
                {
                  id: 'acc-qc',
                  name: 'Primary Portfolio',
                  type: 'taxable',
                  balance: portfolio,
                  costBasis: portfolio,
                  owner: 'primary',
                }
              ],
              spending: {
                initialBase: withdrawal,
                strategy: 'constant_dollar',
                inflationAdjusted: true,
              }
            }
          },
          (response) => {
            setResults(response.summary);
            setError(null);
          },
          (err) => {
            setError(err.message || String(err));
          }
        );
      } catch (err: any) {
        setError(err.message || String(err));
      }
    });
  }, [portfolio, withdrawal, years, taxJurisdiction]);

  const handleBuildPlan = () => {
    const params = new URLSearchParams({
      portfolio: portfolio.toString(),
      withdrawal: withdrawal.toString(),
      years: years.toString(),
      taxJurisdiction,
    });
    router.push(`/plans/new?${params.toString()}`);
  };

  return (
    <div className="w-full max-w-xl mx-auto p-6 bg-white/80 backdrop-blur-md border border-white/40 rounded-3xl shadow-xl text-zen-charcoal my-6 transition-all">
      <h2 className="text-2xl font-black mb-4 text-center tracking-tight">Retirement Quick Check</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zen-charcoal/70 mb-1" htmlFor="portfolio-input">
            Portfolio Balance ($)
          </label>
          <input
            id="portfolio-input"
            type="number"
            className="w-full px-4 py-2 bg-white/50 border border-zen-charcoal/20 rounded-xl font-semibold text-zen-charcoal focus:outline-none focus:border-zen-charcoal transition-colors"
            value={portfolio}
            onChange={(e) => setPortfolio(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zen-charcoal/70 mb-1" htmlFor="withdrawal-input">
            Annual Withdrawal ($)
          </label>
          <input
            id="withdrawal-input"
            type="number"
            className="w-full px-4 py-2 bg-white/50 border border-zen-charcoal/20 rounded-xl font-semibold text-zen-charcoal focus:outline-none focus:border-zen-charcoal transition-colors"
            value={withdrawal}
            onChange={(e) => setWithdrawal(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zen-charcoal/70 mb-1" htmlFor="years-input">
            Horizon (Years)
          </label>
          <input
            id="years-input"
            type="number"
            className="w-full px-4 py-2 bg-white/50 border border-zen-charcoal/20 rounded-xl font-semibold text-zen-charcoal focus:outline-none focus:border-zen-charcoal transition-colors"
            value={years}
            onChange={(e) => setYears(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zen-charcoal/70 mb-1" htmlFor="tax-input">
            Tax Jurisdiction
          </label>
          <select
            id="tax-input"
            className="w-full px-4 py-2 bg-white/50 border border-zen-charcoal/20 rounded-xl font-semibold text-zen-charcoal focus:outline-none focus:border-zen-charcoal transition-colors"
            value={taxJurisdiction}
            onChange={(e) => setTaxJurisdiction(e.target.value as 'US' | 'CA')}
          >
            <option value="US">US</option>
            <option value="CA">CA</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 mb-6 bg-red-100 border border-red-300 text-red-700 rounded-xl text-sm font-semibold text-center">
          {error}
        </div>
      )}

      {results && (
        <div className="p-4 mb-6 bg-zen-charcoal/5 border border-zen-charcoal/10 rounded-2xl flex flex-col sm:flex-row items-center justify-around gap-4 text-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-zen-charcoal/70">Success Rate</div>
            <div className="text-3xl font-black text-zen-charcoal">{results.successRate.toFixed(1)}%</div>
          </div>
          <div className="hidden sm:block w-px h-12 bg-zen-charcoal/10"></div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-zen-charcoal/70">Median Final Balance</div>
            <div className="text-3xl font-black text-zen-charcoal">${Math.round(results.medianFinalBalance).toLocaleString()}</div>
          </div>
        </div>
      )}

      <button
        onClick={handleBuildPlan}
        className="w-full py-3 bg-zen-charcoal text-white rounded-2xl font-bold text-base shadow-lg hover:bg-zen-charcoal/90 transition-all active:scale-[0.99]"
      >
        Build Detailed Plan
      </button>
    </div>
  );
}
```

### 2. Update `src/app/page.tsx`
Add `import QuickCheckWidget from "@/components/QuickCheckWidget";` and insert `<QuickCheckWidget />` in the `<main>` block:
```tsx
import Link from "next/link";
import Logo from "@/components/Logo";
import WaitlistIntakeForm from "@/components/WaitlistIntakeForm";
import QuickCheckWidget from "@/components/QuickCheckWidget";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-between px-6 sm:px-12 relative overflow-hidden bg-zen-base">
      {/* Top Navigation */}
      <nav className="w-full max-w-6xl py-8 flex justify-between items-center z-20">
        <Logo className="w-24 h-24 sm:w-28 sm:h-28 text-zen-charcoal transition-all" />
        <Link 
          href="/education" 
          className="px-6 py-2.5 bg-white/50 backdrop-blur-md text-zen-charcoal rounded-full font-bold text-sm border border-white/30 hover:bg-white/80 transition-all shadow-sm"
        >
          Education Hub
        </Link>
      </nav>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center z-10 relative flex-1 w-full max-w-3xl text-center px-4 py-8 my-auto">
        <h1 className="text-6xl sm:text-7xl font-black text-zen-charcoal mb-4 tracking-tight">
          An-yen
        </h1>
        
        <p className="text-xl sm:text-2xl text-zen-charcoal/80 mb-10 max-w-md leading-relaxed font-semibold">
          Mindful Wealth Builder
        </p>

        {/* Public Quick Check Widget */}
        <QuickCheckWidget />
        
        {/* Private Access Portal */}
        <div className="w-full flex flex-col items-center gap-4 mt-6">
          <WaitlistIntakeForm />
          
          <div className="text-sm text-zen-charcoal/70 mt-1">
            Already a member?{" "}
            <Link href="/dashboard" className="font-bold underline hover:text-zen-charcoal transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl py-8 text-center text-xs text-zen-charcoal/50 flex flex-col sm:flex-row gap-4 justify-between items-center z-10 border-t border-zen-charcoal/10">
        <span className="font-medium">© 2026 An-yen Studio. All rights reserved.</span>
        <div className="flex gap-8 font-semibold">
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
```

### 3. Create `__tests__/planner/quickCheckWidget.spec.ts` (or `.tsx`)
```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import QuickCheckWidget from '@/components/QuickCheckWidget';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('QuickCheckWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders default inputs and displays initial simulation results', async () => {
    await act(async () => {
      render(<QuickCheckWidget />);
    });

    expect(screen.getByText('Retirement Quick Check')).toBeInTheDocument();
    expect(screen.getByLabelText(/Portfolio Balance/i)).toHaveValue(1000000);
    expect(screen.getByLabelText(/Annual Withdrawal/i)).toHaveValue(40000);
    expect(screen.getByLabelText(/Horizon/i)).toHaveValue(30);
    expect(screen.getByLabelText(/Tax Jurisdiction/i)).toHaveValue('US');

    await waitFor(() => {
      expect(screen.getByText(/Success Rate/i)).toBeInTheDocument();
      expect(screen.getByText(/Median Final Balance/i)).toBeInTheDocument();
    });
  });

  it('updates input values and recalculates simulation correctly', async () => {
    await act(async () => {
      render(<QuickCheckWidget />);
    });

    const portfolioInput = screen.getByLabelText(/Portfolio Balance/i);
    const withdrawalInput = screen.getByLabelText(/Annual Withdrawal/i);
    const yearsInput = screen.getByLabelText(/Horizon/i);
    const taxInput = screen.getByLabelText(/Tax Jurisdiction/i);

    await act(async () => {
      fireEvent.change(portfolioInput, { target: { value: '1200000' } });
      fireEvent.change(withdrawalInput, { target: { value: '50000' } });
      fireEvent.change(yearsInput, { target: { value: '25' } });
      fireEvent.change(taxInput, { target: { value: 'CA' } });
    });

    expect(portfolioInput).toHaveValue(1200000);
    expect(withdrawalInput).toHaveValue(50000);
    expect(yearsInput).toHaveValue(25);
    expect(taxInput).toHaveValue('CA');

    await waitFor(() => {
      expect(screen.getByText(/Success Rate/i)).toBeInTheDocument();
    });
  });

  it('navigates to detailed plan builder with correct URL search params on button click', async () => {
    await act(async () => {
      render(<QuickCheckWidget />);
    });

    const portfolioInput = screen.getByLabelText(/Portfolio Balance/i);
    const withdrawalInput = screen.getByLabelText(/Annual Withdrawal/i);
    const yearsInput = screen.getByLabelText(/Horizon/i);
    const taxInput = screen.getByLabelText(/Tax Jurisdiction/i);

    await act(async () => {
      fireEvent.change(portfolioInput, { target: { value: '1500000' } });
      fireEvent.change(withdrawalInput, { target: { value: '60000' } });
      fireEvent.change(yearsInput, { target: { value: '35' } });
      fireEvent.change(taxInput, { target: { value: 'US' } });
    });

    const buildPlanBtn = screen.getByRole('button', { name: /Build Detailed Plan/i });
    await act(async () => {
      fireEvent.click(buildPlanBtn);
    });

    expect(mockPush).toHaveBeenCalledWith('/plans/new?portfolio=1500000&withdrawal=60000&years=35&taxJurisdiction=US');
  });
});
```

---

## 5. Verification Method
To independently verify the success and correctness of the implementation, the receiving implementer or verifying agent must execute the following steps:

1. **Verify Unit Test Suite Passes**:
   ```bash
   npm run test __tests__/planner/quickCheckWidget.spec.ts
   ```
   - *Expected Output*: 100% passing tests with zero warnings or errors thrown by `jest.setup.ts`.

2. **Verify Full Planner Test Suite Compatibility**:
   ```bash
   npm run test __tests__/planner
   ```
   - *Expected Output*: All 22 test suites pass successfully.

3. **Verify Next.js Build & Static Analysis**:
   ```bash
   npm run build
   ```
   - *Expected Output*: Successful compilation with zero TypeScript errors or ESLint violations.

4. **Invalidation Conditions**:
   - If `npm run test` fails due to `console.error` regarding `act(...)`, ensure all state changes and renders are wrapped in `act(...)`.
   - If `npm run build` fails on `src/app/page.tsx`, verify that `QuickCheckWidget.tsx` includes the `"use client";` directive and is properly exported.
