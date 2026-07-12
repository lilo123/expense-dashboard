'use client';

import React, { useState, useMemo } from 'react';
import { useSimulation } from '../../../SimulationProvider';

export function SummaryView() {
  const { result, isCalculating, config } = useSimulation();
  const isMonteCarlo = config?.simulationMode === 'monte_carlo';
  const [shareText, setShareText] = useState('➦ Save or Share');

  // Customization thresholds state
  const [volatileThreshold, setVolatileThreshold] = useState(25);
  const [largeSpendThreshold, setLargeSpendThreshold] = useState(1.5);
  const [smallSpendThreshold, setSmallSpendThreshold] = useState(0.5);
  const [largePortfolioThreshold, setLargePortfolioThreshold] = useState(2.0);
  const [smallPortfolioThreshold, setSmallPortfolioThreshold] = useState(0.5);

  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<null | 'volatile' | 'largeSpend' | 'smallSpend' | 'largePortfolio' | 'smallPortfolio'>(null);

  const customStats = useMemo(() => {
    if (!result) return null;
    let volatileCount = 0;
    let largeSpendCount = 0;
    let smallSpendCount = 0;
    let largePortfolioCount = 0;
    let smallPortfolioCount = 0;

    const volatileRuns: any[] = [];
    const largeSpendRuns: any[] = [];
    const smallSpendRuns: any[] = [];
    const largePortfolioRuns: any[] = [];
    const smallPortfolioRuns: any[] = [];

    const initialPortfolio = result.runs[0]?.years[0]?.startBalance || 1000000;

    result.runs.forEach(run => {
      const E_i = run.realEndingBalance;
      if (E_i >= largePortfolioThreshold * initialPortfolio) {
        largePortfolioCount++;
        largePortfolioRuns.push(run);
      }
      if (E_i > 0 && E_i <= smallPortfolioThreshold * initialPortfolio) {
        smallPortfolioCount++;
        smallPortfolioRuns.push(run);
      }

      let hasVolatile = false;
      let hasLarge = false;
      let hasSmall = false;
      const w_1 = run.years[0] ? run.years[0].realWithdrawal : 0;

      for (let t = 0; t < run.years.length; t++) {
        const w_it = run.years[t].realWithdrawal;
        if (w_it >= largeSpendThreshold * w_1) hasLarge = true;
        if (w_it <= smallSpendThreshold * w_1) hasSmall = true;

        if (t >= 1) {
          const w_prev = run.years[t - 1].realWithdrawal;
          const delta = w_prev === 0 ? (w_it > 0 ? Infinity : 0) : Math.abs(w_it - w_prev) / w_prev;
          if (delta > volatileThreshold / 100) hasVolatile = true;
        }
      }

      if (hasVolatile) {
        volatileCount++;
        volatileRuns.push(run);
      }
      if (hasLarge) {
        largeSpendCount++;
        largeSpendRuns.push(run);
      }
      if (hasSmall) {
        smallSpendCount++;
        smallSpendRuns.push(run);
      }
    });

    const total = result.totalRuns || 1;
    return {
      volatileCount,
      volatilePercentage: (volatileCount / total) * 100,
      largeSpendCount,
      largeSpendPercentage: (largeSpendCount / total) * 100,
      smallSpendCount,
      smallSpendPercentage: (smallSpendCount / total) * 100,
      largePortfolioCount,
      largePortfolioPercentage: (largePortfolioCount / total) * 100,
      smallPortfolioCount,
      smallPortfolioPercentage: (smallPortfolioCount / total) * 100,
      volatileRuns,
      largeSpendRuns,
      smallSpendRuns,
      largePortfolioRuns,
      smallPortfolioRuns
    };
  }, [result, volatileThreshold, largeSpendThreshold, smallSpendThreshold, largePortfolioThreshold, smallPortfolioThreshold]);

  if (!result || !customStats) {
    return (
      <div className="p-8 text-center text-gray-600 animate-pulse">
        Initializing Summary...
      </div>
    );
  }

  const { totalRuns, successfulRuns, successRate } = result;

  const handleDownloadCsv = () => {
    const headers = [isMonteCarlo ? 'Run Number' : 'Start Year', isMonteCarlo ? 'End Year' : 'End Year', 'Status', 'Nominal Ending Balance', 'Real Ending Balance', 'Average Stocks Return', 'Average Real Withdrawal'];
    const rows = result.runs.map(r => [
      isMonteCarlo ? `Run #${r.startYear}` : r.startYear,
      isMonteCarlo ? 'N/A' : r.endYear,
      r.isSuccessful ? 'Success' : 'Depleted',
      r.endingBalance.toFixed(2),
      r.realEndingBalance.toFixed(2),
      r.avgStocksReturn.toFixed(4),
      r.avgRealWithdrawal.toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'simulation_results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareText('✅ Copied to Clipboard!');
      setTimeout(() => setShareText('➦ Save or Share'), 3000);
    } catch (err) {
      alert(`Could not copy to clipboard: ${window.location.href}`);
    }
  };

  const filteredRunsList = selectedFilter === 'volatile' ? customStats.volatileRuns :
                           selectedFilter === 'largeSpend' ? customStats.largeSpendRuns :
                           selectedFilter === 'smallSpend' ? customStats.smallSpendRuns :
                           selectedFilter === 'largePortfolio' ? customStats.largePortfolioRuns :
                           selectedFilter === 'smallPortfolio' ? customStats.smallPortfolioRuns : [];

  return (
    <div className={`space-y-6 transition-opacity duration-200 ${isCalculating ? 'opacity-100' : 'opacity-100'}`}>
      {/* Header & Actions */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Results</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDownloadCsv}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-sm rounded-xl transition-colors flex items-center gap-2"
          >
            <span>↓</span> Download as CSV
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white font-semibold text-sm rounded-xl transition-colors flex items-center gap-2"
          >
            {shareText}
          </button>
        </div>
      </div>

      {/* Inflation Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-900 flex items-center justify-between text-sm font-medium">
        <span>ℹ️ All displayed values are inflation-adjusted (real dollars).</span>
        <span className="cursor-pointer text-blue-800 hover:underline" title="Values are adjusted to real base-year dollars using historical Consumer Price Index (CPI) data.">(?)</span>
      </div>

      {/* Hero Success Rate Banner */}
      <div className="bg-green-50 border border-green-200 p-8 rounded-3xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="text-2xl">✅</span>
            <h3 className="text-xl font-bold text-green-900">Success Rate</h3>
            <span className="text-green-800 cursor-pointer hover:text-green-900" title="Percentage of simulations where the portfolio did not run out of money before the end of the retirement duration.">(?)</span>
          </div>
          <p className="text-5xl font-black text-green-800">{successRate.toFixed(1)}%</p>
          <p className="text-sm text-green-800 font-medium">{successfulRuns} out of {totalRuns} retirement simulations succeeded.</p>
        </div>
        {/* Visual Progress Gauge */}
        <div className="w-full md:w-1/2 bg-green-200/60 rounded-full h-8 overflow-hidden border border-green-300 p-1">
          <div className="bg-green-600 h-full rounded-full transition-all duration-500" style={{ width: `${successRate}%` }}></div>
        </div>
      </div>

      {/* 5 Secondary Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Volatile Spending */}
        <div
          onClick={() => setSelectedFilter(selectedFilter === 'volatile' ? null : 'volatile')}
          className={`bg-white p-6 rounded-2xl shadow-sm border cursor-pointer transition-all flex flex-col justify-between ${selectedFilter === 'volatile' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}
        >
          <div className="flex justify-between items-start">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>🎢</span> Volatile Spending
            </h3>
            <span className="text-gray-700 hover:text-gray-900" title="Runs where year-over-year change in spending exceeds threshold.">(?)</span>
          </div>
          <p className="text-4xl font-extrabold text-yellow-700 my-4">{customStats.volatilePercentage.toFixed(1)}%</p>
          <div className="flex justify-between items-center text-xs text-gray-700">
            <span>{customStats.volatileCount} out of {totalRuns} runs.</span>
            <button
              onClick={(e) => { e.stopPropagation(); setIsCustomizeOpen(true); }}
              className="text-blue-700 hover:underline font-semibold"
            >
              Customize
            </button>
          </div>
        </div>

        {/* Large Spending */}
        <div
          onClick={() => setSelectedFilter(selectedFilter === 'largeSpend' ? null : 'largeSpend')}
          className={`bg-white p-6 rounded-2xl shadow-sm border cursor-pointer transition-all flex flex-col justify-between ${selectedFilter === 'largeSpend' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}
        >
          <div className="flex justify-between items-start">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>💎</span> Large Spending
            </h3>
            <span className="text-gray-700 hover:text-gray-900" title="Runs where spending is >= threshold * year 1 spending.">(?)</span>
          </div>
          <p className="text-4xl font-extrabold text-blue-700 my-4">{customStats.largeSpendPercentage.toFixed(1)}%</p>
          <div className="flex justify-between items-center text-xs text-gray-700">
            <span>{customStats.largeSpendCount} out of {totalRuns} runs.</span>
            <button
              onClick={(e) => { e.stopPropagation(); setIsCustomizeOpen(true); }}
              className="text-blue-700 hover:underline font-semibold"
            >
              Customize
            </button>
          </div>
        </div>

        {/* Small Spending */}
        <div
          onClick={() => setSelectedFilter(selectedFilter === 'smallSpend' ? null : 'smallSpend')}
          className={`bg-white p-6 rounded-2xl shadow-sm border cursor-pointer transition-all flex flex-col justify-between ${selectedFilter === 'smallSpend' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}
        >
          <div className="flex justify-between items-start">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>🥜</span> Small Spending
            </h3>
            <span className="text-gray-700 hover:text-gray-900" title="Runs where spending is <= threshold * year 1 spending.">(?)</span>
          </div>
          <p className="text-4xl font-extrabold text-orange-700 my-4">{customStats.smallSpendPercentage.toFixed(1)}%</p>
          <div className="flex justify-between items-center text-xs text-gray-700">
            <span>{customStats.smallSpendCount} out of {totalRuns} runs.</span>
            <button
              onClick={(e) => { e.stopPropagation(); setIsCustomizeOpen(true); }}
              className="text-blue-700 hover:underline font-semibold"
            >
              Customize
            </button>
          </div>
        </div>

        {/* Large End Portfolio Value */}
        <div
          onClick={() => setSelectedFilter(selectedFilter === 'largePortfolio' ? null : 'largePortfolio')}
          className={`bg-white p-6 rounded-2xl shadow-sm border cursor-pointer transition-all flex flex-col justify-between ${selectedFilter === 'largePortfolio' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}
        >
          <div className="flex justify-between items-start">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>💰</span> Large End Portfolio
            </h3>
            <span className="text-gray-700 hover:text-gray-900" title="Runs where ending portfolio is >= threshold * initial portfolio.">(?)</span>
          </div>
          <p className="text-4xl font-extrabold text-purple-700 my-4">{customStats.largePortfolioPercentage.toFixed(1)}%</p>
          <div className="flex justify-between items-center text-xs text-gray-700">
            <span>{customStats.largePortfolioCount} out of {totalRuns} runs.</span>
            <button
              onClick={(e) => { e.stopPropagation(); setIsCustomizeOpen(true); }}
              className="text-blue-700 hover:underline font-semibold"
            >
              Customize
            </button>
          </div>
        </div>

        {/* Small End Portfolio Value */}
        <div
          onClick={() => setSelectedFilter(selectedFilter === 'smallPortfolio' ? null : 'smallPortfolio')}
          className={`bg-white p-6 rounded-2xl shadow-sm border cursor-pointer transition-all flex flex-col justify-between ${selectedFilter === 'smallPortfolio' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}
        >
          <div className="flex justify-between items-start">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>😨</span> Small End Portfolio
            </h3>
            <span className="text-gray-700 hover:text-gray-900" title="Runs where ending portfolio is nonzero and <= threshold * initial portfolio.">(?)</span>
          </div>
          <p className="text-4xl font-extrabold text-red-700 my-4">{customStats.smallPortfolioPercentage.toFixed(1)}%</p>
          <div className="flex justify-between items-center text-xs text-gray-700">
            <span>{customStats.smallPortfolioCount} out of {totalRuns} runs.</span>
            <button
              onClick={(e) => { e.stopPropagation(); setIsCustomizeOpen(true); }}
              className="text-blue-700 hover:underline font-semibold"
            >
              Customize
            </button>
          </div>
        </div>
      </div>

      {/* Filtered Runs Section */}
      {selectedFilter && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-200 space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <h3 className="text-lg font-bold text-gray-900">
              Filtered Runs: {selectedFilter === 'volatile' ? 'Volatile Spending' : selectedFilter === 'largeSpend' ? 'Large Spending' : selectedFilter === 'smallSpend' ? 'Small Spending' : selectedFilter === 'largePortfolio' ? 'Large End Portfolio' : 'Small End Portfolio'} ({filteredRunsList.length})
            </h3>
            <button onClick={() => setSelectedFilter(null)} className="text-gray-700 hover:text-gray-900 font-bold text-sm">✕ Clear Filter</button>
          </div>
          <div className="overflow-x-auto max-h-80 border border-gray-200 rounded-xl shadow-inner">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">{isMonteCarlo ? 'Run Number' : 'Start Year'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Real Ending Balance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRunsList.map((run: any) => (
                  <tr key={run.startYear} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{isMonteCarlo ? `Run #${run.startYear}` : `${run.startYear}–${run.endYear}`}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {run.isSuccessful ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Success</span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Depleted</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                      ${run.realEndingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customization Modal */}
      {isCustomizeOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold text-gray-900">Customize Thresholds</h3>
              <button onClick={() => setIsCustomizeOpen(false)} className="text-gray-700 hover:text-gray-900 font-bold text-xl">✕</button>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <label htmlFor="summaryVolatileThreshold" className="block font-medium text-gray-700 mb-1">Volatile Spending YoY Change ({volatileThreshold}%)</label>
                <input
                  id="summaryVolatileThreshold"
                  type="range" min="5" max="50" step="5" value={volatileThreshold}
                  onChange={(e) => setVolatileThreshold(parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
              <div>
                <label htmlFor="summaryLargeSpendThreshold" className="block font-medium text-gray-700 mb-1">Large Spending Multiplier ({largeSpendThreshold}x Year 1)</label>
                <input
                  id="summaryLargeSpendThreshold"
                  type="range" min="1.1" max="3.0" step="0.1" value={largeSpendThreshold}
                  onChange={(e) => setLargeSpendThreshold(parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
              <div>
                <label htmlFor="summarySmallSpendThreshold" className="block font-medium text-gray-700 mb-1">Small Spending Multiplier ({smallSpendThreshold}x Year 1)</label>
                <input
                  id="summarySmallSpendThreshold"
                  type="range" min="0.1" max="0.9" step="0.1" value={smallSpendThreshold}
                  onChange={(e) => setSmallSpendThreshold(parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
              <div>
                <label htmlFor="summaryLargePortfolioThreshold" className="block font-medium text-gray-700 mb-1">Large End Portfolio Multiplier ({largePortfolioThreshold}x Initial)</label>
                <input
                  id="summaryLargePortfolioThreshold"
                  type="range" min="1.0" max="5.0" step="0.5" value={largePortfolioThreshold}
                  onChange={(e) => setLargePortfolioThreshold(parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
              <div>
                <label htmlFor="summarySmallPortfolioThreshold" className="block font-medium text-gray-700 mb-1">Small End Portfolio Multiplier ({smallPortfolioThreshold}x Initial)</label>
                <input
                  id="summarySmallPortfolioThreshold"
                  type="range" min="0.1" max="0.9" step="0.1" value={smallPortfolioThreshold}
                  onChange={(e) => setSmallPortfolioThreshold(parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                onClick={() => setIsCustomizeOpen(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors"
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
