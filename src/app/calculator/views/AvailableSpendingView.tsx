'use client';

import React, { useState, useMemo } from 'react';
import { useSimulation } from '../../../SimulationProvider';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
  LineChart,
  Line,
  Legend,
  ReferenceDot
} from 'recharts';
import { SimulationRunResult } from '../../../types/simulation';

const CustomSpendingTooltip = ({ active, payload, isMonteCarlo }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-900 text-white p-4 rounded-xl shadow-lg border border-gray-800 text-xs space-y-2 max-w-xs">
        <p className="font-bold border-b border-gray-700 pb-1">{`Bin: ${data.name}`}</p>
        <p className="font-semibold text-emerald-400">{`Years Count: ${data.count} (${data.percentage.toFixed(1)}% of total simulation years)`}</p>
        <p className="text-gray-400 leading-relaxed">
          {isMonteCarlo 
            ? `Runs: ${data.cohorts.slice(0, 10).join(', ')}${data.cohorts.length > 10 ? ` (+${data.cohorts.length - 10} more)` : ''}`
            : `Cohorts: ${data.cohorts.join(', ')}`}
        </p>
      </div>
    );
  }
  return null;
};

export function AvailableSpendingView() {
  const { result, isCalculating, config } = useSimulation();
  const isMonteCarlo = config?.simulationMode === 'monte_carlo';
  const [activeView, setActiveView] = useState<'histogram' | 'table'>('histogram');
  const [stdDevMode, setStdDevMode] = useState<'allYears' | 'runAverages'>('allYears');
  const [currencyMode, setCurrencyMode] = useState<'real' | 'nominal'>('real');
  const [selectedRun, setSelectedRun] = useState<SimulationRunResult | null>(null);

  // Range selection state
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [filteredRange, setFilteredRange] = useState<{ min: number; max: number } | null>(null);

  // Customize thresholds state
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [volatileThreshold, setVolatileThreshold] = useState(25);
  const [largeThreshold, setLargeThreshold] = useState(1.5);
  const [smallThreshold, setSmallThreshold] = useState(0.5);

  const stats = useMemo(() => {
    if (!result || result.runs.length === 0) {
      return {
        median: 0,
        average: 0,
        largest: 0,
        smallest: 0,
        values: [] as any[],
        bins: [] as any[],
        volatileCount: 0,
        largeCount: 0,
        smallCount: 0,
      };
    }

    const accumulationYears = config?.timelineMode === 'retirement_and_accumulation'
      ? Math.max(0, (config?.retirementAge || 0) - (config?.currentAge || 0))
      : 0;

    const allSpendings: number[] = [];
    const values: any[] = [];
    let largest = -Infinity;
    let smallest = Infinity;
    let totalSpend = 0;
    let volatileCount = 0;
    let largeCount = 0;
    let smallCount = 0;

    result.runs.forEach(r => {
      let rMin = Infinity;
      let rMax = -Infinity;
      let rTotal = 0;
      let hasVolatile = false;
      let hasLarge = false;
      let hasSmall = false;

      const retirementYears = r.years.slice(accumulationYears);
      const w_1 = retirementYears[0] ? (currencyMode === 'real' ? retirementYears[0].realWithdrawal : retirementYears[0].withdrawal) : 0;

      retirementYears.forEach((y, idx) => {
        const w = currencyMode === 'real' ? y.realWithdrawal : y.withdrawal;
        allSpendings.push(w);
        if (w > largest) largest = w;
        if (w < smallest) smallest = w;
        if (w > rMax) rMax = w;
        if (w < rMin) rMin = w;
        rTotal += w;
        totalSpend += w;

        if (w_1 > 0) {
          if (w >= largeThreshold * w_1) hasLarge = true;
          if (w <= smallThreshold * w_1) hasSmall = true;
        }

        if (idx >= 1) {
          const w_prev = currencyMode === 'real' ? retirementYears[idx - 1].realWithdrawal : retirementYears[idx - 1].withdrawal;
          let delta = 0;
          if (w_prev === 0) {
            if (w > 0) delta = Infinity;
          } else {
            delta = Math.abs(w - w_prev) / w_prev;
          }
          if (delta > volatileThreshold / 100) hasVolatile = true;
        }
      });

      if (hasVolatile) volatileCount++;
      if (hasLarge) largeCount++;
      if (hasSmall) smallCount++;

      const numY = retirementYears.length > 0 ? retirementYears.length : 1;
      values.push({
        startYear: r.startYear,
        minSpend: rMin === Infinity ? 0 : rMin,
        maxSpend: rMax === -Infinity ? 0 : rMax,
        avgSpend: rTotal / numY,
        hasVolatile,
        hasLarge,
        hasSmall,
        run: r
      });
    });

    const M = allSpendings.length;
    const average = M > 0 ? totalSpend / M : 0;
    
    const sorted = [...allSpendings].sort((a, b) => a - b);
    let median = 0;
    if (M > 0) {
      const mid = Math.floor(M / 2);
      median = M % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    if (largest === -Infinity) largest = 0;
    if (smallest === Infinity) smallest = 0;

    // Build histogram bins for spending
    if (currencyMode === 'real' && result.defaultSpendingBins && result.defaultSpendingBins.length > 0) {
      const bins = result.defaultSpendingBins.map(b => ({
        name: b.label,
        count: b.count,
        min: b.binMin,
        max: b.binMax,
        cohorts: b.startYears,
        percentage: M > 0 ? (b.count / M) * 100 : 0
      }));
      return { median, average, largest, smallest, values, bins, volatileCount, largeCount, smallCount };
    }

    const numBins = 12;
    const cleanMin = Math.floor(Math.max(0, smallest) / 5000) * 5000;
    const range = Math.max(5000, largest - cleanMin);
    const rawStep = Math.ceil(range / numBins);
    const binSize = Math.max(5000, Math.ceil(rawStep / 5000) * 5000);
    const bins: any[] = [];

    const formatK = (v: number) => {
      const inK = v / 1000;
      return Number.isInteger(inK) ? `$${inK}K` : `$${inK.toFixed(1)}K`;
    };

    for (let i = 0; i < numBins; i++) {
      const min = cleanMin + i * binSize;
      const max = cleanMin + (i + 1) * binSize;
      bins.push({
        name: `${formatK(min)} - ${formatK(max)}`,
        count: 0,
        min,
        max,
        cohorts: [] as number[],
        percentage: 0
      });
    }

    result.runs.forEach(r => {
      r.years.slice(accumulationYears).forEach(y => {
        const w = currencyMode === 'real' ? y.realWithdrawal : y.withdrawal;
        let binIdx = Math.floor((w - cleanMin) / binSize);
        if (Number.isNaN(binIdx) || binIdx < 0) binIdx = 0;
        if (binIdx >= numBins) binIdx = numBins - 1;
        const b = bins[binIdx];
        if (b) {
          b.count++;
          if (!b.cohorts.includes(r.startYear)) {
            b.cohorts.push(r.startYear);
          }
        }
      });
    });

    bins.forEach(b => {
      b.percentage = M > 0 ? (b.count / M) * 100 : 0;
    });

    return { median, average, largest, smallest, values, bins, volatileCount, largeCount, smallCount };
  }, [result, config, currencyMode, volatileThreshold, largeThreshold, smallThreshold]);

  const handleMouseDown = (e: any) => {
    if (e && e.activeLabel) {
      setRefAreaLeft(e.activeLabel);
    }
  };

  const handleMouseMove = (e: any) => {
    if (refAreaLeft && e && e.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  };

  const handleMouseUp = () => {
    if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
      const bin1 = stats.bins.find(b => b.name === refAreaLeft);
      const bin2 = stats.bins.find(b => b.name === refAreaRight);
      if (bin1 && bin2) {
        const min = Math.min(bin1.min, bin2.min);
        const max = Math.max(bin1.max, bin2.max);
        setFilteredRange({ min, max });
      }
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const displayedTableValues = useMemo(() => {
    if (!filteredRange) return stats.values;
    return stats.values.filter(v => v.avgSpend >= filteredRange.min && v.avgSpend <= filteredRange.max);
  }, [stats.values, filteredRange]);

  if (!result) {
    return (
      <div className="p-8 text-center text-gray-600 animate-pulse font-medium">
        Loading available spending visualizer...
      </div>
    );
  }

  const stdDevValue = stdDevMode === 'allYears' ? result.stdDevAllYearsSpending : result.stdDevRunAverageSpending;

  return (
    <div className={`space-y-6 transition-opacity duration-300 ${isCalculating ? 'opacity-100' : 'opacity-100'}`}>
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-2xl font-black text-gray-900">Available Spending</h2>
            <div className="flex bg-gray-200 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setCurrencyMode('real')}
                className={`px-3 py-1.5 rounded-lg transition-all ${currencyMode === 'real' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-800 hover:text-gray-900'}`}
              >
                Real Dollars
              </button>
              <button
                onClick={() => setCurrencyMode('nominal')}
                className={`px-3 py-1.5 rounded-lg transition-all ${currencyMode === 'nominal' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-800 hover:text-gray-900'}`}
              >
                Nominal
              </button>
            </div>
          </div>
          <div className="flex bg-gray-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveView('histogram')}
              className={`px-5 py-2 rounded-xl font-bold text-sm transition-all ${activeView === 'histogram' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-800 hover:text-gray-900'}`}
            >
              📊 Histogram
            </button>
            <button
              onClick={() => setActiveView('table')}
              className={`px-5 py-2 rounded-xl font-bold text-sm transition-all ${activeView === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-800 hover:text-gray-900'}`}
            >
              ≡ Table
            </button>
          </div>
        </div>

        {/* Customize Panel */}
        {isCustomizeOpen && (
          <div className="p-6 bg-gray-50 border-b border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm animate-in fade-in duration-200">
            <div>
              <label htmlFor="spendingVolatileThreshold" className="block font-bold text-gray-700 mb-1">Volatile Spending Limit (%)</label>
              <input id="spendingVolatileThreshold" type="number" value={volatileThreshold} onChange={e => setVolatileThreshold(Number(e.target.value))} className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium shadow-sm" />
            </div>
            <div>
              <label htmlFor="spendingLargeThreshold" className="block font-bold text-gray-700 mb-1">Large Spending Multiplier</label>
              <input id="spendingLargeThreshold" type="number" step="0.1" value={largeThreshold} onChange={e => setLargeThreshold(Number(e.target.value))} className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium shadow-sm" />
            </div>
            <div>
              <label htmlFor="spendingSmallThreshold" className="block font-bold text-gray-700 mb-1">Small Spending Multiplier</label>
              <input id="spendingSmallThreshold" type="number" step="0.1" value={smallThreshold} onChange={e => setSmallThreshold(Number(e.target.value))} className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium shadow-sm" />
            </div>
          </div>
        )}

        {/* Stat Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 border-b border-gray-100 bg-white">
          <div className="p-6 sm:p-8 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="text-sm font-bold text-gray-600">Median</span>
              <span className="text-lg font-black text-gray-900">${stats.median.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="text-sm font-bold text-gray-600">Average</span>
              <span className="text-lg font-black text-gray-900">${stats.average.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-600">Standard Deviation</span>
                <div className="flex bg-gray-100 p-1 rounded-lg text-xs font-bold">
                  <button
                    onClick={() => setStdDevMode('allYears')}
                    className={`px-2 py-1 rounded-md transition-all ${stdDevMode === 'allYears' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-800 hover:text-gray-900'}`}
                  >
                    All Years
                  </button>
                  <button
                    onClick={() => setStdDevMode('runAverages')}
                    className={`px-2 py-1 rounded-md transition-all ${stdDevMode === 'runAverages' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-800 hover:text-gray-900'}`}
                  >
                    Run Averages
                  </button>
                </div>
              </div>
              <span className="text-lg font-black text-gray-900">${stdDevValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="text-sm font-bold text-gray-600">Largest</span>
              <span className="text-lg font-black text-gray-900">${stats.largest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="text-sm font-bold text-gray-600">Smallest</span>
              <span className="text-lg font-black text-gray-900">${stats.smallest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-600">Average Lifetime Spend</span>
              <span className="text-lg font-black text-indigo-600">${result.averageLifetimeSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-4 bg-gray-50/30 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-gray-700 flex items-center gap-1"><span>⚠️</span> Volatile Spending (&gt;{volatileThreshold}%)</span>
                  <div className="relative group inline-block ml-1 cursor-help" onClick={(e) => e.stopPropagation()}>
                    <span className="text-gray-400 hover:text-blue-600 font-normal text-xs transition-colors" title="Runs where the year-over-year change (increase or decrease) in real spending exceeds the configured limit.">(?)</span>
                    <div role="tooltip" className="pointer-events-none hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-gray-900 text-white text-xs font-normal leading-relaxed rounded-xl shadow-lg border border-gray-700 z-[100] transition-opacity duration-200 text-left">
                      Runs where the year-over-year change (increase or decrease) in real spending exceeds the configured volatile spending limit threshold (&gt;{volatileThreshold}%).
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                    </div>
                  </div>
                </div>
                <span className="font-bold text-yellow-900">{stats.volatileCount} cohorts</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-gray-700 flex items-center gap-1"><span>📈</span> Large Spending (&gt;={largeThreshold}x)</span>
                  <div className="relative group inline-block ml-1 cursor-help" onClick={(e) => e.stopPropagation()}>
                    <span className="text-gray-400 hover:text-blue-600 font-normal text-xs transition-colors" title="Runs where annual retirement spending reaches or exceeds the configured multiplier relative to year 1 initial spending.">(?)</span>
                    <div role="tooltip" className="pointer-events-none hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-gray-900 text-white text-xs font-normal leading-relaxed rounded-xl shadow-lg border border-gray-700 z-[100] transition-opacity duration-200 text-left">
                      Runs where annual retirement spending reaches or exceeds the configured multiplier threshold (&ge;{largeThreshold}x) relative to your year 1 initial retirement withdrawal.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                    </div>
                  </div>
                </div>
                <span className="font-bold text-blue-800">{stats.largeCount} cohorts</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-gray-700 flex items-center gap-1"><span>📉</span> Small Spending (&lt;={smallThreshold}x)</span>
                  <div className="relative group inline-block ml-1 cursor-help" onClick={(e) => e.stopPropagation()}>
                    <span className="text-gray-400 hover:text-blue-600 font-normal text-xs transition-colors" title="Runs where annual retirement spending falls to or below the configured multiplier relative to year 1 initial spending.">(?)</span>
                    <div role="tooltip" className="pointer-events-none hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-gray-900 text-white text-xs font-normal leading-relaxed rounded-xl shadow-lg border border-gray-700 z-[100] transition-opacity duration-200 text-left">
                      Runs where annual retirement spending falls to or below the configured multiplier threshold (&le;{smallThreshold}x) relative to your year 1 initial retirement withdrawal.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                    </div>
                  </div>
                </div>
                <span className="font-bold text-orange-900">{stats.smallCount} cohorts</span>
              </div>
            </div>
            <button
              onClick={() => setIsCustomizeOpen(!isCustomizeOpen)}
              className="w-full py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-bold text-xs rounded-xl shadow-sm transition-all mt-4"
            >
              {isCustomizeOpen ? 'Close Threshold Settings' : 'Customize Thresholds'}
            </button>
          </div>
        </div>

        {/* View Section */}
        <div className="p-6 sm:p-8">
          {activeView === 'histogram' ? (
            <div className="space-y-4">
              <p className="text-xs text-center font-bold text-gray-600">
                Hover chart for details. Click and drag to select a range.
              </p>
              <div className="h-96 w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.bins}
                    margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" />
                    <XAxis dataKey="name" stroke="#718096" fontSize={11} angle={-20} textAnchor="end" interval="preserveStartEnd" />
                    <YAxis stroke="#718096" fontSize={12} />
                    <Tooltip content={<CustomSpendingTooltip isMonteCarlo={isMonteCarlo} />} />
                    <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} />
                    {refAreaLeft && refAreaRight && (
                      <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#3b82f6" fillOpacity={0.2} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRange && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-4 rounded-2xl text-sm text-blue-900 font-medium">
                  <span>Showing cohorts with average spend between ${filteredRange.min.toLocaleString()} and ${filteredRange.max.toLocaleString()}</span>
                  <button onClick={() => setFilteredRange(null)} className="text-blue-800 hover:underline font-bold">✕ Clear Filter</button>
                </div>
              )}
              <div className="overflow-x-auto max-h-96 border border-gray-100 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider text-xs sticky top-0 z-10 border-b border-gray-100">
                    <tr>
                      <th className="py-3 px-6 font-bold">{isMonteCarlo ? 'Run Number' : 'Start Year'}</th>
                      <th className="py-3 px-6 font-bold">Badges</th>
                      <th className="py-3 px-6 font-bold">Min Annual Spend</th>
                      <th className="py-3 px-6 font-bold">Max Annual Spend</th>
                      <th className="py-3 px-6 font-bold">Average Annual Spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {displayedTableValues.map(v => (
                      <tr key={v.startYear} onClick={() => setSelectedRun(v.run)} className="hover:bg-blue-50/50 cursor-pointer transition-colors">
                        <td className="py-4 px-6 font-bold text-gray-900">{isMonteCarlo ? `Run #${v.startYear}` : `${v.startYear} Cohort`}</td>
                        <td className="py-4 px-6 flex gap-1 text-base">
                          {v.hasVolatile && <span title="Volatile Spending">⚠️</span>}
                          {v.hasLarge && <span title="Large Spending">📈</span>}
                          {v.hasSmall && <span title="Small Spending">📉</span>}
                        </td>
                        <td className="py-4 px-6 font-semibold text-red-800">${v.minSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-4 px-6 font-semibold text-green-800">${v.maxSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-4 px-6 font-bold text-gray-900">${v.avgSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal for detailed spending trajectory */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{isMonteCarlo ? `Spending Trajectory: Run #${selectedRun.startYear}` : `Spending Trajectory: Cohort ${selectedRun.startYear}–${selectedRun.endYear}`}</h3>
                <p className="text-xs text-gray-600 mt-1">Tracking annual withdrawals ({currencyMode === 'real' ? 'Real Dollars' : 'Nominal Dollars'})</p>
              </div>
              <button onClick={() => setSelectedRun(null)} className="text-gray-700 hover:text-gray-900 font-bold text-2xl p-2">✕</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="h-80 w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={selectedRun.years.map(y => ({
                      age: `Yr ${y.age}`,
                      spend: currencyMode === 'real' ? y.realWithdrawal : y.withdrawal,
                      isZero: y.endBalance <= 0
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="age" stroke="#64748b" className="text-xs" />
                    <YAxis stroke="#64748b" className="text-xs" />
                    <Tooltip formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Withdrawal']} />
                    <Legend />
                    <Line type="monotone" dataKey="spend" name="Annual Spend" stroke="#10b981" strokeWidth={3} dot={false} />
                    {selectedRun.years.map((y, idx) => y.endBalance <= 0 && (
                      <ReferenceDot
                        key={`dot-${idx}`}
                        x={`Yr ${y.age}`}
                        y={currencyMode === 'real' ? y.realWithdrawal : y.withdrawal}
                        r={6}
                        fill="#ef4444"
                        stroke="white"
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-900 text-xs flex items-center gap-3">
                <span className="text-lg">ℹ️</span>
                <span>Red dots on the chart indicate years where the portfolio reached $0 and spending relied entirely on external income sources or hit minimum withdrawal guardrails.</span>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button onClick={() => setSelectedRun(null)} className="px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm rounded-xl transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
