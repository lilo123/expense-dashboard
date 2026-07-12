'use client';

import React, { useState, useMemo } from 'react';
import { getAllMarketData } from '../../../lib/marketData';
import { useSimulation } from '../../../SimulationProvider';

export function DataAssumptionsView() {
  const { config } = useSimulation();
  const [activeTab, setActiveTab] = useState<'all' | 'data' | 'methodology' | 'strategies'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [yearFilter, setYearFilter] = useState<'all' | 'post2000' | '1950-1999' | 'pre1950'>('all');

  const historicalDataRows = useMemo(() => {
    const rows = Object.values(getAllMarketData(config?.marketDataMode || 'us'));
    const filtered = rows.filter(d => {
      if (yearFilter === 'post2000') return d.year >= 2000;
      if (yearFilter === '1950-1999') return d.year >= 1950 && d.year <= 1999;
      if (yearFilter === 'pre1950') return d.year < 1950;
      return true;
    });
    return filtered.sort((a, b) => sortOrder === 'desc' ? b.year - a.year : a.year - b.year);
  }, [sortOrder, yearFilter, config?.marketDataMode]);

  return (
    <div className="space-y-8 animate-fadeIn text-gray-800">
      {/* Page Header & Navigation */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sticky top-4 z-10 backdrop-blur-md bg-white/90">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Data, Methodology & Assumptions</h2>
          <p className="text-sm text-gray-600 mt-1">
            Empirical foundations, execution order, and exact mathematical definitions for all withdrawal strategies.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 bg-gray-100 p-1.5 rounded-xl border border-gray-200">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'all' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-800 hover:text-gray-900'
            }`}
          >
            All Sections
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'data' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-800 hover:text-gray-900'
            }`}
          >
            📊 Data Sources
          </button>
          <button
            onClick={() => setActiveTab('methodology')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'methodology' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-800 hover:text-gray-900'
            }`}
          >
            ⚙️ Methodology
          </button>
          <button
            onClick={() => setActiveTab('strategies')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'strategies' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-800 hover:text-gray-900'
            }`}
          >
            🛡️ Withdrawal Strategies
          </button>
        </div>
      </div>

      {/* 1. Historical Data Sources Section */}
      {(activeTab === 'all' || activeTab === 'data') && (
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span>📊</span> Historical Market Data Sources (1871–Present)
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Evaluates long-term portfolio survivability through sequential historical backtesting across actual empirical market cycles.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-900 text-sm font-medium flex items-start gap-3">
            <span className="text-lg">🏛️</span>
            <div>
              <span className="font-bold">Primary Academic Citation:</span> All historical market data is sourced directly from Nobel Prize-winning economist <span className="font-semibold">Robert Shiller’s official academic repository at Yale University</span> (
              <a href="http://www.econ.yale.edu/~shiller/data.htm" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline hover:text-blue-900 font-bold">
                http://www.econ.yale.edu/~shiller/data.htm
              </a>
              ).
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="font-bold text-gray-900 text-base flex items-center gap-1.5">
                <span>📈</span> Stock Market Returns & Fees
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                For data from 1926 onward, dividend and earnings figures are derived from S&P 500 four-quarter totals. For periods prior to 1926, the dataset utilizes annual data from Cowles and Associates. The simulation subtracts the annual <span className="font-semibold text-gray-900">equitiesFee</span> (default 0.04%) directly from gross equity returns.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-gray-900 text-base flex items-center gap-1.5">
                <span>📜</span> Bond Market Returns & Fees
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Bond returns are based on the 10-year yields on U.S. Treasury securities within Shiller's historical dataset, capturing both interest yield and capital appreciation changes. The simulation subtracts the annual <span className="font-semibold text-gray-900">bondsFee</span> (default 0.05%) directly from gross bond returns.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-gray-900 text-base flex items-center gap-1.5">
                <span>🛒</span> Inflation & Year-End CPI Math
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Inflation calculations utilize the Consumer Price Index (CPI-U) published by the U.S. Bureau of Labor Statistics. Following FI Calc 2.0 specifications, annual inflation multipliers and cumulative purchasing power are calculated using year-end CPI data (<span className="font-semibold text-gray-900">endCpi</span>).
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-gray-900 text-base flex items-center gap-1.5">
                <span>💵</span> Cash Allocation Growth
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Cash is modeled on a High-Yield Savings Account baseline utilizing a user-defined fixed annual growth rate (<span className="font-semibold text-gray-900">cashGrowthRate</span>, default 1.5%).
              </p>
            </div>
          </div>

          {/* Bundled Dataset Attributes Table */}
          <div className="mt-6">
            <h4 className="font-bold text-gray-900 text-base mb-3">Bundled Dataset Attributes</h4>
            <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold">
                    <th className="p-4">Attribute</th>
                    <th className="p-4">Description & Simulation Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-600">
                  <tr>
                    <td className="p-4 font-mono font-bold text-blue-600 bg-gray-50/50">startCpi</td>
                    <td className="p-4">The Consumer Price Index value at the start of a simulation period.</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-mono font-bold text-blue-600 bg-gray-50/50">endCpi</td>
                    <td className="p-4">The Consumer Price Index value at the end of a simulation period. Computes the ratio <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">endCpi / startCpi</code> or year-end ratios to adjust nominal portfolio values and withdrawal amounts into real, inflation-adjusted dollars.</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-mono font-bold text-blue-600 bg-gray-50/50">cape</td>
                    <td className="p-4">The Cyclically Adjusted Price-to-Earnings ratio. Used directly when executing CAPE-based withdrawal strategies to dynamically scale withdrawal amounts up or down based on market valuation thresholds.</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-mono font-bold text-blue-600 bg-gray-50/50">dividendYields</td>
                    <td className="p-4">The annual dividend income yield generated by the stock market equity component.</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-mono font-bold text-blue-600 bg-gray-50/50">stockMarketGrowth</td>
                    <td className="p-4">The historical capital appreciation rate of the stock market index for the specific simulation interval.</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-mono font-bold text-blue-600 bg-gray-50/50">bondsGrowth</td>
                    <td className="p-4">The historical return rate of the bond asset class for the specific simulation interval.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Year-over-Year Historical Market Data Table */}
          <div className="mt-12 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Controls Header */}
            <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="font-bold text-gray-900 text-lg">Year-over-Year Historical Market Data</h4>
                <p className="text-xs text-gray-600 mt-1">Complete annual records for stocks, bonds, inflation, and valuations (1871–Present)</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {/* Era Filter */}
                <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold border border-gray-200">
                  {[
                    { label: 'All', value: 'all' },
                    { label: '2000s–Present', value: 'post2000' },
                    { label: '1950–1999', value: '1950-1999' },
                    { label: '1871–1949', value: 'pre1950' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setYearFilter(opt.value as any)}
                      className={`px-3 py-1.5 rounded-lg transition-all ${yearFilter === opt.value ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-800 hover:text-gray-900'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {/* Sort Order */}
                <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold border border-gray-200">
                  {[
                    { label: 'Reverse Chronological', value: 'desc' },
                    { label: 'Chronological', value: 'asc' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSortOrder(opt.value as any)}
                      className={`px-3 py-1.5 rounded-lg transition-all ${sortOrder === opt.value ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-800 hover:text-gray-900'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table Wrapper */}
            <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-gray-50 text-gray-700 uppercase tracking-wider text-xs sticky top-0 z-10 border-b border-gray-200 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Year</th>
                    <th className="py-3 px-4">Stock Return</th>
                    <th className="py-3 px-4">Bond Return</th>
                    <th className="py-3 px-4">Cash Return</th>
                    <th className="py-3 px-4">Inflation</th>
                    <th className="py-3 px-4">Dividend Yield</th>
                    <th className="py-3 px-4">CAPE Ratio</th>
                    <th className="py-3 px-4">CPI (Start / End)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-600">
                  {historicalDataRows.map(row => {
                    const inflation = ((row.endCpi / row.startCpi) - 1);
                    return (
                      <tr key={row.year} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-3 px-4 font-bold text-gray-900">{row.year}</td>
                        <td className={`py-3 px-4 font-semibold ${row.stockMarketGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(row.stockMarketGrowth * 100).toFixed(2)}%
                        </td>
                        <td className={`py-3 px-4 font-semibold ${row.bondsGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(row.bondsGrowth * 100).toFixed(2)}%
                        </td>
                        <td className="py-3 px-4 text-gray-600">1.50%</td>
                        <td className="py-3 px-4 text-gray-700">{(inflation * 100).toFixed(2)}%</td>
                        <td className="py-3 px-4 font-semibold text-blue-600">{(row.dividendYields * 100).toFixed(2)}%</td>
                        <td className="py-3 px-4 font-mono font-semibold text-gray-900">{row.cape.toFixed(2)}</td>
                        <td className="py-3 px-4 text-xs text-gray-600">{row.startCpi.toFixed(1)} / {row.endCpi.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* 2. Methodology & Order of Operations Section */}
      {(activeTab === 'all' || activeTab === 'methodology') && (
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span>⚙️</span> Methodology & 3-Step Order of Operations
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Chronological execution rules, supplemental cash flows, independent asset buckets, and Penner's glide path equations.
            </p>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed">
            FI Calc operates as a sequential historical backtesting engine rather than a Monte Carlo simulator. Instead of randomizing or shuffling monthly returns, it evaluates retirement plans by running them chronologically through actual historical market cycles using Robert Shiller’s multi-asset dataset. For a user-specified retirement duration <span className="font-semibold text-gray-900">D</span> (e.g., 30 years), the engine iterates through every valid historical starting year between <span className="font-semibold text-gray-900">startYearMin</span> and <span className="font-semibold text-gray-900">startYearMax</span>.
          </p>

          <div className="space-y-4">
            <h4 className="font-bold text-gray-900 text-base">Annual 3-Step Execution Cycle</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Step 1 */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 relative flex flex-col justify-between shadow-sm">
                <div className="absolute -top-3 left-6 bg-blue-600 text-white font-extrabold text-xs px-3 py-1 rounded-full shadow-sm">
                  STEP 1
                </div>
                <div>
                  <h5 className="font-bold text-gray-900 text-lg mt-2 mb-2">Jan 1st: Withdrawals & Cash Flows</h5>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    The annual withdrawal is the first event of the year. Active supplemental cash flows (<span className="font-semibold text-gray-900">additionalIncome</span> and <span className="font-semibold text-gray-900">extraWithdrawals</span>) are computed for the current age, applying the correct inflation multiplier based on <span className="font-semibold text-gray-900">inflationStart</span>. If net withdrawal is negative, the surplus income is added to the balance.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200/80 font-mono text-xs text-blue-700 bg-white p-2.5 rounded-xl border border-gray-200 overflow-x-auto shadow-inner">
                  P_post = P_start - W_base - W_extra + Income
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 relative flex flex-col justify-between shadow-sm">
                <div className="absolute -top-3 left-6 bg-blue-600 text-white font-extrabold text-xs px-3 py-1 rounded-full shadow-sm">
                  STEP 2
                </div>
                <div>
                  <h5 className="font-bold text-gray-900 text-lg mt-2 mb-2">Dec 31st: Growth, Fees & Inflation</h5>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    The current balance is broken into independent asset buckets (<span className="font-semibold text-gray-900">equitiesBalance</span>, <span className="font-semibold text-gray-900">bondsBalance</span>, <span className="font-semibold text-gray-900">cashBalance</span>) to accurately model portfolio drift when rebalancing is disabled. Fees are deducted directly from gross returns before growth.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200/80 font-mono text-xs text-blue-700 bg-white p-2.5 rounded-xl border border-gray-200 overflow-x-auto shadow-inner">
                  Inflation_Rate = (endCpi_t / endCpi_t-1) - 1
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 relative flex flex-col justify-between shadow-sm">
                <div className="absolute -top-3 left-6 bg-blue-600 text-white font-extrabold text-xs px-3 py-1 rounded-full shadow-sm">
                  STEP 3
                </div>
                <div>
                  <h5 className="font-bold text-gray-900 text-lg mt-2 mb-2">Dec 31st: Rebalancing & Penner's Equations</h5>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    The portfolio is rebalanced back to target allocation only if <span className="font-semibold text-gray-900">rebalancePortfolio !== false</span> and <span className="font-semibold text-gray-900">age % rebalanceFrequency === 0</span>. If a glide path is active, allocation shifts along Penner's easing functions (evenly, slowly, or quickly).
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200/80 font-mono text-xs text-blue-700 bg-white p-2.5 rounded-xl border border-gray-200 overflow-x-auto shadow-inner">
                  Alloc_t = Initial + (Target - Initial) * Progress
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
            <h4 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <span>🔀</span> Penner's Glide Path Equations (<span className="font-mono text-xs text-blue-600">glidePathPace</span>)
            </h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              Glide paths transition from an initial asset allocation to a target equity allocation over the glide path duration using Robert Penner's easing equations:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mt-2">
              <li className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <strong className="text-gray-900 block mb-1">Evenly (Linear)</strong>
                A linear transition function where allocation shifts by an equal percentage each year (<span className="font-mono text-xs text-blue-600">t</span>).
              </li>
              <li className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <strong className="text-gray-900 block mb-1">Slowly (Quadratic In)</strong>
                Penner's Quadratic In function (<span className="font-mono text-xs text-blue-600">t^2</span>). Allocations remain close to initial values early in retirement, accelerating change near the end.
              </li>
              <li className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <strong className="text-gray-900 block mb-1">Quickly (Quadratic Out)</strong>
                Penner's Quadratic Out function (<span className="font-mono text-xs text-blue-600">t * (2 - t)</span>). Rapid initial adjustment that decelerates as it approaches the final target.
              </li>
            </ul>
          </div>
        </section>
      )}

      {/* 3. Definitions & Formulas for 13 Withdrawal Strategies Section */}
      {(activeTab === 'all' || activeTab === 'strategies') && (
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 space-y-8">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span>🛡️</span> Definitions & Formulas for 13 Withdrawal Strategies
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Comprehensive breakdowns, rules of thumb, and exact mathematical definitions used within the Web Worker simulation engine.
            </p>
          </div>

          {/* Category 1: Basic Strategies */}
          <div className="space-y-6">
            <div className="bg-blue-50/50 border-l-4 border-blue-600 p-3 rounded-r-xl">
              <h4 className="text-lg font-bold text-blue-900">Category 1: Basic Strategies</h4>
              <p className="text-xs text-blue-700 mt-0.5">Static baseline models that adjust purely for inflation or fixed portfolio proportions.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* 1. Constant Dollar */}
              <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm hover:border-gray-300 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold">1</span>
                    Constant Dollar (The 4% Rule)
                  </h5>
                  <span className="text-xs bg-gray-100 font-semibold text-gray-600 px-2.5 py-1 rounded-lg">Basic</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  The baseline initial withdrawal amount is established via <span className="font-semibold text-gray-900">annualWithdrawal</span>. If <span className="font-semibold text-gray-900">inflationAdjustedFirstYearWithdrawal</span> is enabled, the first year withdrawal is adjusted for inflation occurring between the simulation base year and retirement start. In all subsequent years, the withdrawal is adjusted strictly for inflation.
                </p>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-xs text-blue-700 overflow-x-auto shadow-inner">
                  W_t = W_t-1 * (1 + Inflation_Rate_t)
                </div>
              </div>

              {/* 2. Percent of Portfolio */}
              <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm hover:border-gray-300 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold">2</span>
                    Percent of Portfolio
                  </h5>
                  <span className="text-xs bg-gray-100 font-semibold text-gray-600 px-2.5 py-1 rounded-lg">Basic</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  A fixed percentage (<span className="font-semibold text-gray-900">percentageOfPortfolio</span>, default 4.0%) is withdrawn from the current portfolio value each year. This eliminates premature depletion entirely but exposes the retiree to spending volatility during market downturns.
                </p>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-xs text-blue-700 overflow-x-auto shadow-inner">
                  W_t = (percentageOfPortfolio / 100) * P_t
                </div>
              </div>

              {/* 3. 1/N */}
              <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm hover:border-gray-300 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold">3</span>
                    1/N Strategy
                  </h5>
                  <span className="text-xs bg-gray-100 font-semibold text-gray-600 px-2.5 py-1 rounded-lg">Basic</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  The withdrawal is calculated as the current portfolio value minus <span className="font-semibold text-gray-900">oneOverNTargetPortfolio</span>, divided by the remaining years of retirement <span className="font-semibold text-gray-900">N</span>. Guarantees the portfolio will not be depleted below the target until the final scheduled year.
                </p>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-xs text-blue-700 overflow-x-auto shadow-inner">
                  W_t = (P_t - oneOverNTargetPortfolio) / N
                </div>
              </div>
            </div>
          </div>

          {/* Category 2: Maximize Spending Strategies */}
          <div className="space-y-6">
            <div className="bg-purple-50/50 border-l-4 border-purple-600 p-3 rounded-r-xl">
              <h4 className="text-lg font-bold text-purple-900">Category 2: Maximize Spending Strategies</h4>
              <p className="text-xs text-purple-700 mt-0.5">Actuarial and dynamic spending schedules designed to extract maximum enjoyment without leaving excessive unspent capital.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* 4. VPW */}
              <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm hover:border-gray-300 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-purple-100 text-purple-800 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold">4</span>
                    Variable Percentage Withdrawal (VPW)
                  </h5>
                  <span className="text-xs bg-purple-100 font-semibold text-purple-800 px-2.5 py-1 rounded-lg">Maximize Spending</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Developed by the Bogleheads community, VPW calculates a dynamic percentage to withdraw each year based on the current portfolio value, current age, remaining life expectancy, and expected portfolio return parameters, utilizing the true self-amortizing PMT formula. If <span className="font-semibold text-gray-900">cvpwMode</span> is enabled, it overrides expected return (<span className="font-semibold text-gray-900">cvpwRate</span>) and target end balance (<span className="font-semibold text-gray-900">cvpwTargetPortfolio</span>).
                </p>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-xs text-purple-700 overflow-x-auto shadow-inner">
                  W_t = (P_t - cvpwTargetPortfolio) * [ r / (1 - (1 + r)^-N) ]
                </div>
              </div>

              {/* 5. CVPW */}
              <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm hover:border-gray-300 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-purple-100 text-purple-800 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold">5</span>
                    Custom VPW (CVPW)
                  </h5>
                  <span className="text-xs bg-purple-100 font-semibold text-purple-800 px-2.5 py-1 rounded-lg">Maximize Spending</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Created by Bogleheads member Siamond. It functions via the true PMT formula utilizing <span className="font-semibold text-gray-900">cvpwRate</span> and <span className="font-semibold text-gray-900">cvpwTargetPortfolio</span> to establish an exact amortization schedule.
                </p>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-xs text-purple-700 overflow-x-auto shadow-inner">
                  W_t = (P_t - cvpwTargetPortfolio) * [ cvpwRate / (1 - (1 + cvpwRate)^-N) ]
                </div>
              </div>

              {/* 6. Dynamic SWR */}
              <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm hover:border-gray-300 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-purple-100 text-purple-800 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold">6</span>
                    Dynamic Safe Withdrawal Rate (Dynamic SWR)
                  </h5>
                  <span className="text-xs bg-purple-100 font-semibold text-purple-800 px-2.5 py-1 rounded-lg">Maximize Spending</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Created by James Jones (Nesteggly). It conceptualizes retirement savings as funding an inflation-adjusted annuity, utilizing Nesteggly's continuous annuitization formula based on <span className="font-semibold text-gray-900">dynamicSwrRoiAssumption</span> and <span className="font-semibold text-gray-900">dynamicSwrInflationAssumption</span>.
                </p>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-xs text-purple-700 overflow-x-auto shadow-inner">
                  Rate = (roi - inf) / [ 1 - ((1 + inf) / (1 + roi))^N ]; W_t = P_t * Rate
                </div>
              </div>
            </div>
          </div>

          {/* Category 3: Maximize Longevity & Dynamic Guardrail Strategies */}
          <div className="space-y-6">
            <div className="bg-green-50/50 border-l-4 border-green-600 p-3 rounded-r-xl">
              <h4 className="text-lg font-bold text-green-900">Category 3: Maximize Longevity & Dynamic Guardrail Strategies</h4>
              <p className="text-xs text-green-700 mt-0.5">Advanced decision rules, guardrails, and valuation-based models designed to protect the portfolio from catastrophic sequence-of-returns risk.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* 7. Guyton-Klinger */}
              <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm hover:border-gray-300 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-green-100 text-green-800 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold">7</span>
                    Guyton-Klinger (Guardrails)
                  </h5>
                  <span className="text-xs bg-green-100 font-semibold text-green-800 px-2.5 py-1 rounded-lg">Guardrails / Longevity</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Implements the authentic 3-part decision rule framework defined by Jonathan Guyton and William Klinger:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-2 pl-2">
                  <li><strong className="text-gray-900">Modified Withdrawal Rule:</strong> Freezes annual inflation adjustment if total portfolio return in the prior year was negative (<span className="font-semibold text-gray-900">gkModifiedWithdrawalRule</span>).</li>
                  <li><strong className="text-gray-900">Capital Preservation Rule:</strong> If current withdrawal rate exceeds the initial withdrawal rate by <span className="font-semibold text-gray-900">gkWithdrawalUpperLimit</span> (default 20%), cut spending by <span className="font-semibold text-gray-900">gkUpperLimitAdjustment</span> (default 10%). This cut is bypassed during the final 15 years if <span className="font-semibold text-gray-900">gkIgnoreLastFifteenYears</span> is enabled.</li>
                  <li><strong className="text-gray-900">Prosperity Rule:</strong> If current withdrawal rate falls below the initial withdrawal rate by <span className="font-semibold text-gray-900">gkWithdrawalLowerLimit</span> (default 20%), increase spending by <span className="font-semibold text-gray-900">gkLowerLimitAdjustment</span> (default 10%).</li>
                </ul>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-xs text-green-800 overflow-x-auto shadow-inner">
                  If w_t &gt; w_0 * (1 + upperLimit): W_t *= (1 - upperAdj); If w_t &lt; w_0 * (1 - lowerLimit): W_t *= (1 + lowerAdj)
                </div>
              </div>

              {/* 8. Vanguard Dynamic */}
              <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm hover:border-gray-300 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-green-100 text-green-800 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold">8</span>
                    Vanguard Dynamic Spending
                  </h5>
                  <span className="text-xs bg-green-100 font-semibold text-green-800 px-2.5 py-1 rounded-lg">Guardrails / Longevity</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Developed by Vanguard Research, this strategy bounds a percentage-of-portfolio target (<span className="font-semibold text-gray-900">vanguardDynamicSpendingWithdrawalRate</span>) within an inflation-adjusted dollar ceiling (<span className="font-semibold text-gray-900">vanguardDynamicSpendingCeiling</span>) and floor (<span className="font-semibold text-gray-900">vanguardDynamicSpendingFloor</span>).
                </p>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-xs text-green-800 overflow-x-auto shadow-inner">
                  Ceiling = W_prev * (1 + c); Floor = W_prev * (1 - f); W_t = min(Ceiling, max(Floor, r * P_t))
                </div>
              </div>

              {/* 9. Endowment */}
              <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm hover:border-gray-300 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-green-100 text-green-800 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold">9</span>
                    Endowment Strategy (Yale Endowment)
                  </h5>
                  <span className="text-xs bg-green-100 font-semibold text-green-800 px-2.5 py-1 rounded-lg">Guardrails / Longevity</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Developed by Yale University economists, it blends previous inflation-adjusted spending (<span className="font-semibold text-gray-900">endowmentPreviousWithdrawalRatio</span>, default 70%) with a percentage of the current portfolio value (<span className="font-semibold text-gray-900">endowmentPercentOfPortfolio</span>, default 30%) to achieve both budget stability and market responsiveness.
                </p>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-xs text-green-800 overflow-x-auto shadow-inner">
                  W_t = prevRatio * [ W_t-1 * (1 + Inflation_Rate_t) ] + portRatio * (r * P_t)
                </div>
              </div>

              {/* 10. Rule 95 */}
              <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm hover:border-gray-300 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-green-100 text-green-800 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold">10</span>
                    95% Rule (Rule 95)
                  </h5>
                  <span className="text-xs bg-green-100 font-semibold text-green-800 px-2.5 py-1 rounded-lg">Guardrails / Longevity</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Designed to preserve initial portfolio principal. Each year, the retiree calculates their standard Safe Withdrawal Rate amount (<span className="font-semibold text-gray-900">ninetyFiveWithdrawalRate</span>). The actual withdrawal is floored at <span className="font-semibold text-gray-900">ninetyFivePercentage</span> (default 95%) of the previous year's withdrawal, ensuring spending never drops by more than 5% in a single year.
                </p>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-xs text-green-800 overflow-x-auto shadow-inner">
                  W_t = max(P_t * ninetyFiveWithdrawalRate, ninetyFivePercentage * W_t-1)
                </div>
              </div>

              {/* 11. CAPE-Based */}
              <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm hover:border-gray-300 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-green-100 text-green-800 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold">11</span>
                    CAPE-Based Withdrawals
                  </h5>
                  <span className="text-xs bg-green-100 font-semibold text-green-800 px-2.5 py-1 rounded-lg">Guardrails / Longevity</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Adjusts annual spending based on Robert Shiller's Cyclically Adjusted Price-to-Earnings (CAPE) ratio, linking withdrawals directly to expected future market returns via the linear equation combining <span className="font-semibold text-gray-900">capeWithdrawalRate</span> and <span className="font-semibold text-gray-900">capeWeight</span>.
                </p>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-xs text-green-800 overflow-x-auto shadow-inner">
                  Rate = baseRate * (1 - weight) + (1 / CAPE) * weight; W_t = P_t * Rate
                </div>
              </div>

              {/* 12. Sensible */}
              <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm hover:border-gray-300 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-green-100 text-green-800 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold">12</span>
                    Sensible Withdrawals
                  </h5>
                  <span className="text-xs bg-green-100 font-semibold text-green-800 px-2.5 py-1 rounded-lg">Guardrails / Longevity</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Establishes a strict two-tier spending model. A fixed <span className="font-semibold text-gray-900">sensibleBaseWithdrawalRate</span> covers essential living expenses unconditionally. A second <span className="font-semibold text-gray-900">sensibleExtrasWithdrawalRate</span> is applied exclusively to the previous year's inflation-adjusted market gains. Bounded by a 7% portfolio cap guardrail.
                </p>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-xs text-green-800 overflow-x-auto shadow-inner">
                  W_t = min(W_base_inflation_adj + PriorGain * extraRate, P_t * 0.07)
                </div>
              </div>

              {/* 13. Hebeler Autopilot */}
              <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm hover:border-gray-300 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-green-100 text-green-800 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold">13</span>
                    Hebeler Autopilot (Hebeler Autopilot II)
                  </h5>
                  <span className="text-xs bg-green-100 font-semibold text-green-800 px-2.5 py-1 rounded-lg">Guardrails / Longevity</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Created by financial advisor Henry K. Hebeler. It calculates annual withdrawals by combining a weighted previous withdrawal / base inflation-adjusted withdrawal (<span className="font-semibold text-gray-900">hebelerPreviousWithdrawalRatio</span>) with a remaining-years weighted calculation (<span className="font-semibold text-gray-900">hebelerFirstYearWithdrawalRate</span>).
                </p>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-xs text-green-800 overflow-x-auto shadow-inner">
                  W_t = prevRatio * (W_t-1 * Inflation_Adj) + (1 - prevRatio) * (P_t / N)
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
