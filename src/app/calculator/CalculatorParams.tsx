'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import { useQueryStates, parseAsFloat, parseAsStringLiteral, parseAsBoolean, parseAsJson } from 'nuqs';
import { zodResolver } from '@hookform/resolvers/zod';
import { simulationConfigSchema, SimulationConfigSchemaType, withdrawalStrategySchema } from '../../schemas/simulationSchema';
import { WithdrawalStrategy, CashFlow } from '../../types/simulation';
import { SummaryView } from './views/SummaryView';
import { PortfolioValueView } from './views/PortfolioValueView';
import { AvailableSpendingView } from './views/AvailableSpendingView';
import { SimulationsListView } from './views/SimulationsListView';
import { DataAssumptionsView } from './views/DataAssumptionsView';
import { saveSimulationConfig } from '../actions/retirementActions';

// Dynamic imports with ssr: false
const SimulationProviderDynamic = dynamic(
  () => import('../../SimulationProvider').then(mod => mod.SimulationProvider),
  { ssr: false, loading: () => <div className="p-12 text-center text-gray-600 animate-pulse">Loading Simulation Engine...</div> }
);

const withdrawalStrategies = withdrawalStrategySchema.options as WithdrawalStrategy[];

const strategyLabels: Record<WithdrawalStrategy, string> = {
  constant_dollar: 'Constant Dollar (Inflation Adjusted)',
  percent_of_portfolio: 'Percent of Portfolio',
  one_over_n: '1/N (Remaining Years)',
  vpw: 'Variable Percentage Withdrawal (VPW)',
  cvpw: 'Constant VPW (cVPW)',
  dynamic_swr: 'Dynamic Safe Withdrawal Rate',
  guyton_klinger: 'Guyton-Klinger Guardrails',
  vanguard_dynamic: 'Vanguard Dynamic Spending',
  endowment: 'Endowment Strategy (70/30)',
  rule_95: '95% Rule',
  cape_based: 'CAPE-Based Withdrawals',
  sensible: 'Sensible Withdrawals',
  hebeler_autopilot: 'Hebeler Autopilot II'
};

const queryParsers = {
  initialPortfolio: parseAsFloat.withDefault(1000000),
  duration: parseAsFloat.withDefault(30),
  equities: parseAsFloat.withDefault(60),
  bonds: parseAsFloat.withDefault(40),
  cash: parseAsFloat.withDefault(0),
  withdrawalStrategy: parseAsStringLiteral(withdrawalStrategies).withDefault('constant_dollar'),
  initialWithdrawal: parseAsFloat.withDefault(40000),

  retirementStartingAge: parseAsFloat.withDefault(60),
  startYearMin: parseAsFloat.withDefault(1871),
  startYearMax: parseAsFloat.withDefault(2025),
  minWithdrawalLimitEnabled: parseAsBoolean.withDefault(false),
  maxWithdrawalLimitEnabled: parseAsBoolean.withDefault(false),
  minWithdrawalLimit: parseAsFloat.withDefault(20000),
  maxWithdrawalLimit: parseAsFloat.withDefault(100000),
  additionalIncome: parseAsJson<CashFlow[]>((val) => val as CashFlow[]).withDefault([]),
  extraWithdrawals: parseAsJson<CashFlow[]>((val) => val as CashFlow[]).withDefault([]),
  rebalancePortfolio: parseAsBoolean.withDefault(true),
  rebalanceFrequency: parseAsFloat.withDefault(1),
  glidePathPace: parseAsStringLiteral(['evenly', 'slowly', 'quickly'] as const).withDefault('evenly'),
  equitiesFee: parseAsFloat.withDefault(0.04),
  bondsFee: parseAsFloat.withDefault(0.05),
  cashGrowthRate: parseAsFloat.withDefault(1.5),

  annualWithdrawal: parseAsFloat.withDefault(40000),
  inflationAdjustedFirstYearWithdrawal: parseAsBoolean.withDefault(true),
  percentageOfPortfolio: parseAsFloat.withDefault(4.0),
  gkInitialWithdrawal: parseAsFloat.withDefault(40000),
  gkWithdrawalUpperLimit: parseAsFloat.withDefault(20.0),
  gkWithdrawalLowerLimit: parseAsFloat.withDefault(20.0),
  gkUpperLimitAdjustment: parseAsFloat.withDefault(10.0),
  gkLowerLimitAdjustment: parseAsFloat.withDefault(10.0),
  gkModifiedWithdrawalRule: parseAsBoolean.withDefault(true),
  gkIgnoreLastFifteenYears: parseAsBoolean.withDefault(true),
  ninetyFiveWithdrawalRate: parseAsFloat.withDefault(4.0),
  ninetyFivePercentage: parseAsFloat.withDefault(95.0),
  capeWithdrawalRate: parseAsFloat.withDefault(4.0),
  capeWeight: parseAsFloat.withDefault(50.0),
  cvpwMode: parseAsBoolean.withDefault(false),
  cvpwRate: parseAsFloat.withDefault(5.0),
  cvpwTargetPortfolio: parseAsFloat.withDefault(0),
  oneOverNTargetPortfolio: parseAsFloat.withDefault(0),
  sensibleBaseWithdrawalRate: parseAsFloat.withDefault(3.0),
  sensibleExtrasWithdrawalRate: parseAsFloat.withDefault(10.0),
  endowmentPreviousWithdrawalRatio: parseAsFloat.withDefault(70.0),
  endowmentPercentOfPortfolio: parseAsFloat.withDefault(30.0),
  dynamicSwrRoiAssumption: parseAsFloat.withDefault(5.0),
  dynamicSwrInflationAssumption: parseAsFloat.withDefault(3.0),
  hebelerFirstYearWithdrawalRate: parseAsFloat.withDefault(4.0),
  hebelerPreviousWithdrawalRatio: parseAsFloat.withDefault(75.0),
  vanguardDynamicSpendingWithdrawalRate: parseAsFloat.withDefault(4.0),
  vanguardDynamicSpendingFloor: parseAsFloat.withDefault(2.5),
  vanguardDynamicSpendingCeiling: parseAsFloat.withDefault(5.0),

  glidePath: parseAsBoolean.withDefault(false),
  targetEquities: parseAsFloat.withDefault(40),
  glidePathDuration: parseAsFloat.withDefault(10),

  marketDataMode: parseAsStringLiteral(['us', 'global'] as const).withDefault('us'),
  timelineMode: parseAsStringLiteral(['retirement_only', 'retirement_and_accumulation'] as const).withDefault('retirement_only'),
  currentAge: parseAsFloat.withDefault(30),
  retirementAge: parseAsFloat.withDefault(60),
  additionalContribution: parseAsFloat.withDefault(10000),
  simulationMode: parseAsStringLiteral(['historical', 'monte_carlo'] as const).withDefault('historical'),
};

export function CalculatorParams() {
  const [query, setQuery] = useQueryStates(queryParsers);

  const form = useForm<SimulationConfigSchemaType>({
    resolver: zodResolver(simulationConfigSchema) as any,
    values: query,
    resetOptions: { keepDirtyValues: true },
    mode: 'onChange',
  });

  const { register, watch, formState: { errors } } = form;
  const formValues = watch();

  useEffect(() => {
    const sub = form.watch((value, { name }) => {
      if (!name) return;
      const parsed = simulationConfigSchema.safeParse(value);
      if (parsed.success) {
        if (name === 'withdrawalStrategy') {
          setQuery({ withdrawalStrategy: parsed.data.withdrawalStrategy }, { history: 'push', shallow: true });
        } else {
          const queryData = Object.fromEntries(Object.entries(parsed.data).filter(([k]) => k in queryParsers));
          setQuery(queryData as any, { history: 'replace', shallow: true, throttleMs: 300 });
        }
      }
    });
    return () => sub.unsubscribe();
  }, [form, setQuery]);

  const [activeMainTab, setActiveMainTab] = useState<'simulation' | 'data-assumptions'>('simulation');
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success?: boolean; id?: string; error?: string } | null>(null);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveResult(null);
    try {
      const res = await saveSimulationConfig(query);
      setSaveResult(res);
    } catch (err: any) {
      setSaveResult({ success: false, error: err.message || 'Failed to save configuration.' });
    } finally {
      setIsSaving(false);
    }
  };

  const totalAllocation = (Number(formValues.equities) || 0) + (Number(formValues.bonds) || 0) + (Number(formValues.cash) || 0);

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto px-4 py-8">
      {/* Configuration Sidebar */}
      <aside className="w-full lg:w-96 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6 flex-shrink-0" aria-label="Simulation Parameters">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Simulation Parameters</h2>
            <p className="text-xs text-gray-600 mt-1">Configure your retirement portfolio and withdrawal rules.</p>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveConfig}
            className="px-3 py-1.5 bg-green-800 text-white rounded-xl text-xs font-bold hover:bg-green-900 transition-colors shadow-sm disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Config'}
          </button>
        </div>

        {saveResult && (
          <div className={`p-3 border rounded-xl text-xs flex items-center gap-2 ${saveResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <span>{saveResult.success ? '✔' : '❌'}</span>
            <span>{saveResult.success ? `Configuration saved successfully! (ID: ${saveResult.id})` : saveResult.error}</span>
          </div>
        )}

        <form className="space-y-6">
          {/* Market Data Mode Toggle */}
          <div className="space-y-2 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-900">Market Data Source</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex items-center justify-center p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition-colors ${
                formValues.marketDataMode === 'us'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}>
                <input type="radio" value="us" {...register('marketDataMode')} className="sr-only" aria-label="US Market (Shiller)" />
                US Market (Shiller)
              </label>
              <label className={`flex items-center justify-center p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition-colors ${
                formValues.marketDataMode === 'global'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}>
                <input type="radio" value="global" {...register('marketDataMode')} className="sr-only" aria-label="Global Market (MSCI)" />
                Global Market (MSCI)
              </label>
            </div>
          </div>

          {/* Simulation Mode Toggle */}
          <div className="space-y-2 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-900">Simulation Mode</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex items-center justify-center p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition-colors text-center ${
                formValues.simulationMode === 'historical'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}>
                <input type="radio" value="historical" {...register('simulationMode')} className="sr-only" aria-label="Historical Backtesting" />
                Historical Backtesting
              </label>
              <label className={`flex items-center justify-center p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition-colors text-center ${
                formValues.simulationMode === 'monte_carlo'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}>
                <input type="radio" value="monte_carlo" {...register('simulationMode')} className="sr-only" aria-label="Scrambled Monte Carlo" />
                Scrambled Monte Carlo
              </label>
            </div>
          </div>

          {/* Timeline Mode & Accumulation Inputs */}
          <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-900">Timeline & Accumulation</h3>
            <div className="grid grid-cols-1 gap-2">
              <label className={`flex items-center p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition-colors ${
                formValues.timelineMode === 'retirement_only'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}>
                <input type="radio" value="retirement_only" {...register('timelineMode')} className="sr-only" aria-label="Retirement Period Only" />
                Retirement Period Only
              </label>
              <label className={`flex items-center p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition-colors ${
                formValues.timelineMode === 'retirement_and_accumulation'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}>
                <input type="radio" value="retirement_and_accumulation" {...register('timelineMode')} className="sr-only" aria-label="Retirement & Accumulation Period" />
                Retirement & Accumulation Period
              </label>
            </div>

            <div className="space-y-3 pt-3 border-t border-gray-200">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="currentAge" className={`text-xs font-medium ${formValues.timelineMode === 'retirement_only' ? 'text-gray-400' : 'text-gray-700'}`}>Current Age</label>
                  <input
                    id="currentAge"
                    type="number"
                    disabled={formValues.timelineMode === 'retirement_only'}
                    {...register('currentAge', { valueAsNumber: true })}
                    className={`w-20 border text-xs rounded-lg p-1.5 text-right font-bold ${
                      formValues.timelineMode === 'retirement_only'
                        ? 'bg-gray-200 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                </div>
                {errors.currentAge && (
                  <div className="text-xs text-red-600 mt-1">{errors.currentAge.message}</div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="retirementAge" className={`text-xs font-medium ${formValues.timelineMode === 'retirement_only' ? 'text-gray-400' : 'text-gray-700'}`}>Retirement Age</label>
                  <input
                    id="retirementAge"
                    type="number"
                    disabled={formValues.timelineMode === 'retirement_only'}
                    {...register('retirementAge', { valueAsNumber: true })}
                    className={`w-20 border text-xs rounded-lg p-1.5 text-right font-bold ${
                      formValues.timelineMode === 'retirement_only'
                        ? 'bg-gray-200 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                </div>
                {errors.retirementAge && (
                  <div className="text-xs text-red-600 mt-1">{errors.retirementAge.message}</div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="additionalContribution" className={`text-xs font-medium ${formValues.timelineMode === 'retirement_only' ? 'text-gray-400' : 'text-gray-700'}`}>Additional Yearly Contributions ($)</label>
                  <input
                    id="additionalContribution"
                    type="number"
                    disabled={formValues.timelineMode === 'retirement_only'}
                    {...register('additionalContribution', { valueAsNumber: true })}
                    className={`w-28 border text-xs rounded-lg p-1.5 text-right font-bold ${
                      formValues.timelineMode === 'retirement_only'
                        ? 'bg-gray-200 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                </div>
                {errors.additionalContribution && (
                  <div className="text-xs text-red-600 mt-1">{errors.additionalContribution.message}</div>
                )}
              </div>
            </div>
          </div>

          {/* Initial Portfolio */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="initialPortfolio" className="text-sm font-medium text-gray-700">Initial Portfolio ($)</label>
              <input
                id="initialPortfolio"
                type="number"
                max="10000000"
                {...register('initialPortfolio', { valueAsNumber: true })}
                value={Number.isNaN(formValues.initialPortfolio) ? '' : formValues.initialPortfolio}
                className="w-32 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold"
              />
            </div>
            {errors.initialPortfolio && (
              <div className="text-xs text-red-600 mt-1">
                {errors.initialPortfolio.message}
              </div>
            )}
          </div>

          {/* Duration */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="duration" className="text-sm font-medium text-gray-700">Retirement Duration (Yrs)</label>
              <input
                id="duration"
                type="number"
                {...register('duration', { valueAsNumber: true })}
                value={Number.isNaN(formValues.duration) ? '' : formValues.duration}
                className="w-20 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold"
              />
            </div>
            {errors.duration && (
              <div className="text-xs text-red-600 mt-1">
                {errors.duration.message}
              </div>
            )}
            {formValues.duration >= 60 && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-900 flex items-center gap-2">
                <span>⚠️</span>
                <span>Notice: Retirement durations of 60-65 years rely on smaller historical sample sizes due to the available 1871–present dataset.</span>
              </div>
            )}
          </div>

          {/* Retirement Starting Age */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="retirementStartingAge" className="text-sm font-medium text-gray-700" title="Retirement starting age used for determining supplemental cash flow timings and guardrail rules.">Retirement Starting Age</label>
              <input
                id="retirementStartingAge"
                type="number"
                {...register('retirementStartingAge', { valueAsNumber: true })}
                value={Number.isNaN(formValues.retirementStartingAge) ? '' : formValues.retirementStartingAge}
                className="w-20 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold"
              />
            </div>
          </div>

          {/* Start Year Min/Max */}
          <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-900">Historical Simulation Range</h3>
            <div className="flex justify-between items-center">
              <label htmlFor="startYearMin" className="text-xs font-medium text-gray-700" title="Minimum historical start year for simulation runs.">Start Year Min</label>
              <input id="startYearMin" type="number" min="1871" max="2025" {...register('startYearMin', { valueAsNumber: true })} value={Number.isNaN(formValues.startYearMin) ? '' : formValues.startYearMin} className="w-20 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1 text-right font-bold" />
            </div>
            <div className="flex justify-between items-center">
              <label htmlFor="startYearMax" className="text-xs font-medium text-gray-700" title="Maximum historical start year for simulation runs.">Start Year Max</label>
              <input id="startYearMax" type="number" min="1871" max="2025" {...register('startYearMax', { valueAsNumber: true })} value={Number.isNaN(formValues.startYearMax) ? '' : formValues.startYearMax} className="w-20 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1 text-right font-bold" />
            </div>
          </div>

          {/* Supplemental Cash Flows */}
          <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-900">Supplemental Cash Flows</h3>
            
            {/* Additional Income */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Additional Income</label>
                <button
                  type="button"
                  onClick={() => {
                    const current = formValues.additionalIncome || [];
                    form.setValue('additionalIncome', [...current, { name: 'Pension / SS', annualAmount: 10000, startYearOffset: 0, duration: 20, inflated: true, inflationStart: 'when_starts' }]);
                  }}
                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors"
                >
                  + Add Income
                </button>
              </div>
              {formValues.additionalIncome?.map((cf, idx) => (
                <div key={idx} className="p-3 bg-white border border-gray-200 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center gap-2">
                    <input type="text" {...register(`additionalIncome.${idx}.name`)} aria-label="Additional Income Name" className="bg-gray-50 border border-gray-300 rounded p-1 font-bold flex-1 text-xs" />
                    <button type="button" onClick={() => {
                      const current = [...(formValues.additionalIncome || [])];
                      current.splice(idx, 1);
                      form.setValue('additionalIncome', current);
                    }} className="text-red-600 font-bold hover:text-red-800 px-1">✕</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor={`additionalIncome-${idx}-annualAmount`} className="text-gray-600 block text-[10px]">Annual Amount ($)</label>
                      <input id={`additionalIncome-${idx}-annualAmount`} type="number" {...register(`additionalIncome.${idx}.annualAmount`, { valueAsNumber: true })} className="w-full bg-gray-50 border border-gray-300 rounded p-1 font-bold text-xs text-right" />
                    </div>
                    <div>
                      <label htmlFor={`additionalIncome-${idx}-duration`} className="text-gray-600 block text-[10px]">Duration (Yrs)</label>
                      <input id={`additionalIncome-${idx}-duration`} type="number" {...register(`additionalIncome.${idx}.duration`, { valueAsNumber: true })} className="w-full bg-gray-50 border border-gray-300 rounded p-1 font-bold text-xs text-right" />
                    </div>
                    <div>
                      <label htmlFor={`additionalIncome-${idx}-startYearOffset`} className="text-gray-600 block text-[10px]">Start Year Offset</label>
                      <input id={`additionalIncome-${idx}-startYearOffset`} type="number" {...register(`additionalIncome.${idx}.startYearOffset`, { valueAsNumber: true })} className="w-full bg-gray-50 border border-gray-300 rounded p-1 font-bold text-xs text-right" />
                    </div>
                    <div>
                      <label htmlFor={`additionalIncome-${idx}-inflationStart`} className="text-gray-600 block text-[10px]">Inflation Start</label>
                      <select id={`additionalIncome-${idx}-inflationStart`} aria-label="Inflation Start" {...register(`additionalIncome.${idx}.inflationStart`)} className="w-full bg-gray-50 border border-gray-300 rounded p-1 font-bold text-xs">
                        <option value="immediately">Immediately</option>
                        <option value="when_starts">When Starts</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Extra Withdrawals */}
            <div className="space-y-2 pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Extra Withdrawals</label>
                <button
                  type="button"
                  onClick={() => {
                    const current = formValues.extraWithdrawals || [];
                    form.setValue('extraWithdrawals', [...current, { name: 'College / Medical', annualAmount: 20000, startYearOffset: 5, duration: 4, inflated: true, inflationStart: 'when_starts' }]);
                  }}
                  className="px-2 py-1 bg-purple-100 text-purple-800 rounded-lg text-xs font-bold hover:bg-purple-200 transition-colors"
                >
                  + Add Expense
                </button>
              </div>
              {formValues.extraWithdrawals?.map((cf, idx) => (
                <div key={idx} className="p-3 bg-white border border-gray-200 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center gap-2">
                    <input type="text" {...register(`extraWithdrawals.${idx}.name`)} aria-label="Extra Withdrawal Name" className="bg-gray-50 border border-gray-300 rounded p-1 font-bold flex-1 text-xs" />
                    <button type="button" onClick={() => {
                      const current = [...(formValues.extraWithdrawals || [])];
                      current.splice(idx, 1);
                      form.setValue('extraWithdrawals', current);
                    }} className="text-red-600 font-bold hover:text-red-800 px-1">✕</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor={`extraWithdrawals-${idx}-annualAmount`} className="text-gray-600 block text-[10px]">Annual Amount ($)</label>
                      <input id={`extraWithdrawals-${idx}-annualAmount`} type="number" {...register(`extraWithdrawals.${idx}.annualAmount`, { valueAsNumber: true })} className="w-full bg-gray-50 border border-gray-300 rounded p-1 font-bold text-xs text-right" />
                    </div>
                    <div>
                      <label htmlFor={`extraWithdrawals-${idx}-duration`} className="text-gray-600 block text-[10px]">Duration (Yrs)</label>
                      <input id={`extraWithdrawals-${idx}-duration`} type="number" {...register(`extraWithdrawals.${idx}.duration`, { valueAsNumber: true })} className="w-full bg-gray-50 border border-gray-300 rounded p-1 font-bold text-xs text-right" />
                    </div>
                    <div>
                      <label htmlFor={`extraWithdrawals-${idx}-startYearOffset`} className="text-gray-600 block text-[10px]">Start Year Offset</label>
                      <input id={`extraWithdrawals-${idx}-startYearOffset`} type="number" {...register(`extraWithdrawals.${idx}.startYearOffset`, { valueAsNumber: true })} className="w-full bg-gray-50 border border-gray-300 rounded p-1 font-bold text-xs text-right" />
                    </div>
                    <div>
                      <label htmlFor={`extraWithdrawals-${idx}-inflationStart`} className="text-gray-600 block text-[10px]">Inflation Start</label>
                      <select id={`extraWithdrawals-${idx}-inflationStart`} aria-label="Inflation Start" {...register(`extraWithdrawals.${idx}.inflationStart`)} className="w-full bg-gray-50 border border-gray-300 rounded p-1 font-bold text-xs">
                        <option value="immediately">Immediately</option>
                        <option value="when_starts">When Starts</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Withdrawal Strategy Selector */}
          <div>
            <label htmlFor="withdrawalStrategy" className="text-sm font-medium text-gray-700 block mb-2">Withdrawal Strategy</label>
            <select
              id="withdrawalStrategy"
              aria-label="Withdrawal Strategy"
              {...register('withdrawalStrategy')}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 font-bold"
            >
              {withdrawalStrategies.map((strategy) => (
                <option key={strategy} value={strategy}>
                  {strategyLabels[strategy]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setActiveMainTab('data-assumptions')}
              className="text-xs text-blue-700 hover:underline mt-1 block"
            >
              (learn about this strategy)
            </button>
          </div>

          {/* Dynamic Withdrawal Strategy Form Framework */}
          <div className="space-y-6 pt-4 border-t border-gray-100">
            {/* 1. constant_dollar */}
            {formValues.withdrawalStrategy === 'constant_dollar' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="annualWithdrawal" className="text-sm font-medium text-gray-700" title="The starting dollar amount withdrawn in the first year of retirement, which is adjusted for inflation in subsequent years.">Annual Withdrawal ($)</label>
                    <input id="annualWithdrawal" type="number" step="1" {...register('annualWithdrawal', { valueAsNumber: true })} value={Number.isNaN(formValues.annualWithdrawal) ? '' : formValues.annualWithdrawal} className="w-32 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
                <div className="flex items-center">
                  <input id="inflationAdjustedFirstYearWithdrawal" type="checkbox" {...register('inflationAdjustedFirstYearWithdrawal')} className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500" />
                  <label htmlFor="inflationAdjustedFirstYearWithdrawal" className="ml-2 text-xs font-medium text-gray-700" title="Adjusts the initial withdrawal amount for inflation occurring between the simulation base year and retirement start.">Inflation Adjusted First Year Withdrawal</label>
                </div>
              </>
            )}

            {/* 2. percent_of_portfolio */}
            {formValues.withdrawalStrategy === 'percent_of_portfolio' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="percentageOfPortfolio" className="text-sm font-medium text-gray-700" title="The percentage of your current portfolio balance to withdraw each year.">Percentage of Portfolio (%)</label>
                  <input id="percentageOfPortfolio" type="number" step="0.01" {...register('percentageOfPortfolio', { valueAsNumber: true })} value={Number.isNaN(formValues.percentageOfPortfolio) ? '' : formValues.percentageOfPortfolio} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                </div>
              </div>
            )}

            {/* 3. one_over_n */}
            {formValues.withdrawalStrategy === 'one_over_n' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="oneOverNTargetPortfolio" className="text-sm font-medium text-gray-700" title="The target end portfolio balance for the 1/N remaining years calculation.">Target End Portfolio ($)</label>
                  <input id="oneOverNTargetPortfolio" type="number" step="1" {...register('oneOverNTargetPortfolio', { valueAsNumber: true })} value={Number.isNaN(formValues.oneOverNTargetPortfolio) ? '' : formValues.oneOverNTargetPortfolio} className="w-32 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                </div>
              </div>
            )}

            {/* 4. vpw */}
            {formValues.withdrawalStrategy === 'vpw' && (
              <>
                <div className="flex items-center mb-2">
                  <input id="cvpwMode" type="checkbox" {...register('cvpwMode')} className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500" />
                  <label htmlFor="cvpwMode" className="ml-2 text-xs font-bold text-gray-900" title="Enables Custom VPW mode to override expected returns and target end portfolio balances.">Enable Custom VPW Mode (cVPW)</label>
                </div>
                {formValues.cvpwMode && (
                  <div className="space-y-4 pl-4 pt-2 border-l-2 border-blue-200">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label htmlFor="vpw-cvpwRate" className="text-xs font-medium text-gray-700" title="Expected portfolio return rate override for the PMT self-amortizing formula.">CVPW Rate (%)</label>
                        <input id="vpw-cvpwRate" type="number" step="0.01" {...register('cvpwRate', { valueAsNumber: true })} value={Number.isNaN(formValues.cvpwRate) ? '' : formValues.cvpwRate} className="w-24 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1 text-right font-bold" />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label htmlFor="vpw-cvpwTargetPortfolio" className="text-xs font-medium text-gray-700" title="Target ending portfolio balance for the CVPW amortization schedule.">CVPW Target Portfolio ($)</label>
                        <input id="vpw-cvpwTargetPortfolio" type="number" step="1" {...register('cvpwTargetPortfolio', { valueAsNumber: true })} value={Number.isNaN(formValues.cvpwTargetPortfolio) ? '' : formValues.cvpwTargetPortfolio} className="w-32 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1 text-right font-bold" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 5. cvpw (Legacy alias) */}
            {formValues.withdrawalStrategy === 'cvpw' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="cvpw-cvpwRate" className="text-sm font-medium text-gray-700" title="Expected portfolio return rate override for the PMT self-amortizing formula.">CVPW Rate (%)</label>
                    <input id="cvpw-cvpwRate" type="number" step="0.01" {...register('cvpwRate', { valueAsNumber: true })} value={Number.isNaN(formValues.cvpwRate) ? '' : formValues.cvpwRate} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="cvpw-cvpwTargetPortfolio" className="text-sm font-medium text-gray-700" title="Target ending portfolio balance for the CVPW amortization schedule.">CVPW Target Portfolio ($)</label>
                    <input id="cvpw-cvpwTargetPortfolio" type="number" step="1" {...register('cvpwTargetPortfolio', { valueAsNumber: true })} value={Number.isNaN(formValues.cvpwTargetPortfolio) ? '' : formValues.cvpwTargetPortfolio} className="w-32 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
              </>
            )}

            {/* 6. dynamic_swr */}
            {formValues.withdrawalStrategy === 'dynamic_swr' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="dynamicSwrRoiAssumption" className="text-sm font-medium text-gray-700" title="Expected ROI assumption used in Nesteggly's continuous annuitization formula.">ROI Assumption (%)</label>
                    <input id="dynamicSwrRoiAssumption" type="number" step="0.01" {...register('dynamicSwrRoiAssumption', { valueAsNumber: true })} value={Number.isNaN(formValues.dynamicSwrRoiAssumption) ? '' : formValues.dynamicSwrRoiAssumption} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="dynamicSwrInflationAssumption" className="text-sm font-medium text-gray-700" title="Expected inflation assumption used in Nesteggly's continuous annuitization formula.">Inflation Assumption (%)</label>
                    <input id="dynamicSwrInflationAssumption" type="number" step="0.01" {...register('dynamicSwrInflationAssumption', { valueAsNumber: true })} value={Number.isNaN(formValues.dynamicSwrInflationAssumption) ? '' : formValues.dynamicSwrInflationAssumption} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
              </>
            )}

            {/* 7. guyton_klinger */}
            {formValues.withdrawalStrategy === 'guyton_klinger' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="gkInitialWithdrawal" className="text-sm font-medium text-gray-700" title="The starting initial withdrawal amount.">Initial Withdrawal ($)</label>
                    <input id="gkInitialWithdrawal" type="number" step="1" {...register('gkInitialWithdrawal', { valueAsNumber: true })} value={Number.isNaN(formValues.gkInitialWithdrawal) ? '' : formValues.gkInitialWithdrawal} className="w-32 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="gkWithdrawalUpperLimit" className="text-sm font-medium text-gray-700" title="Percentage increase in withdrawal rate required to trigger a spending cut (Capital Preservation Rule).">Withdrawal Upper Limit (%)</label>
                    <input id="gkWithdrawalUpperLimit" type="number" step="0.01" {...register('gkWithdrawalUpperLimit', { valueAsNumber: true })} value={Number.isNaN(formValues.gkWithdrawalUpperLimit) ? '' : formValues.gkWithdrawalUpperLimit} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="gkWithdrawalLowerLimit" className="text-sm font-medium text-gray-700" title="Percentage reduction in withdrawal rate required to trigger a spending increase (Prosperity Rule).">Withdrawal Lower Limit (%)</label>
                    <input id="gkWithdrawalLowerLimit" type="number" step="0.01" {...register('gkWithdrawalLowerLimit', { valueAsNumber: true })} value={Number.isNaN(formValues.gkWithdrawalLowerLimit) ? '' : formValues.gkWithdrawalLowerLimit} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="gkUpperLimitAdjustment" className="text-sm font-medium text-gray-700" title="Percentage by which spending is reduced when the upper limit is breached.">Upper Limit Adjustment (%)</label>
                    <input id="gkUpperLimitAdjustment" type="number" step="0.01" {...register('gkUpperLimitAdjustment', { valueAsNumber: true })} value={Number.isNaN(formValues.gkUpperLimitAdjustment) ? '' : formValues.gkUpperLimitAdjustment} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="gkLowerLimitAdjustment" className="text-sm font-medium text-gray-700" title="Percentage by which spending is increased when the lower limit is breached.">Lower Limit Adjustment (%)</label>
                    <input id="gkLowerLimitAdjustment" type="number" step="0.01" {...register('gkLowerLimitAdjustment', { valueAsNumber: true })} value={Number.isNaN(formValues.gkLowerLimitAdjustment) ? '' : formValues.gkLowerLimitAdjustment} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
                <div className="space-y-3 pt-4 border-t border-gray-100 bg-gray-50 p-4 rounded-xl">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Guyton-Klinger Special Rules</h3>
                  <div className="flex items-center">
                    <input id="gkModifiedWithdrawalRule" type="checkbox" {...register('gkModifiedWithdrawalRule')} className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500" />
                    <label htmlFor="gkModifiedWithdrawalRule" className="ml-2 text-xs font-medium text-gray-700" title="Freezes inflation adjustment if total portfolio return was negative in the prior year.">Modified Withdrawal Rule (Inflation Freeze)</label>
                  </div>
                  <div className="flex items-center">
                    <input id="gkIgnoreLastFifteenYears" type="checkbox" {...register('gkIgnoreLastFifteenYears')} className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500" />
                    <label htmlFor="gkIgnoreLastFifteenYears" className="ml-2 text-xs font-medium text-gray-700" title="Ignores Capital Preservation spending cuts during the final 15 years of retirement.">Ignore Capital Preservation in Final 15 Years</label>
                  </div>
                </div>
              </>
            )}

            {/* 8. vanguard_dynamic */}
            {formValues.withdrawalStrategy === 'vanguard_dynamic' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="vanguardDynamicSpendingWithdrawalRate" className="text-sm font-medium text-gray-700" title="The baseline target withdrawal rate percentage.">Withdrawal Rate (%)</label>
                    <input id="vanguardDynamicSpendingWithdrawalRate" type="number" step="0.01" {...register('vanguardDynamicSpendingWithdrawalRate', { valueAsNumber: true })} value={Number.isNaN(formValues.vanguardDynamicSpendingWithdrawalRate) ? '' : formValues.vanguardDynamicSpendingWithdrawalRate} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="vanguardDynamicSpendingCeiling" className="text-sm font-medium text-gray-700" title="The maximum percentage increase in spending allowed from one year to the next during favorable market conditions.">Spending Ceiling (%)</label>
                    <input id="vanguardDynamicSpendingCeiling" type="number" step="0.01" {...register('vanguardDynamicSpendingCeiling', { valueAsNumber: true })} value={Number.isNaN(formValues.vanguardDynamicSpendingCeiling) ? '' : formValues.vanguardDynamicSpendingCeiling} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="vanguardDynamicSpendingFloor" className="text-sm font-medium text-gray-700" title="The maximum percentage reduction in spending allowed from one year to the next during unfavorable market conditions.">Spending Floor (%)</label>
                    <input id="vanguardDynamicSpendingFloor" type="number" step="0.01" {...register('vanguardDynamicSpendingFloor', { valueAsNumber: true })} value={Number.isNaN(formValues.vanguardDynamicSpendingFloor) ? '' : formValues.vanguardDynamicSpendingFloor} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
              </>
            )}

            {/* 9. endowment */}
            {formValues.withdrawalStrategy === 'endowment' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="endowmentPreviousWithdrawalRatio" className="text-sm font-medium text-gray-700" title="The percentage weight given to the prior year's inflation-adjusted spending.">Previous Withdrawal Ratio (%)</label>
                    <input id="endowmentPreviousWithdrawalRatio" type="number" step="0.01" {...register('endowmentPreviousWithdrawalRatio', { valueAsNumber: true })} value={Number.isNaN(formValues.endowmentPreviousWithdrawalRatio) ? '' : formValues.endowmentPreviousWithdrawalRatio} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="endowmentPercentOfPortfolio" className="text-sm font-medium text-gray-700" title="The percentage weight given to the current portfolio balance.">Percent of Portfolio (%)</label>
                    <input id="endowmentPercentOfPortfolio" type="number" step="0.01" {...register('endowmentPercentOfPortfolio', { valueAsNumber: true })} value={Number.isNaN(formValues.endowmentPercentOfPortfolio) ? '' : formValues.endowmentPercentOfPortfolio} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
              </>
            )}

            {/* 10. rule_95 */}
            {formValues.withdrawalStrategy === 'rule_95' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="ninetyFiveWithdrawalRate" className="text-sm font-medium text-gray-700" title="The standard Safe Withdrawal Rate percentage applied to the current balance.">Withdrawal Rate (%)</label>
                    <input id="ninetyFiveWithdrawalRate" type="number" step="0.01" {...register('ninetyFiveWithdrawalRate', { valueAsNumber: true })} value={Number.isNaN(formValues.ninetyFiveWithdrawalRate) ? '' : formValues.ninetyFiveWithdrawalRate} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="ninetyFivePercentage" className="text-sm font-medium text-gray-700" title="The floor percentage of the previous year's spending to retain (e.g. 95%).">Rule 95 Percentage (%)</label>
                    <input id="ninetyFivePercentage" type="number" step="0.01" {...register('ninetyFivePercentage', { valueAsNumber: true })} value={Number.isNaN(formValues.ninetyFivePercentage) ? '' : formValues.ninetyFivePercentage} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
              </>
            )}

            {/* 11. cape_based */}
            {formValues.withdrawalStrategy === 'cape_based' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="capeWithdrawalRate" className="text-sm font-medium text-gray-700" title="The baseline initial withdrawal rate percentage.">Withdrawal Rate (%)</label>
                    <input id="capeWithdrawalRate" type="number" step="0.01" {...register('capeWithdrawalRate', { valueAsNumber: true })} value={Number.isNaN(formValues.capeWithdrawalRate) ? '' : formValues.capeWithdrawalRate} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="capeWeight" className="text-sm font-medium text-gray-700" title="The percentage weight given to the CAPE earnings yield versus the baseline withdrawal rate.">CAPE Weight (%)</label>
                    <input id="capeWeight" type="number" step="0.01" {...register('capeWeight', { valueAsNumber: true })} value={Number.isNaN(formValues.capeWeight) ? '' : formValues.capeWeight} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
              </>
            )}

            {/* 12. sensible */}
            {formValues.withdrawalStrategy === 'sensible' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="sensibleBaseWithdrawalRate" className="text-sm font-medium text-gray-700" title="The secure baseline percentage withdrawn regardless of market performance.">Base Withdrawal Rate (%)</label>
                    <input id="sensibleBaseWithdrawalRate" type="number" step="0.01" {...register('sensibleBaseWithdrawalRate', { valueAsNumber: true })} value={Number.isNaN(formValues.sensibleBaseWithdrawalRate) ? '' : formValues.sensibleBaseWithdrawalRate} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="sensibleExtrasWithdrawalRate" className="text-sm font-medium text-gray-700" title="The percentage of the prior year's portfolio gains to withdraw as additional discretionary spending.">Extras Withdrawal Rate (%)</label>
                    <input id="sensibleExtrasWithdrawalRate" type="number" step="0.01" {...register('sensibleExtrasWithdrawalRate', { valueAsNumber: true })} value={Number.isNaN(formValues.sensibleExtrasWithdrawalRate) ? '' : formValues.sensibleExtrasWithdrawalRate} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
              </>
            )}

            {/* 13. hebeler_autopilot */}
            {formValues.withdrawalStrategy === 'hebeler_autopilot' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="hebelerFirstYearWithdrawalRate" className="text-sm font-medium text-gray-700" title="The baseline first year withdrawal rate percentage.">First Year Withdrawal Rate (%)</label>
                    <input id="hebelerFirstYearWithdrawalRate" type="number" step="0.01" {...register('hebelerFirstYearWithdrawalRate', { valueAsNumber: true })} value={Number.isNaN(formValues.hebelerFirstYearWithdrawalRate) ? '' : formValues.hebelerFirstYearWithdrawalRate} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="hebelerPreviousWithdrawalRatio" className="text-sm font-medium text-gray-700" title="The percentage weight assigned to the previous withdrawal component.">Previous Withdrawal Ratio (%)</label>
                    <input id="hebelerPreviousWithdrawalRatio" type="number" step="0.01" {...register('hebelerPreviousWithdrawalRatio', { valueAsNumber: true })} value={Number.isNaN(formValues.hebelerPreviousWithdrawalRatio) ? '' : formValues.hebelerPreviousWithdrawalRatio} className="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-bold" />
                  </div>
                </div>
              </>
            )}

            {/* Guardrail Checkboxes for all strategies except constant_dollar */}
            {formValues.withdrawalStrategy !== 'constant_dollar' && (
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Spending Guardrails</h4>
                
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input id="minWithdrawalLimitEnabled" type="checkbox" {...register('minWithdrawalLimitEnabled')} className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500" />
                    <label htmlFor="minWithdrawalLimitEnabled" className="ml-2 text-xs font-bold text-gray-900" title="Enables an absolute minimum dollar floor for annual spending.">Enable Min Withdrawal Limit</label>
                  </div>
                  {formValues.minWithdrawalLimitEnabled && (
                    <div className="flex justify-between items-center pl-4 pt-1 border-l-2 border-blue-200">
                      <label htmlFor="minWithdrawalLimit" className="text-xs font-medium text-gray-700">Min Limit ($)</label>
                      <input id="minWithdrawalLimit" type="number" step="1" {...register('minWithdrawalLimit', { valueAsNumber: true })} value={Number.isNaN(formValues.minWithdrawalLimit) ? '' : formValues.minWithdrawalLimit} className="w-32 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1 text-right font-bold" />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center">
                    <input id="maxWithdrawalLimitEnabled" type="checkbox" {...register('maxWithdrawalLimitEnabled')} className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500" />
                    <label htmlFor="maxWithdrawalLimitEnabled" className="ml-2 text-xs font-bold text-gray-900" title="Enables an absolute maximum dollar ceiling for annual spending.">Enable Max Withdrawal Limit</label>
                  </div>
                  {formValues.maxWithdrawalLimitEnabled && (
                    <div className="flex justify-between items-center pl-4 pt-1 border-l-2 border-blue-200">
                      <label htmlFor="maxWithdrawalLimit" className="text-xs font-medium text-gray-700">Max Limit ($)</label>
                      <input id="maxWithdrawalLimit" type="number" step="1" {...register('maxWithdrawalLimit', { valueAsNumber: true })} value={Number.isNaN(formValues.maxWithdrawalLimit) ? '' : formValues.maxWithdrawalLimit} className="w-32 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 text-right font-bold" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {Object.keys(errors).length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
              <span>❌</span>
              <span>
                Validation error: {Object.values(errors)[0]?.message as string || 'Check input parameters.'}. Simulation is paused until corrected.
              </span>
            </div>
          )}

          {/* Asset Allocation & Glide Path Wrapper Card */}
          <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-900">Asset Allocation & Glide Path</h3>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="equitiesInput" className="text-xs font-medium text-gray-700">Equities (%)</label>
                <input
                  id="equitiesInput"
                  type="number"
                  {...register('equities', { valueAsNumber: true })}
                  value={Number.isNaN(formValues.equities) ? '' : formValues.equities}
                  className="w-16 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1 text-right font-bold"
                />
              </div>
              <input
                id="equitiesRange"
                aria-label="Equities Range"
                type="range"
                min="0"
                max="100"
                step="5"
                {...register('equities', { valueAsNumber: true })}
                value={Number.isNaN(formValues.equities) ? 60 : formValues.equities}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="bondsInput" className="text-xs font-medium text-gray-700">Bonds (%)</label>
                <input
                  id="bondsInput"
                  type="number"
                  {...register('bonds', { valueAsNumber: true })}
                  value={Number.isNaN(formValues.bonds) ? '' : formValues.bonds}
                  className="w-16 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1 text-right font-bold"
                />
              </div>
              <input
                id="bondsRange"
                aria-label="Bonds Range"
                type="range"
                min="0"
                max="100"
                step="5"
                {...register('bonds', { valueAsNumber: true })}
                value={Number.isNaN(formValues.bonds) ? 40 : formValues.bonds}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="cashInput" className="text-xs font-medium text-gray-700">Cash (%)</label>
                <input
                  id="cashInput"
                  type="number"
                  {...register('cash', { valueAsNumber: true })}
                  value={Number.isNaN(formValues.cash) ? '' : formValues.cash}
                  className="w-16 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1 text-right font-bold"
                />
              </div>
              <input
                id="cashRange"
                aria-label="Cash Range"
                type="range"
                min="0"
                max="100"
                step="5"
                {...register('cash', { valueAsNumber: true })}
                value={Number.isNaN(formValues.cash) ? 0 : formValues.cash}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {totalAllocation !== 100 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
                <span>❌</span>
                <span>Asset allocations must total exactly 100% (currently {totalAllocation}%). Simulation is paused until corrected.</span>
              </div>
            )}

            {/* Investment Fees & Cash Baseline */}
            <div className="space-y-3 pt-3 border-t border-gray-200">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Investment Fees & Cash Growth</h4>
              <div className="flex justify-between items-center">
                <label htmlFor="equitiesFee" className="text-xs font-medium text-gray-700" title="Annual expense ratio deducted directly from gross equities returns.">Equities Fee (%)</label>
                <input id="equitiesFee" type="number" step="0.01" min="0" max="10" {...register('equitiesFee', { valueAsNumber: true })} value={Number.isNaN(formValues.equitiesFee) ? '' : formValues.equitiesFee} className="w-16 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1 text-right font-bold" />
              </div>
              <div className="flex justify-between items-center">
                <label htmlFor="bondsFee" className="text-xs font-medium text-gray-700" title="Annual expense ratio deducted directly from gross bond returns.">Bonds Fee (%)</label>
                <input id="bondsFee" type="number" step="0.01" min="0" max="10" {...register('bondsFee', { valueAsNumber: true })} value={Number.isNaN(formValues.bondsFee) ? '' : formValues.bondsFee} className="w-16 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1 text-right font-bold" />
              </div>
              <div className="flex justify-between items-center">
                <label htmlFor="cashGrowthRate" className="text-xs font-medium text-gray-700" title="Baseline annual growth rate for cash allocation (e.g. High-Yield Savings Account).">Cash Growth Rate (%)</label>
                <input id="cashGrowthRate" type="number" step="0.1" min="0" max="20" {...register('cashGrowthRate', { valueAsNumber: true })} value={Number.isNaN(formValues.cashGrowthRate) ? '' : formValues.cashGrowthRate} className="w-16 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1 text-right font-bold" />
              </div>
            </div>

            {/* Rebalancing & Portfolio Drift */}
            <div className="space-y-3 pt-3 border-t border-gray-200">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Rebalancing & Drift</h4>
              <div className="flex items-center">
                <input id="rebalancePortfolio" type="checkbox" {...register('rebalancePortfolio')} className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500" />
                <label htmlFor="rebalancePortfolio" className="ml-2 text-xs font-bold text-gray-900" title="When unchecked, portfolio assets drift independently over time rather than forcing annual rebalancing.">Enable Portfolio Rebalancing</label>
              </div>
              {formValues.rebalancePortfolio !== false && (
                <div className="flex justify-between items-center pl-4 pt-1 border-l-2 border-blue-200">
                  <label htmlFor="rebalanceFrequency" className="text-xs font-medium text-gray-700" title="How often (in years) the portfolio is rebalanced back to target allocation.">Rebalance Frequency (Yrs)</label>
                  <input id="rebalanceFrequency" type="number" min="1" max="20" {...register('rebalanceFrequency', { valueAsNumber: true })} value={Number.isNaN(formValues.rebalanceFrequency) ? '' : formValues.rebalanceFrequency} className="w-16 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1 text-right font-bold" />
                </div>
              )}
            </div>

            {/* Glide Path Config */}
            <div className="space-y-3 pt-3 border-t border-gray-200">
              <div className="flex items-center">
                <input id="glidePath" type="checkbox" {...register('glidePath')} className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500" />
                <label htmlFor="glidePath" className="ml-2 text-xs font-bold text-gray-900">Enable Glide Path</label>
              </div>
              {formValues.glidePath && (
                <div className="space-y-4 pl-4 pt-2 border-l-2 border-blue-200">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="targetEquitiesInput" className="text-xs font-medium text-gray-700">Target Equities (%)</label>
                      <input
                        id="targetEquitiesInput"
                        type="number"
                        {...register('targetEquities', { valueAsNumber: true })}
                        value={Number.isNaN(formValues.targetEquities) ? '' : formValues.targetEquities}
                        className="w-16 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1 text-right font-bold"
                      />
                    </div>
                    <input
                      id="targetEquitiesRange"
                      aria-label="Target Equities Range"
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      {...register('targetEquities', { valueAsNumber: true })}
                      value={Number.isNaN(formValues.targetEquities) ? 40 : formValues.targetEquities}
                      className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    {errors.targetEquities && (
                      <div className="mt-1 text-xs text-red-600">
                        {errors.targetEquities.message}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="glidePathDuration" className="text-xs font-medium text-gray-700">Glide Path Duration (Yrs)</label>
                      <input
                        id="glidePathDuration"
                        type="number"
                        {...register('glidePathDuration', { valueAsNumber: true })}
                        value={Number.isNaN(formValues.glidePathDuration) ? '' : formValues.glidePathDuration}
                        className="w-16 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1 text-right font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="glidePathPace" className="text-xs font-medium text-gray-700">Glide Path Pace</label>
                      <select id="glidePathPace" aria-label="Glide Path Pace" {...register('glidePathPace')} className="bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1 font-bold">
                        <option value="evenly">Evenly (Linear)</option>
                        <option value="slowly">Slowly (Quad In)</option>
                        <option value="quickly">Quickly (Quad Out)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </aside>

      {/* Main Content (Stacked Views & Tabs) */}
      <main className="flex-1 space-y-6">
        {/* Tab Navigation Header */}
        <div className="flex border-b border-gray-200 gap-6 px-2">
          <button
            type="button"
            onClick={() => setActiveMainTab('simulation')}
            className={`py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
              activeMainTab === 'simulation'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-gray-700 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Simulation Results
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('data-assumptions')}
            className={`py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
              activeMainTab === 'data-assumptions'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-gray-700 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Data & Assumptions
          </button>
        </div>

        {/* Persistent Simulation Context & Tab Content */}
        <SimulationProviderDynamic initialConfig={query}>
          {activeMainTab === 'simulation' ? (
            <div className="space-y-12">
              <SummaryView />
              <PortfolioValueView />
              <AvailableSpendingView />
              <SimulationsListView />
            </div>
          ) : (
            <DataAssumptionsView />
          )}
        </SimulationProviderDynamic>
      </main>
    </div>
  );
}
