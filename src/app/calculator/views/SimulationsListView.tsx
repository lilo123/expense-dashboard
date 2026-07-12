'use client';

import React, { useState, useMemo } from 'react';
import { useSimulation } from '../../../SimulationProvider';
import { SimulationRunResult } from '../../../types/simulation';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

export function SimulationsListView() {
  const { result, config, isCalculating } = useSimulation();
  const isMonteCarlo = config?.simulationMode === 'monte_carlo';
  const [sortBy, setSortBy] = useState<'date' | 'stocks' | 'portfolio' | 'lowestMinSpend' | 'highestSuccess' | 'lowestSuccess'>('date');
  const [filterBy, setFilterBy] = useState<'all' | 'success' | 'depleted' | 'volatile' | 'excess'>('all');
  const [showAll, setShowAll] = useState(false);
  const [selectedRun, setSelectedRun] = useState<SimulationRunResult | null>(null);
  const [modalTab, setModalTab] = useState<'charts' | 'table'>('charts');
  const [colorPalette, setColorPalette] = useState<'default' | 'protanopia' | 'deuteranopia' | 'tritanopia'>('default');
  const [scrubbedYear, setScrubbedYear] = useState<any | null>(null);

  const filteredAndSortedRuns = useMemo(() => {
    if (!result || !result.runs.length) return [];
    let copy = [...result.runs];

    const accumulationYears = config?.timelineMode === 'retirement_and_accumulation'
      ? Math.max(0, (config?.retirementAge || 0) - (config?.currentAge || 0))
      : 0;

    // Filtering
    if (filterBy === 'success') {
      copy = copy.filter(r => r.isSuccessful);
    } else if (filterBy === 'depleted') {
      copy = copy.filter(r => !r.isSuccessful);
    } else if (filterBy === 'volatile') {
      copy = copy.filter(r => {
        const retirementYears = r.years.slice(accumulationYears);
        for (let t = 1; t < retirementYears.length; t++) {
          const w_prev = retirementYears[t - 1].realWithdrawal;
          const w_curr = retirementYears[t].realWithdrawal;
          if (w_prev > 0 && Math.abs(w_curr - w_prev) / w_prev > 0.25) return true;
        }
        return false;
      });
    } else if (filterBy === 'excess') {
      const initial = config?.initialPortfolio || 1000000;
      copy = copy.filter(r => r.realEndingBalance >= 2.0 * initial);
    }

    // Sorting
    copy.sort((a, b) => {
      if (sortBy === 'date') {
        return b.startYear - a.startYear;
      } else if (sortBy === 'stocks') {
        return b.avgStocksReturn - a.avgStocksReturn;
      } else if (sortBy === 'portfolio') {
        return b.realEndingBalance - a.realEndingBalance;
      } else if (sortBy === 'lowestMinSpend') {
        const minA = Math.min(...a.years.slice(accumulationYears).map(y => y.realWithdrawal));
        const minB = Math.min(...b.years.slice(accumulationYears).map(y => y.realWithdrawal));
        return minA - minB;
      } else if (sortBy === 'highestSuccess') {
        return (b.isSuccessful ? 1 : 0) - (a.isSuccessful ? 1 : 0);
      } else if (sortBy === 'lowestSuccess') {
        return (a.isSuccessful ? 1 : 0) - (b.isSuccessful ? 1 : 0);
      }
      return 0;
    });

    return copy;
  }, [result, config, sortBy, filterBy]);

  if (!result) {
    return <div className="p-8 text-center text-gray-600 animate-pulse">Loading Simulations List...</div>;
  }

  const displayedRuns = showAll ? filteredAndSortedRuns : filteredAndSortedRuns.slice(0, 12);
  const totalRuns = filteredAndSortedRuns.length;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const palettes = {
    default: { surplus: '#3b82f6', warning: '#f97316', depletion: '#ef4444', inflation: '#8b5cf6' },
    protanopia: { surplus: '#0366d6', warning: '#fb8f67', depletion: '#d73a49', inflation: '#6f42c1' },
    deuteranopia: { surplus: '#005cc5', warning: '#e36209', depletion: '#cb2431', inflation: '#5a32a3' },
    tritanopia: { surplus: '#00909e', warning: '#ffc107', depletion: '#ff5252', inflation: '#654062' },
  };
  const activePalette = palettes[colorPalette];

  return (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6 transition-opacity duration-200 ${isCalculating ? 'opacity-100' : 'opacity-100'}`}>
      {/* Title & Sorting Dropdown */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Simulations</h2>
          <p className="text-xs text-gray-600 mt-1">Click a simulation to view details.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="sortBySelect" className="text-sm font-medium text-gray-600">Sort by:</label>
            <select
              id="sortBySelect"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 p-2.5 font-medium"
            >
              <option value="date">{isMonteCarlo ? 'Run Number' : 'Date'}</option>
              <option value="stocks">Average Stocks Return</option>
              <option value="portfolio">End portfolio</option>
              <option value="lowestMinSpend">Lowest Minimum Spend</option>
              <option value="highestSuccess">Highest Success Rate</option>
              <option value="lowestSuccess">Lowest Success Rate</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2 pt-2">
        {[
          { label: 'All', value: 'all' },
          { label: 'Success Only', value: 'success' },
          { label: 'Depleted Only', value: 'depleted' },
          { label: 'Volatile Spending (>25% YoY)', value: 'volatile' },
          { label: 'Excess Portfolio (>= 2x Initial)', value: 'excess' },
        ].map(chip => (
          <button
            key={chip.value}
            onClick={() => setFilterBy(chip.value as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterBy === chip.value ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Grid of simulation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {displayedRuns.map((run) => {
          const isLarge = run.realEndingBalance >= 2.0 * (config?.initialPortfolio || 1000000);
          return (
            <div
              key={run.startYear}
              onClick={() => { setSelectedRun(run); setScrubbedYear(null); }}
              className="bg-gray-50 hover:bg-blue-50/50 cursor-pointer p-5 rounded-2xl border border-gray-200 hover:border-blue-300 transition-all shadow-sm flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-gray-900 text-base">{isMonteCarlo ? `Run #${run.startYear}` : `${run.startYear}–${run.endYear}`}</span>
                <div className="flex items-center gap-1.5 text-base">
                  {isLarge && <span title="Large End Portfolio (>= 2x Initial)">💰</span>}
                  {run.isSuccessful ? <span title="Success">✅</span> : <span title="Depleted">❌</span>}
                </div>
              </div>
              <div className="space-y-1 text-xs text-gray-800">
                <div className="flex justify-between">
                  <span>End portfolio:</span>
                  <span className="font-bold text-gray-900">{formatCurrency(run.realEndingBalance)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Stocks Return:</span>
                  <span className="font-medium text-gray-900">{(run.avgStocksReturn * 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-sm text-gray-800">
        <span>Listing {displayedRuns.length} of {totalRuns} simulations.</span>
        {!showAll && totalRuns > 12 && (
          <button
            onClick={() => setShowAll(true)}
            className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 font-semibold text-sm rounded-xl transition-colors"
          >
            List All Simulations
          </button>
        )}
      </div>

      {/* Modal for detailed year-by-year progression */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{isMonteCarlo ? `Simulation Details: Run #${selectedRun.startYear}` : `Simulation Details: Cohort ${selectedRun.startYear}–${selectedRun.endYear}`}</h3>
                <p className="text-xs text-gray-600 mt-1">Final Balance: {formatCurrency(selectedRun.realEndingBalance)} ({selectedRun.isSuccessful ? 'Success' : 'Depleted'})</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex bg-gray-200 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setModalTab('charts')}
                    className={`px-4 py-2 rounded-lg transition-all ${modalTab === 'charts' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-800 hover:text-gray-900'}`}
                  >
                    📊 Charts View
                  </button>
                  <button
                    onClick={() => setModalTab('table')}
                    className={`px-4 py-2 rounded-lg transition-all ${modalTab === 'table' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-800 hover:text-gray-900'}`}
                  >
                    ≡ Table View
                  </button>
                </div>
                <button
                  onClick={() => setSelectedRun(null)}
                  className="text-gray-700 hover:text-gray-900 font-bold text-2xl p-2"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {modalTab === 'charts' ? (
                <div className="p-6 space-y-8">
                  {/* Palette Selector */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">Accessible Chart Themes</h4>
                      <p className="text-xs text-gray-600">Select a color palette optimized for color vision deficiencies.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 bg-gray-200 p-1 rounded-xl text-xs font-bold">
                      {(['default', 'protanopia', 'deuteranopia', 'tritanopia'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setColorPalette(p)}
                          className={`px-3 py-1.5 rounded-lg capitalize transition-all ${colorPalette === p ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-800 hover:text-gray-900'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Crosshair Scrubbing Display */}
                  {scrubbedYear ? (
                    <div className="bg-blue-900 text-white p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in duration-200">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-300">Scrubbing Details</span>
                        <h4 className="text-xl font-extrabold">
                          {config?.timelineMode === 'retirement_and_accumulation' && scrubbedYear.age <= Math.max(0, (config?.retirementAge || 0) - (config?.currentAge || 0))
                            ? `Accumulation Year ${scrubbedYear.age}`
                            : `Retirement Year ${scrubbedYear.age - (config?.timelineMode === 'retirement_and_accumulation' ? Math.max(0, (config?.retirementAge || 0) - (config?.currentAge || 0)) : 0)}`}
                          {isMonteCarlo ? '' : ` (${scrubbedYear.year})`}
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-6 text-sm">
                        <div>
                          <span className="text-blue-300 block text-xs">Portfolio Value</span>
                          <span className="font-bold text-emerald-400">{formatCurrency(scrubbedYear.realEndBalance)}</span>
                        </div>
                        <div>
                          <span className="text-blue-300 block text-xs">Available Spend</span>
                          <span className="font-bold text-emerald-400">{formatCurrency(scrubbedYear.realWithdrawal)}</span>
                        </div>
                        <div>
                          <span className="text-blue-300 block text-xs">Inflation Rate</span>
                          <span className="font-bold text-purple-300">{(scrubbedYear.inflationRate * 100).toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-blue-300 block text-xs">Cumulative Inflation</span>
                          <span className="font-bold text-pink-300">{scrubbedYear.cumulativeInflation ? `${scrubbedYear.cumulativeInflation.toFixed(2)}x` : '1.00x'}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-100 text-gray-600 p-6 rounded-2xl text-center text-sm font-bold border border-gray-200">
                      Hover chart for details / Tap and hold chart for details
                    </div>
                  )}

                  {/* Charts */}
                  <div className="space-y-8">
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">Portfolio Value Trajectory</h4>
                      <div className="h-64 w-full min-w-0 overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={selectedRun.years}
                            margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                            onMouseMove={(e: any) => { if (e && e.activePayload && e.activePayload.length) setScrubbedYear(e.activePayload[0].payload); }}
                            onMouseLeave={() => setScrubbedYear(null)}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="age" stroke="#64748b" tickFormatter={val => `Yr ${val}`} className="text-xs" />
                            <YAxis stroke="#64748b" className="text-xs" />
                            <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Portfolio Value']} />
                            <Legend />
                            <Line type="monotone" dataKey="realEndBalance" name="Real Portfolio Value" stroke={selectedRun.isSuccessful ? activePalette.surplus : activePalette.depletion} strokeWidth={3} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">Available Spend Trajectory</h4>
                      <div className="h-64 w-full min-w-0 overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={selectedRun.years}
                            margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                            onMouseMove={(e: any) => { if (e && e.activePayload && e.activePayload.length) setScrubbedYear(e.activePayload[0].payload); }}
                            onMouseLeave={() => setScrubbedYear(null)}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="age" stroke="#64748b" tickFormatter={val => `Yr ${val}`} className="text-xs" />
                            <YAxis stroke="#64748b" className="text-xs" />
                            <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Available Spend']} />
                            <Legend />
                            <Line type="monotone" dataKey="realWithdrawal" name="Real Withdrawal" stroke={activePalette.warning} strokeWidth={3} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">Cumulative Inflation Trajectory</h4>
                      <div className="h-64 w-full min-w-0 overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={selectedRun.years}
                            margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                            onMouseMove={(e: any) => { if (e && e.activePayload && e.activePayload.length) setScrubbedYear(e.activePayload[0].payload); }}
                            onMouseLeave={() => setScrubbedYear(null)}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="age" stroke="#64748b" tickFormatter={val => `Yr ${val}`} className="text-xs" />
                            <YAxis stroke="#64748b" className="text-xs" />
                            <Tooltip formatter={(val: any) => [`${Number(val).toFixed(2)}x`, 'Cumulative Inflation']} />
                            <Legend />
                            <Line type="monotone" dataKey="cumulativeInflation" name="Cumulative Inflation" stroke={activePalette.inflation} strokeWidth={3} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <div className="overflow-x-auto border border-gray-200 rounded-2xl shadow-inner">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 text-xs font-medium text-gray-600 uppercase">
                        <tr>
                          <th className="px-4 py-3 text-left">Timeline Yr (Age)</th>
                          <th className="px-4 py-3 text-left">{isMonteCarlo ? 'Simulation Yr' : 'Calendar Yr'}</th>
                          <th className="px-4 py-3 text-right">Starting Balance</th>
                          <th className="px-4 py-3 text-right">Nominal Withdrawal</th>
                          <th className="px-4 py-3 text-right">Real Withdrawal</th>
                          <th className="px-4 py-3 text-right">Inflation Rate</th>
                          <th className="px-4 py-3 text-right">Portfolio Growth</th>
                          <th className="px-4 py-3 text-right">Dividend Yield</th>
                          <th className="px-4 py-3 text-right">Fee Deduction</th>
                          <th className="px-4 py-3 text-right">Asset Breakdown (S/B/C)</th>
                          <th className="px-4 py-3 text-right">Real Ending Balance</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200 text-xs">
                        {selectedRun.years.map((yr) => (
                          <tr key={yr.year} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {config?.timelineMode === 'retirement_and_accumulation' && yr.age <= Math.max(0, (config?.retirementAge || 0) - (config?.currentAge || 0))
                                ? `Accumulation Yr ${yr.age}`
                                : `Retirement Yr ${yr.age - (config?.timelineMode === 'retirement_and_accumulation' ? Math.max(0, (config?.retirementAge || 0) - (config?.currentAge || 0)) : 0)}`}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{isMonteCarlo ? `Yr ${yr.age}` : yr.year}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(yr.startBalance)}</td>
                            <td className="px-4 py-3 text-right text-orange-600">-{formatCurrency(yr.withdrawal)}</td>
                            <td className="px-4 py-3 text-right text-red-600">-{formatCurrency(yr.realWithdrawal)}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{(yr.inflationRate * 100).toFixed(1)}%</td>
                            <td className="px-4 py-3 text-right text-green-600">{yr.portfolioGrowth >= 0 ? '+' : ''}{formatCurrency(yr.portfolioGrowth)}</td>
                            <td className="px-4 py-3 text-right text-blue-600">+{formatCurrency(yr.dividendYield || 0)}</td>
                            <td className="px-4 py-3 text-right text-red-500">-{formatCurrency(yr.feeDeduction || 0)}</td>
                            <td className="px-4 py-3 text-right text-gray-600">
                              {formatCurrency(yr.equitiesBalance || 0)} / {formatCurrency(yr.bondsBalance || 0)} / {formatCurrency(yr.cashBalance || 0)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(yr.realEndBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedRun(null)}
                className="px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
