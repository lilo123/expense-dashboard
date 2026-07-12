# Task Description: Worker for M4.2 - Public Quick Check Widget

## Objective
Implement `src/components/QuickCheckWidget.tsx`, integrate it into `src/app/page.tsx`, and create the unit test suite `__tests__/planner/quickCheckWidget.spec.tsx` (using `.tsx` or `.ts` depending on JSX requirement) based on the exact synthesized blueprints from the Explorer investigation. Verify 100% test success via `npm run test __tests__/planner`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Scope & Instructions
1. Create `src/components/QuickCheckWidget.tsx` using the complete blueprint below.
2. Overwrite `src/app/page.tsx` with the complete blueprint below.
3. Create `__tests__/planner/quickCheckWidget.spec.tsx` using the complete blueprint below.
4. Run `npm run test __tests__/planner` to verify that all test suites pass successfully.
5. Write a structured handoff report in your working directory (`handoff.md`) documenting your implementation and verification results.
6. Report back via `send_message` when complete.

---

## Blueprint 1: `src/components/QuickCheckWidget.tsx`
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

---

## Blueprint 2: `src/app/page.tsx`
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

---

## Blueprint 3: `__tests__/planner/quickCheckWidget.spec.tsx`
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
