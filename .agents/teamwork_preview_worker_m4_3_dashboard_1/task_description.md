# Task Description: Worker for M4.3 - Authenticated Dashboard & 7-Tab Builder

## Objective
Implement `src/app/plans/page.tsx`, `src/app/plans/new/page.tsx`, `src/app/plans/new/PlanBuilderClientWrapper.tsx`, `src/app/plans/[id]/page.tsx`, `src/components/PlanBuilder.tsx`, and `__tests__/planner/planBuilder.spec.tsx` based on the exact synthesized blueprints from the Explorer investigation. Verify 100% test success via `npm run test __tests__/planner`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Scope & Instructions
1. Create `src/app/plans/page.tsx` using Blueprint 1 below.
2. Create `src/app/plans/new/PlanBuilderClientWrapper.tsx` using Blueprint 2 below.
3. Create `src/app/plans/new/page.tsx` using Blueprint 3 below.
4. Create `src/app/plans/[id]/page.tsx` using Blueprint 4 below.
5. Create `src/components/PlanBuilder.tsx` using Blueprint 5 below.
6. Create `__tests__/planner/planBuilder.spec.tsx` using Blueprint 6 below.
7. Run `npm run test __tests__/planner` to verify that all test suites pass successfully.
8. Write a structured handoff report in your working directory (`handoff.md`) documenting your implementation and verification results.
9. Report back via `send_message` when complete.

---

## Blueprint 1: `src/app/plans/page.tsx`
```tsx
import React from 'react';
import Link from 'next/link';
import { getPlans } from '@/app/actions/retirementActions';

export const unstable_instant = false;

export default async function PlansDashboardPage() {
  const res = await getPlans();

  if (!res.success) {
    return (
      <div className="min-h-screen bg-zen-base p-8 flex flex-col items-center justify-center text-zen-charcoal">
        <div className="p-6 bg-white/80 backdrop-blur-md border border-white/40 rounded-3xl shadow-xl max-w-md text-center">
          <h2 className="text-2xl font-black mb-2">Access Restricted</h2>
          <p className="text-sm text-zen-charcoal/70 mb-6">{res.error || 'Please log in to view your retirement plans.'}</p>
          <Link href="/dashboard" className="px-6 py-3 bg-zen-charcoal text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-zen-charcoal/90 transition-all">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const plans = res.data || [];

  return (
    <div className="min-h-screen bg-zen-base p-6 sm:p-12 text-zen-charcoal">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight">Retirement Plans</h1>
            <p className="text-sm text-zen-charcoal/70 font-semibold mt-1">Manage and simulate your mindful wealth strategies</p>
          </div>
          <Link href="/plans/new" className="px-6 py-3 bg-zen-charcoal text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-zen-charcoal/90 transition-all active:scale-[0.99]">
            + Create New Plan
          </Link>
        </div>

        {plans.length === 0 ? (
          <div className="p-12 bg-white/80 backdrop-blur-md border border-white/40 rounded-3xl shadow-xl text-center flex flex-col items-center justify-center gap-4">
            <h2 className="text-2xl font-black">No Retirement Plans Found</h2>
            <p className="text-sm text-zen-charcoal/70 max-w-md">Start planning your mindful wealth future by creating your first retirement plan today.</p>
            <Link href="/plans/new" className="mt-2 px-6 py-3 bg-zen-charcoal text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-zen-charcoal/90 transition-all">
              Create Your First Plan
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const primaryAccount = plan.accounts?.[0];
              const balance = primaryAccount?.balance || 0;
              const horizon = plan.simulationConfig?.retirementHorizon || 30;
              return (
                <div key={plan.id} className="p-6 bg-white/80 backdrop-blur-md border border-white/40 rounded-3xl shadow-xl flex flex-col justify-between gap-6 hover:shadow-2xl transition-all group">
                  <div>
                    <h3 className="text-xl font-black group-hover:text-zen-charcoal transition-colors">{plan.name}</h3>
                    <p className="text-xs text-zen-charcoal/60 font-bold uppercase tracking-wider mt-1">{plan.taxJurisdiction} • {plan.stateProvince}</p>
                    <div className="mt-6 flex justify-between items-center border-t border-zen-charcoal/10 pt-4">
                      <span className="text-xs font-bold text-zen-charcoal/70">Portfolio Balance</span>
                      <span className="text-lg font-black">${Math.round(balance).toLocaleString()}</span>
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-xs font-bold text-zen-charcoal/70">Horizon</span>
                      <span className="text-sm font-bold">{horizon} Years</span>
                    </div>
                  </div>
                  <Link href={`/plans/${plan.id}`} className="w-full py-3 bg-zen-charcoal/10 hover:bg-zen-charcoal text-zen-charcoal hover:text-white rounded-2xl font-bold text-sm text-center transition-all">
                    Open Plan Builder
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Blueprint 2: `src/app/plans/new/PlanBuilderClientWrapper.tsx`
```tsx
"use client";

import React, { useLayoutEffect, useEffect } from 'react';
import { RetirementStoreProvider, useRetirementStore } from '@/store/useRetirementStore';
import PlanBuilder from '@/components/PlanBuilder';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function HydrationTrigger({ searchParams }: { searchParams: { [key: string]: string | undefined } }) {
  const store = useRetirementStore();
  useIsomorphicLayoutEffect(() => {
    store.hydrateFromParams(searchParams as any);
  }, [searchParams, store]);
  return null;
}

export default function PlanBuilderClientWrapper({
  searchParams,
  userTier = 'free',
}: {
  searchParams: { [key: string]: string | undefined };
  userTier?: string;
}) {
  return (
    <RetirementStoreProvider>
      <HydrationTrigger searchParams={searchParams} />
      <PlanBuilder userTier={userTier} />
    </RetirementStoreProvider>
  );
}
```

---

## Blueprint 3: `src/app/plans/new/page.tsx`
```tsx
import React from 'react';
import { createClient } from '@/utils/supabase/server';
import PlanBuilderClientWrapper from './PlanBuilderClientWrapper';

export const unstable_instant = false;

export default async function NewPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', authData?.user?.id)
    .single();

  return <PlanBuilderClientWrapper searchParams={resolvedParams} userTier={profile?.tier || 'free'} />;
}
```

---

## Blueprint 4: `src/app/plans/[id]/page.tsx`
```tsx
import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getPlan } from '@/app/actions/retirementActions';
import { RetirementStoreProvider, defaultSimulationConfig } from '@/store/useRetirementStore';
import PlanBuilder from '@/components/PlanBuilder';

export const unstable_instant = false;

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const res = await getPlan(resolvedParams.id);

  if (!res.success || !res.data) {
    notFound();
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', authData?.user?.id)
    .single();

  return (
    <RetirementStoreProvider initialData={{ household: res.data, simulationConfig: res.data.simulationConfig || defaultSimulationConfig }}>
      <PlanBuilder planId={resolvedParams.id} userTier={profile?.tier || 'free'} />
    </RetirementStoreProvider>
  );
}
```

---

## Blueprint 5: `src/components/PlanBuilder.tsx`
```tsx
"use client";

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useRetirementStore, ActiveTab } from '@/store/useRetirementStore';
import { savePlan } from '@/app/actions/retirementActions';

export default function PlanBuilder({ planId, userTier = 'free' }: { planId?: string; userTier?: string }) {
  const router = useRouter();
  const store = useRetirementStore();
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'household', label: 'Household' },
    { id: 'accounts', label: 'Accounts' },
    { id: 'spending', label: 'Spending' },
    { id: 'pensions', label: 'Pensions' },
    { id: 'lifeEvents', label: 'Life Events' },
    { id: 'simulation', label: 'Simulation' },
    { id: 'summary', label: 'Summary' },
  ];

  const handleSave = () => {
    startTransition(async () => {
      try {
        const payload = {
          ...store.household,
          id: planId || store.household.id,
          simulationConfig: store.simulationConfig,
        };
        const res = await savePlan(payload);
        if (res.success) {
          setSaveStatus({ success: true, message: 'Plan saved successfully!' });
          router.push('/plans');
        } else {
          setSaveStatus({ success: false, message: res.error || 'Failed to save plan.' });
        }
      } catch (err: any) {
        setSaveStatus({ success: false, message: err.message || String(err) });
      }
    });
  };

  return (
    <div className="min-h-screen bg-zen-base p-6 sm:p-12 text-zen-charcoal">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-md border border-white/40 p-6 rounded-3xl shadow-xl">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{store.household.name || 'My Retirement Plan'}</h1>
            <p className="text-xs text-zen-charcoal/60 font-bold uppercase tracking-wider mt-1">
              {store.household.taxJurisdiction} • {store.household.stateProvince} • Horizon: {store.simulationConfig.retirementHorizon} Years
            </p>
          </div>
          <div className="flex gap-4 items-center w-full sm:w-auto">
            {saveStatus && (
              <span className={`text-xs font-bold px-3 py-2 rounded-xl ${saveStatus.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {saveStatus.message}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isPending}
              className="px-6 py-3 bg-zen-charcoal text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-zen-charcoal/90 transition-all active:scale-[0.99] disabled:opacity-50 w-full sm:w-auto"
            >
              {isPending ? 'Saving...' : 'Save Plan'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 p-2 bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => store.setActiveTab(tab.id)}
              className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl font-bold text-xs transition-all text-center ${
                store.activeTab === tab.id
                  ? 'bg-zen-charcoal text-white shadow-md'
                  : 'text-zen-charcoal/70 hover:bg-white/50 hover:text-zen-charcoal'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Panels */}
        <div className="p-8 bg-white/80 backdrop-blur-md border border-white/40 rounded-3xl shadow-xl">
          {store.activeTab === 'household' && (
            <div className="flex flex-col gap-6">
              <h2 className="text-2xl font-black">Household Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zen-charcoal/70 mb-1" htmlFor="plan-name">Plan Name</label>
                  <input
                    id="plan-name"
                    type="text"
                    className="w-full px-4 py-2 bg-white/50 border border-zen-charcoal/20 rounded-xl font-semibold text-zen-charcoal focus:outline-none focus:border-zen-charcoal"
                    value={store.household.name}
                    onChange={(e) => store.updateHousehold({ name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zen-charcoal/70 mb-1" htmlFor="tax-jurisdiction">Tax Jurisdiction</label>
                  <select
                    id="tax-jurisdiction"
                    className="w-full px-4 py-2 bg-white/50 border border-zen-charcoal/20 rounded-xl font-semibold text-zen-charcoal focus:outline-none focus:border-zen-charcoal"
                    value={store.household.taxJurisdiction}
                    onChange={(e) => store.updateHousehold({ taxJurisdiction: e.target.value as any })}
                  >
                    <option value="US">US</option>
                    <option value="CA">CA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zen-charcoal/70 mb-1" htmlFor="state-province">State / Province</label>
                  <input
                    id="state-province"
                    type="text"
                    className="w-full px-4 py-2 bg-white/50 border border-zen-charcoal/20 rounded-xl font-semibold text-zen-charcoal focus:outline-none focus:border-zen-charcoal"
                    value={store.household.stateProvince}
                    onChange={(e) => store.updateHousehold({ stateProvince: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zen-charcoal/70 mb-1" htmlFor="birth-year">Birth Year</label>
                  <input
                    id="birth-year"
                    type="number"
                    className="w-full px-4 py-2 bg-white/50 border border-zen-charcoal/20 rounded-xl font-semibold text-zen-charcoal focus:outline-none focus:border-zen-charcoal"
                    value={store.household.birthYear}
                    onChange={(e) => store.updateHousehold({ birthYear: parseInt(e.target.value) || 1965 })}
                  />
                </div>
              </div>
            </div>
          )}

          {store.activeTab === 'accounts' && (
            <div className="flex flex-col gap-6">
              <h2 className="text-2xl font-black">Accounts Portfolio</h2>
              {store.household.accounts && store.household.accounts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zen-charcoal/70 mb-1" htmlFor="account-name">Account Name</label>
                    <input
                      id="account-name"
                      type="text"
                      className="w-full px-4 py-2 bg-white/50 border border-zen-charcoal/20 rounded-xl font-semibold text-zen-charcoal focus:outline-none focus:border-zen-charcoal"
                      value={store.household.accounts[0].name}
                      onChange={(e) => {
                        const accs = [...store.household.accounts!];
                        accs[0] = { ...accs[0], name: e.target.value };
                        store.updateHousehold({ accounts: accs });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zen-charcoal/70 mb-1" htmlFor="account-balance">Portfolio Balance ($)</label>
                    <input
                      id="account-balance"
                      type="number"
                      className="w-full px-4 py-2 bg-white/50 border border-zen-charcoal/20 rounded-xl font-semibold text-zen-charcoal focus:outline-none focus:border-zen-charcoal"
                      value={store.household.accounts[0].balance}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        const accs = [...store.household.accounts!];
                        accs[0] = { ...accs[0], balance: val, costBasis: val };
                        store.updateHousehold({ accounts: accs });
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zen-charcoal/70">No accounts configured.</p>
              )}
            </div>
          )}

          {store.activeTab === 'spending' && (
            <div className="flex flex-col gap-6">
              <h2 className="text-2xl font-black">Spending Strategy</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zen-charcoal/70 mb-1" htmlFor="spending-base">Annual Withdrawal ($)</label>
                  <input
                    id="spending-base"
                    type="number"
                    className="w-full px-4 py-2 bg-white/50 border border-zen-charcoal/20 rounded-xl font-semibold text-zen-charcoal focus:outline-none focus:border-zen-charcoal"
                    value={store.household.spending?.initialBase || 0}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value) || 0);
                      store.updateHousehold({
                        spending: { ...(store.household.spending || { strategy: 'constant_dollar', inflationAdjusted: true }), initialBase: val }
                      });
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zen-charcoal/70 mb-1" htmlFor="spending-strategy">Withdrawal Strategy</label>
                  <select
                    id="spending-strategy"
                    className="w-full px-4 py-2 bg-white/50 border border-zen-charcoal/20 rounded-xl font-semibold text-zen-charcoal focus:outline-none focus:border-zen-charcoal"
                    value={store.household.spending?.strategy || 'constant_dollar'}
                    onChange={(e) => {
                      store.updateHousehold({
                        spending: { ...(store.household.spending || { initialBase: 40000, inflationAdjusted: true }), strategy: e.target.value as any }
                      });
                    }}
                  >
                    <option value="constant_dollar">Constant Dollar</option>
                    <option value="percentage_of_portfolio">Percentage of Portfolio</option>
                    <option value="vanguard_dynamic">Vanguard Dynamic</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {store.activeTab === 'pensions' && (
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-black">Pensions & Social Security</h2>
              <p className="text-sm text-zen-charcoal/70">Manage defined benefit pensions and Social Security income streams.</p>
              {store.household.pensions && store.household.pensions.length === 0 && (
                <p className="text-xs font-bold text-zen-charcoal/50 uppercase tracking-wider">No pensions configured.</p>
              )}
            </div>
          )}

          {store.activeTab === 'lifeEvents' && (
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-black">Life Events & Milestones</h2>
              <p className="text-sm text-zen-charcoal/70">Plan for major one-time expenses, real estate purchases, or windfall events.</p>
              {store.household.lifeEvents && store.household.lifeEvents.length === 0 && (
                <p className="text-xs font-bold text-zen-charcoal/50 uppercase tracking-wider">No life events configured.</p>
              )}
            </div>
          )}

          {store.activeTab === 'simulation' && (
            <div className="flex flex-col gap-6">
              <h2 className="text-2xl font-black">Monte Carlo Simulation</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zen-charcoal/70 mb-1" htmlFor="sim-horizon">Retirement Horizon (Years)</label>
                  <input
                    id="sim-horizon"
                    type="number"
                    className="w-full px-4 py-2 bg-white/50 border border-zen-charcoal/20 rounded-xl font-semibold text-zen-charcoal focus:outline-none focus:border-zen-charcoal"
                    value={store.simulationConfig.retirementHorizon}
                    onChange={(e) => store.updateSimulationConfig({ retirementHorizon: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zen-charcoal/70 mb-1" htmlFor="sim-paths">Simulation Paths</label>
                  <select
                    id="sim-paths"
                    className="w-full px-4 py-2 bg-white/50 border border-zen-charcoal/20 rounded-xl font-semibold text-zen-charcoal focus:outline-none focus:border-zen-charcoal"
                    value={store.simulationConfig.numPaths}
                    onChange={(e) => store.updateSimulationConfig({ numPaths: parseInt(e.target.value) || 1000 })}
                  >
                    <option value={500}>500 Paths</option>
                    <option value={1000}>1,000 Paths</option>
                    <option value={5000}>5,000 Paths</option>
                  </select>
                </div>
              </div>

              {/* Historical Range Selector / Premium Lock */}
              <div className="relative mt-4 p-6 bg-white/50 border border-zen-charcoal/10 rounded-2xl overflow-hidden">
                <h3 className="text-lg font-black mb-2">Historical Market Range</h3>
                <p className="text-xs text-zen-charcoal/70 mb-4">Choose the empirical historical dataset range for your Monte Carlo simulation paths.</p>
                <div className="flex gap-4">
                  {['all_125_years', 'post_ww2_80_years', 'stagflation_1970s'].map((range) => (
                    <button
                      key={range}
                      disabled={userTier !== 'premium'}
                      onClick={() => store.updateSimulationConfig({ historicalRange: range as any })}
                      className={`px-4 py-2 rounded-xl font-bold text-xs border transition-all ${
                        store.simulationConfig.historicalRange === range
                          ? 'bg-zen-charcoal text-white border-zen-charcoal shadow-md'
                          : 'bg-white text-zen-charcoal/70 border-zen-charcoal/20 hover:border-zen-charcoal'
                      }`}
                    >
                      {range === 'all_125_years' ? 'All 125 Years' : range === 'post_ww2_80_years' ? 'Post WW2 (80 Yrs)' : 'Stagflation 1970s'}
                    </button>
                  ))}
                </div>

                {userTier !== 'premium' && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10 border border-white/40 rounded-2xl shadow-inner">
                    <h4 className="text-xl font-black mb-1 text-zen-charcoal">Premium Lock</h4>
                    <p className="text-xs text-zen-charcoal/80 max-w-md mb-4 font-semibold">
                      Unlock full 125-year empirical market returns, Post-WW2 boom analysis, and 1970s stagflation stress testing with An-yen Premium.
                    </p>
                    <button
                      onClick={() => router.push('/pricing')}
                      className="px-6 py-2.5 bg-zen-charcoal text-white rounded-xl font-bold text-xs shadow-lg hover:bg-zen-charcoal/90 transition-all"
                    >
                      Upgrade to Premium
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => store.runSimulation()}
                disabled={store.isSimulating}
                className="w-full py-4 bg-zen-charcoal text-white rounded-2xl font-bold text-base shadow-lg hover:bg-zen-charcoal/90 transition-all active:scale-[0.99] disabled:opacity-50 mt-4"
              >
                {store.isSimulating ? 'Running Simulation...' : 'Run Simulation'}
              </button>

              {store.error && (
                <div className="p-4 bg-red-100 border border-red-300 text-red-700 rounded-2xl text-sm font-semibold text-center">
                  {store.error}
                </div>
              )}

              {store.simulationResults && (
                <div className="p-6 bg-zen-charcoal/5 border border-zen-charcoal/10 rounded-3xl flex flex-col sm:flex-row items-center justify-around gap-6 text-center mt-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-zen-charcoal/70">Success Rate</div>
                    <div className="text-4xl font-black text-zen-charcoal">{store.simulationResults.successRate.toFixed(1)}%</div>
                  </div>
                  <div className="hidden sm:block w-px h-16 bg-zen-charcoal/10"></div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-zen-charcoal/70">Median Final Balance</div>
                    <div className="text-4xl font-black text-zen-charcoal">${Math.round(store.simulationResults.medianFinalBalance).toLocaleString()}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {store.activeTab === 'summary' && (
            <div className="flex flex-col gap-6">
              <h2 className="text-2xl font-black">Plan Summary & Outlook</h2>
              <p className="text-sm text-zen-charcoal/70">Review your full mindful wealth strategy overview and readiness index.</p>
              <div className="p-6 bg-white/50 border border-zen-charcoal/10 rounded-2xl flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-zen-charcoal/10 pb-3">
                  <span className="text-xs font-bold text-zen-charcoal/70 uppercase tracking-wider">Plan Name</span>
                  <span className="font-black text-sm">{store.household.name}</span>
                </div>
                <div className="flex justify-between items-center border-b border-zen-charcoal/10 pb-3">
                  <span className="text-xs font-bold text-zen-charcoal/70 uppercase tracking-wider">Portfolio Balance</span>
                  <span className="font-black text-sm">${Math.round(store.household.accounts?.[0]?.balance || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center border-b border-zen-charcoal/10 pb-3">
                  <span className="text-xs font-bold text-zen-charcoal/70 uppercase tracking-wider">Annual Withdrawal</span>
                  <span className="font-black text-sm">${Math.round(store.household.spending?.initialBase || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-zen-charcoal/70 uppercase tracking-wider">Retirement Horizon</span>
                  <span className="font-black text-sm">{store.simulationConfig.retirementHorizon} Years</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Blueprint 6: `__tests__/planner/planBuilder.spec.tsx`
```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import PlanBuilder from '@/components/PlanBuilder';
import { RetirementStoreProvider } from '@/store/useRetirementStore';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useParams: () => ({ id: 'plan-123' }),
  useSearchParams: () => new URLSearchParams({ portfolio: '1000000', withdrawal: '40000', years: '30', taxJurisdiction: 'US' }),
}));

jest.mock('@/app/actions/retirementActions', () => ({
  savePlan: jest.fn().mockResolvedValue({ success: true }),
  getPlans: jest.fn().mockResolvedValue({ success: true, data: [] }),
  getPlan: jest.fn().mockResolvedValue({ success: true, data: { id: 'plan-123', name: 'My Retirement Plan', taxJurisdiction: 'US', stateProvince: 'NY', birthYear: 1965, retirementAge: 65, includeSpouse: false, horizonMode: 'fixed_years', accounts: [{ id: 'acc-1', name: 'Primary Portfolio', type: 'taxable', balance: 1000000, costBasis: 1000000, owner: 'primary' }], spending: { initialBase: 40000, strategy: 'constant_dollar', inflationAdjusted: true }, pensions: [], lifeEvents: [], simulationConfig: { drawdownStrategy: 'taxable_first', historicalRange: 'all_125_years', numPaths: 1000, inflationRate: 0.025, retirementHorizon: 30, seed: 7 } } }),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({ data: { tier: 'premium' } }),
        }),
      }),
    }),
  }),
}));

describe('PlanBuilder SPA Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Household tab by default and updates plan name correctly', async () => {
    await act(async () => {
      render(
        <RetirementStoreProvider>
          <PlanBuilder userTier="premium" />
        </RetirementStoreProvider>
      );
    });

    expect(screen.getByText('Household Details')).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/Plan Name/i);
    expect(nameInput).toHaveValue('My Retirement Plan');

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Updated Zen Plan' } });
    });

    expect(nameInput).toHaveValue('Updated Zen Plan');
  });

  it('navigates through all 7 tabs correctly', async () => {
    await act(async () => {
      render(
        <RetirementStoreProvider>
          <PlanBuilder userTier="premium" />
        </RetirementStoreProvider>
      );
    });

    const tabs = ['Accounts', 'Spending', 'Pensions', 'Life Events', 'Simulation', 'Summary'];
    for (const tabName of tabs) {
      const tabBtn = screen.getByRole('button', { name: tabName });
      await act(async () => {
        fireEvent.click(tabBtn);
      });

      if (tabName === 'Accounts') expect(screen.getByText('Accounts Portfolio')).toBeInTheDocument();
      if (tabName === 'Spending') expect(screen.getByText('Spending Strategy')).toBeInTheDocument();
      if (tabName === 'Pensions') expect(screen.getByText('Pensions & Social Security')).toBeInTheDocument();
      if (tabName === 'Life Events') expect(screen.getByText('Life Events & Milestones')).toBeInTheDocument();
      if (tabName === 'Simulation') expect(screen.getByText('Monte Carlo Simulation')).toBeInTheDocument();
      if (tabName === 'Summary') expect(screen.getByText('Plan Summary & Outlook')).toBeInTheDocument();
    }
  });

  it('shows Premium Lock card on Simulation tab when userTier is free', async () => {
    await act(async () => {
      render(
        <RetirementStoreProvider>
          <PlanBuilder userTier="free" />
        </RetirementStoreProvider>
      );
    });

    const simTabBtn = screen.getByRole('button', { name: 'Simulation' });
    await act(async () => {
      fireEvent.click(simTabBtn);
    });

    expect(screen.getByText('Premium Lock')).toBeInTheDocument();
    expect(screen.getByText(/Upgrade to Premium/i)).toBeInTheDocument();

    const upgradeBtn = screen.getByRole('button', { name: /Upgrade to Premium/i });
    await act(async () => {
      fireEvent.click(upgradeBtn);
    });

    expect(mockPush).toHaveBeenCalledWith('/pricing');
  });

  it('triggers savePlan server action on Save Plan button click', async () => {
    await act(async () => {
      render(
        <RetirementStoreProvider>
          <PlanBuilder planId="plan-123" userTier="premium" />
        </RetirementStoreProvider>
      );
    });

    const saveBtn = screen.getByRole('button', { name: /Save Plan/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Plan saved successfully!/i)).toBeInTheDocument();
      expect(mockPush).toHaveBeenCalledWith('/plans');
    });
  });
});
```
