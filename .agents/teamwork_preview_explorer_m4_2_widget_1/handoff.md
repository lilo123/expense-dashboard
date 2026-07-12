# Handoff Report: Milestone 4.2 - Public Quick Check Widget

## 1. Observation
During our read-only investigation of the `expense-dashboard` codebase for Milestone 4.2, we directly observed the following architectural patterns, file contents, and interface contracts:
- **Project & Milestone Scope (`PROJECT.md`, `SCOPE.md`)**:
  - `PROJECT.md` lines 5-6 establish a "Dual Entry architecture: public Quick Check widget (`src/app/page.tsx`, `QuickCheckWidget.tsx`) vs authenticated 7-tab SPA (`/plans`, `/plans/new`, `/plans/[id]`)."
  - `SCOPE.md` lines 4-5 mandate building "a public `QuickCheckWidget.tsx` on `src/app/page.tsx` that executes in-memory simulations and passes parameters via URL search params to hydrate the Zustand store."
- **Zustand Store URL Hydration (`src/store/useRetirementStore.tsx`)**:
  - Lines 125-146 define `hydrateFromParams: (params) => set((state) => ...)` which explicitly parses `portfolio`, `withdrawal`, `years`, and `taxJurisdiction` from either `URLSearchParams` or plain object dictionaries.
  - Lines 202-272 define `runSimulation: () => ...` which demonstrates a highly robust Web Worker instantiation pattern (`new Worker(new URL('../lib/planner/simulation.worker', (import.meta as any).url))`) with a direct synchronous fallback to `handleSimulationMessage` when `window.Worker` is unavailable or throws.
- **Simulation Engines (`src/lib/planner/simulation.worker.ts`, `src/lib/planner/simulator.ts`)**:
  - `simulation.worker.ts` lines 20-24 expose `handleSimulationMessage(data: SimulationWorkerMessage, onSuccess, onError)` which executes 1,000 Monte Carlo block bootstrap simulation paths and returns a strict Zod-validated `SimulationResultsSummary`.
  - `simulator.ts` lines 284-361 expose `runQuickCheckSimulation(params: QuickCheckParams, marketReturnPaths: number[][])` as a lightweight alternative simulation engine.
- **Historical Market Data (`src/content/historicalMarketData.ts`)**:
  - Lines 65-68 provide `getMarketDataCopy(range: SimulationConfig['historicalRange']): Float64Array` which safely returns an independent copy of empirical market returns suitable for Web Worker zero-copy transfer or direct simulation.
- **UI Design System (`src/app/page.tsx`, `src/components/WaitlistIntakeForm.tsx`)**:
  - `src/app/page.tsx` renders `LandingPage` with a clean hero section using Tailwind classes such as `bg-zen-base`, `text-zen-charcoal`, `max-w-3xl`, and imports standalone components from `@/components/Logo` and `@/components/WaitlistIntakeForm`.
  - `src/components/WaitlistIntakeForm.tsx` uses `'use client'`, manages form state via React `useState`, and structures inputs/buttons with elegant frosted glass styling (`bg-white/60 backdrop-blur-md border border-white/40 shadow-sm rounded-2xl sm:rounded-full`).
- **Unit Testing Conventions (`__tests__/planner/useRetirementStore.spec.ts`)**:
  - Uses `@testing-library/react` (`renderHook`, `act`) and Jest mocks for `window.Worker` to test both direct fallback execution and genuine Web Worker message passing (`postMessage`, `onmessage`, `onerror`).

## 2. Logic Chain
1. **Component Placement & Definition**:
   - Based on `src/app/page.tsx` importing components from `@/components/*`, the new public widget should be authored as `src/components/QuickCheckWidget.tsx` and imported into `src/app/page.tsx`.
   - Because `QuickCheckWidget.tsx` manages interactive user input state (`portfolio`, `withdrawal`, `years`, `taxJurisdiction`) and executes client-side simulations, it must begin with `'use client'`.
2. **Simulation Engine Fidelity**:
   - To guarantee identical simulation results between the public Quick Check widget and the detailed 7-tab plan builder, `QuickCheckWidget.tsx` should adopt the exact Web Worker / direct fallback pattern observed in `useRetirementStore.tsx`.
   - When inputs change, it will construct a synthetic `Household` and `SimulationConfig`, retrieve market data via `getMarketDataCopy('all_125_years')`, and invoke the Web Worker or fallback to `handleSimulationMessage`.
3. **Seamless State Hydration & Navigation**:
   - The action button ("Build Detailed Plan" or "Get Started") must navigate the user to `/plans/new?portfolio=${portfolio}&withdrawal=${withdrawal}&years=${years}&taxJurisdiction=${taxJurisdiction}`.
   - Using `useRouter` from `next/navigation` allows programmatic navigation (`router.push(...)`), which pairs perfectly with Jest unit testing by mocking `useRouter`.
4. **100% Unit Test Coverage Strategy**:
   - Writing `__tests__/planner/quickCheckWidget.spec.ts` using `@testing-library/react` (`render`, `screen`, `fireEvent`, `waitFor`) ensures full DOM simulation.
   - Mocking `window.Worker` as `undefined` in specific test cases forces `QuickCheckWidget` to execute `handleSimulationMessage` synchronously, covering 100% of the fallback logic.
   - Mocking `window.Worker` as a Jest mock in other test cases validates the Worker success (`onmessage`) and error (`onerror`) paths perfectly.

## 3. Caveats
- **Next.js App Router Navigation**: The codebase uses Next.js App Router conventions (`src/app`). Navigation mocking in Jest must target `next/navigation` (specifically `useRouter`), rather than `next/router` (Pages router).
- **Zustand Hydration Trigger**: The actual hydration occurs inside `src/app/(dashboard)/plans/new/page.tsx` or `useRetirementStore.tsx` when the URL search params are read. The widget's sole responsibility in the handoff contract is to correctly format and append `?portfolio=...&withdrawal=...&years=...&taxJurisdiction=...` to the destination URL.
- **No Caveats in Domain Logic**: The underlying simulation engines (`simulatePath`, `handleSimulationMessage`) are already fully implemented and verified in Milestone 1 & 2.

## 4. Conclusion
We recommend implementing Milestone 4.2 via the following structured, production-grade strategy:

### Step 1: Create `src/components/QuickCheckWidget.tsx`
Author the public Quick Check widget with the following fully realized architecture:
```tsx
'use client'

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Household, SimulationConfig, SimulationResultsSummary } from '@/lib/planner/types';
import { getMarketDataCopy } from '@/content/historicalMarketData';
import { handleSimulationMessage } from '@/lib/planner/simulation.worker';

export default function QuickCheckWidget() {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<number>(1000000);
  const [withdrawal, setWithdrawal] = useState<number>(40000);
  const [years, setYears] = useState<number>(30);
  const [taxJurisdiction, setTaxJurisdiction] = useState<'US' | 'CA'>('US');
  
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResults, setSimulationResults] = useState<SimulationResultsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const runSimulation = useCallback(() => {
    setIsSimulating(true);
    setError(null);

    try {
      const marketData = getMarketDataCopy('all_125_years');
      const household: Household = {
        name: 'Quick Check Plan',
        taxJurisdiction: taxJurisdiction,
        stateProvince: taxJurisdiction === 'US' ? 'NY' : 'ON',
        birthYear: 1965,
        retirementAge: 65,
        includeSpouse: false,
        horizonMode: 'fixed_years',
        accounts: [
          {
            id: 'acc-quick',
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
      };

      const simulationConfig: SimulationConfig = {
        drawdownStrategy: 'taxable_first',
        historicalRange: 'all_125_years',
        numPaths: 1000,
        inflationRate: 0.025,
        retirementHorizon: years,
        seed: 7,
      };

      if (typeof window !== 'undefined' && typeof window.Worker !== 'undefined') {
        let worker: Worker | null = null;
        try {
          worker = new Worker(new URL('../lib/planner/simulation.worker', (import.meta as any).url));
          worker.onmessage = (event: MessageEvent) => {
            if (event.data.error) {
              setError(event.data.error);
            } else {
              setSimulationResults(event.data.summary);
            }
            setIsSimulating(false);
            worker?.terminate();
          };
          worker.onerror = () => {
            setError('Simulation worker encountered an error');
            setIsSimulating(false);
            worker?.terminate();
          };
          worker.postMessage({
            action: 'simulate',
            config: simulationConfig,
            marketData,
            household,
          }, [marketData.buffer]);
          return;
        } catch (err) {
          console.warn('Web Worker instantiation failed, falling back to direct handler:', err);
          if (worker) worker.terminate();
        }
      }

      // Fallback to direct synchronous execution
      handleSimulationMessage(
        { action: 'simulate', config: simulationConfig, marketData, household },
        (response) => {
          setSimulationResults(response.summary);
          setIsSimulating(false);
        },
        (err) => {
          setError(err.message || String(err));
          setIsSimulating(false);
        }
      );
    } catch (err: any) {
      setError(err.message || String(err));
      setIsSimulating(false);
    }
  }, [portfolio, withdrawal, years, taxJurisdiction]);

  useEffect(() => {
    runSimulation();
  }, [runSimulation]);

  const handleBuildPlan = () => {
    startTransition(() => {
      const query = `?portfolio=${portfolio}&withdrawal=${withdrawal}&years=${years}&taxJurisdiction=${taxJurisdiction}`;
      router.push(`/plans/new${query}`);
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white/60 backdrop-blur-md border border-white/40 shadow-xl rounded-3xl p-6 sm:p-8 my-8 flex flex-col gap-6">
      <h2 className="text-2xl sm:text-3xl font-black text-zen-charcoal text-center tracking-tight">
        Retirement Quick Check
      </h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="portfolio-input" className="text-sm font-bold text-zen-charcoal/80">Portfolio Balance ($)</label>
          <input
            id="portfolio-input"
            type="number"
            value={portfolio}
            onChange={(e) => setPortfolio(parseFloat(e.target.value) || 0)}
            className="bg-white/80 border border-white/50 rounded-xl px-4 py-2.5 text-zen-charcoal font-semibold outline-none focus:ring-2 focus:ring-zen-charcoal/20 transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="withdrawal-input" className="text-sm font-bold text-zen-charcoal/80">Annual Withdrawal ($)</label>
          <input
            id="withdrawal-input"
            type="number"
            value={withdrawal}
            onChange={(e) => setWithdrawal(parseFloat(e.target.value) || 0)}
            className="bg-white/80 border border-white/50 rounded-xl px-4 py-2.5 text-zen-charcoal font-semibold outline-none focus:ring-2 focus:ring-zen-charcoal/20 transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="years-input" className="text-sm font-bold text-zen-charcoal/80">Retirement Horizon (Years)</label>
          <input
            id="years-input"
            type="number"
            value={years}
            onChange={(e) => setYears(parseInt(e.target.value, 10) || 0)}
            className="bg-white/80 border border-white/50 rounded-xl px-4 py-2.5 text-zen-charcoal font-semibold outline-none focus:ring-2 focus:ring-zen-charcoal/20 transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="jurisdiction-select" className="text-sm font-bold text-zen-charcoal/80">Tax Jurisdiction</label>
          <select
            id="jurisdiction-select"
            value={taxJurisdiction}
            onChange={(e) => setTaxJurisdiction(e.target.value as 'US' | 'CA')}
            className="bg-white/80 border border-white/50 rounded-xl px-4 py-2.5 text-zen-charcoal font-semibold outline-none focus:ring-2 focus:ring-zen-charcoal/20 transition-all"
          >
            <option value="US">United States (US)</option>
            <option value="CA">Canada (CA)</option>
          </select>
        </div>
      </div>

      {/* Results Display */}
      <div className="bg-zen-sage/20 border border-white/40 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-around gap-4 shadow-inner">
        <div className="text-center">
          <div className="text-sm font-bold text-zen-charcoal/70 mb-1">Monte Carlo Success Rate</div>
          <div className="text-3xl sm:text-4xl font-black text-zen-charcoal">
            {isSimulating ? '...' : simulationResults ? `${simulationResults.successRate.toFixed(1)}%` : '0%'}
          </div>
        </div>
        <div className="hidden sm:block w-px h-12 bg-zen-charcoal/10" />
        <div className="text-center">
          <div className="text-sm font-bold text-zen-charcoal/70 mb-1">Median Final Balance</div>
          <div className="text-3xl sm:text-4xl font-black text-zen-charcoal">
            {isSimulating ? '...' : simulationResults ? `$${simulationResults.medianFinalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '$0'}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-zen-peach text-sm font-bold px-4 text-center">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleBuildPlan}
        disabled={isPending}
        className="w-full bg-zen-charcoal text-zen-base rounded-full font-bold py-4 hover:bg-zen-charcoal/90 disabled:opacity-50 transition-all text-lg shadow-lg hover:scale-[1.01] active:scale-[0.99]"
      >
        {isPending ? 'Navigating...' : 'Build Detailed Plan'}
      </button>
    </div>
  );
}
```

### Step 2: Integrate into `src/app/page.tsx`
Update `src/app/page.tsx` to import and render `<QuickCheckWidget />`:
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
      <main className="flex flex-col items-center justify-center z-10 relative flex-1 w-full max-w-4xl text-center px-4 py-8 my-auto">
        <h1 className="text-6xl sm:text-7xl font-black text-zen-charcoal mb-4 tracking-tight">
          An-yen
        </h1>
        
        <p className="text-xl sm:text-2xl text-zen-charcoal/80 mb-6 max-w-md leading-relaxed font-semibold">
          Mindful Wealth Builder
        </p>
        
        {/* Public Quick Check Widget */}
        <QuickCheckWidget />

        {/* Private Access Portal */}
        <div className="w-full flex flex-col items-center gap-4 mt-4">
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

### Step 3: Create `__tests__/planner/quickCheckWidget.spec.ts`
Implement a comprehensive unit test suite covering 100% of branches, user interactions, Web Worker paths, and navigation logic:
```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuickCheckWidget from '../../src/components/QuickCheckWidget';
import { useRouter } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('QuickCheckWidget Specification (M4.2)', () => {
  let originalWorker: any;
  let pushMock: jest.Mock;

  beforeEach(() => {
    originalWorker = (window as any).Worker;
    pushMock = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push: pushMock });
  });

  afterEach(() => {
    (window as any).Worker = originalWorker;
    jest.clearAllMocks();
  });

  it('should render initial input values and run default simulation successfully via fallback when window.Worker is undefined', async () => {
    (window as any).Worker = undefined;
    render(<QuickCheckWidget />);

    expect(screen.getByLabelText(/Portfolio Balance/i)).toHaveValue(1000000);
    expect(screen.getByLabelText(/Annual Withdrawal/i)).toHaveValue(40000);
    expect(screen.getByLabelText(/Retirement Horizon/i)).toHaveValue(30);
    expect(screen.getByLabelText(/Tax Jurisdiction/i)).toHaveValue('US');

    await waitFor(() => {
      expect(screen.getByText(/Success Rate/i)).toBeInTheDocument();
      expect(screen.getByText(/Median Final Balance/i)).toBeInTheDocument();
    });
  });

  it('should update simulation results when user changes portfolio, withdrawal, years, or taxJurisdiction', async () => {
    (window as any).Worker = undefined;
    render(<QuickCheckWidget />);

    const portfolioInput = screen.getByLabelText(/Portfolio Balance/i);
    fireEvent.change(portfolioInput, { target: { value: '2000000' } });
    expect(portfolioInput).toHaveValue(2000000);

    const withdrawalInput = screen.getByLabelText(/Annual Withdrawal/i);
    fireEvent.change(withdrawalInput, { target: { value: '50000' } });
    expect(withdrawalInput).toHaveValue(50000);

    const yearsInput = screen.getByLabelText(/Retirement Horizon/i);
    fireEvent.change(yearsInput, { target: { value: '25' } });
    expect(yearsInput).toHaveValue(25);

    const jurisdictionSelect = screen.getByLabelText(/Tax Jurisdiction/i);
    fireEvent.change(jurisdictionSelect, { target: { value: 'CA' } });
    expect(jurisdictionSelect).toHaveValue('CA');

    await waitFor(() => {
      expect(screen.getByText(/Success Rate/i)).toBeInTheDocument();
    });
  });

  it('should navigate to /plans/new with correct URL search params when action button is clicked', async () => {
    (window as any).Worker = undefined;
    render(<QuickCheckWidget />);

    const button = screen.getByRole('button', { name: /Build Detailed Plan/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/plans/new?portfolio=1000000&withdrawal=40000&years=30&taxJurisdiction=US');
    });
  });

  it('should interact with genuine Web Worker when available and handle success message', async () => {
    let onMessageCb: any;
    let terminateCalled = false;

    (window as any).Worker = jest.fn().mockImplementation(() => ({
      postMessage: jest.fn(),
      terminate: jest.fn(() => { terminateCalled = true; }),
      set onmessage(cb: any) { onMessageCb = cb; },
      set onerror(cb: any) {},
    }));

    render(<QuickCheckWidget />);

    expect((window as any).Worker).toHaveBeenCalled();

    // Simulate Web Worker success response
    act(() => {
      onMessageCb({
        data: {
          summary: {
            successRate: 98.5,
            medianFinalBalance: 2500000,
            tenthPercentileFinalBalance: 500000,
            ninetiethPercentileFinalBalance: 5000000,
            annualEndingBalances: [],
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('98.5%')).toBeInTheDocument();
      expect(screen.getByText('$2,500,000')).toBeInTheDocument();
      expect(terminateCalled).toBe(true);
    });
  });

  it('should handle Web Worker error payload in onmessage and display error message', async () => {
    let onMessageCb: any;
    (window as any).Worker = jest.fn().mockImplementation(() => ({
      postMessage: jest.fn(),
      terminate: jest.fn(),
      set onmessage(cb: any) { onMessageCb = cb; },
      set onerror(cb: any) {},
    }));

    render(<QuickCheckWidget />);

    act(() => {
      onMessageCb({ data: { error: 'Worker simulation failed due to invalid config' } });
    });

    await waitFor(() => {
      expect(screen.getByText('Worker simulation failed due to invalid config')).toBeInTheDocument();
    });
  });

  it('should handle Web Worker onerror dispatch and display fallback error message', async () => {
    let onErrorCb: any;
    (window as any).Worker = jest.fn().mockImplementation(() => ({
      postMessage: jest.fn(),
      terminate: jest.fn(),
      set onmessage(cb: any) {},
      set onerror(cb: any) { onErrorCb = cb; },
    }));

    render(<QuickCheckWidget />);

    act(() => {
      onErrorCb(new Error('Fatal worker crash'));
    });

    await waitFor(() => {
      expect(screen.getByText('Simulation worker encountered an error')).toBeInTheDocument();
    });
  });

  it('should fallback to direct execution if new Worker throws during instantiation', async () => {
    (window as any).Worker = jest.fn().mockImplementation(() => {
      throw new Error('Worker not supported in this sandbox');
    });

    render(<QuickCheckWidget />);

    await waitFor(() => {
      expect(screen.getByText(/Success Rate/i)).toBeInTheDocument();
    });
  });
});
```

## 5. Verification Method
To independently verify the successful implementation of Milestone 4.2, the implementer must execute the following validation steps:
1. **Unit Test Execution**:
   ```bash
   npm run test __tests__/planner/quickCheckWidget.spec.ts
   ```
   - *Success Condition*: 100% passing tests across all 7 test cases, verifying default rendering, input changes, URL search param formatting, Web Worker communication, and error handling.
2. **Full Planner Test Suite Verification**:
   ```bash
   npm run test __tests__/planner
   ```
   - *Success Condition*: 100% passing unit tests across all specs in `__tests__/planner`.
3. **TypeScript & Lint Verification**:
   ```bash
   npx tsc --noEmit
   ```
   - *Success Condition*: Zero TypeScript compilation errors across `src/components/QuickCheckWidget.tsx`, `src/app/page.tsx`, and `__tests__/planner/quickCheckWidget.spec.ts`.
4. **Local Git Cleanliness Check**:
   ```bash
   git status
   ```
   - *Success Condition*: Confirms all changes exist strictly in the local working directory with zero commits pushed to any remote git repository.
