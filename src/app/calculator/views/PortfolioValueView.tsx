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
  Cell,
  Brush
} from 'recharts';

const CustomTooltip = ({ active, payload, isMonteCarlo }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const formatCurr = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
    return (
      <div className="bg-gray-900 text-white p-4 rounded-xl shadow-lg border border-gray-800 text-xs space-y-2 max-w-xs">
        <p className="font-bold border-b border-gray-700 pb-1">{`Range: ${formatCurr(data.binMin)} – ${formatCurr(data.binMax)}`}</p>
        <p className="font-semibold text-blue-400">{`Count: ${data.count} simulations (${data.percentage.toFixed(1)}%)`}</p>
        <p className="text-gray-400 leading-relaxed">
          {isMonteCarlo 
            ? `Runs: ${data.startYears.slice(0, 10).join(', ')}${data.startYears.length > 10 ? ` (+${data.startYears.length - 10} more)` : ''}`
            : `Start Years: ${data.startYears.join(', ')}`}
        </p>
      </div>
    );
  }
  return null;
};

export function PortfolioValueView() {
  const { result, config, isCalculating } = useSimulation();
  const isMonteCarlo = config?.simulationMode === 'monte_carlo';
  const [selectedYearOption, setSelectedYearOption] = useState<string>('final');
  const [viewMode, setViewMode] = useState<'histogram' | 'table'>('histogram');
  const [activeDomainRange, setActiveDomainRange] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const brushTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setActiveDomainRange({ min: null, max: null });
  }, [selectedYearOption]);

  React.useEffect(() => {
    return () => {
      if (brushTimeoutRef.current) clearTimeout(brushTimeoutRef.current);
    };
  }, []);

  const baseStatsAndOverview = useMemo(() => {
    if (!result || !result.runs.length) {
      return {
        median: 0,
        average: 0,
        stdDev: 0,
        largest: 0,
        smallest: 0,
        zeroCount: 0,
        zeroPercentage: 0,
        overviewData: [] as any[],
        histogramData: [] as any[],
        tableData: []
      };
    }

    const values: number[] = [];
    const tableData: { startYear: number; value: number; status: string }[] = [];

    result.runs.forEach(run => {
      let val = run.realEndingBalance;
      if (selectedYearOption !== 'final') {
        const accumulationYears = config?.timelineMode === 'retirement_and_accumulation'
          ? Math.max(0, (config?.retirementAge || 0) - (config?.currentAge || 0))
          : 0;
        const yrIdx = accumulationYears + Number(selectedYearOption) - 1;
        const yr = run.years[yrIdx];
        val = yr ? yr.realEndBalance : run.realEndingBalance;
      }
      values.push(val);
      tableData.push({
        startYear: run.startYear,
        value: val,
        status: run.isSuccessful ? 'Success' : 'Depleted'
      });
    });

    values.sort((a, b) => a - b);
    const total = values.length;
    const sum = values.reduce((acc, v) => acc + v, 0);
    const average = total > 0 ? sum / total : 0;
    const median = total > 0 ? (total % 2 !== 0 ? values[Math.floor(total / 2)] : (values[total / 2 - 1] + values[total / 2]) / 2) : 0;
    const smallest = values[0] || 0;
    const largest = values[total - 1] || 0;

    let zeroCount = 0;
    values.forEach(v => { if (v <= 0) zeroCount++; });
    const zeroPercentage = total > 0 ? (zeroCount / total) * 100 : 0;

    let sqSum = 0;
    values.forEach(v => { sqSum += Math.pow(v - average, 2); });
    const stdDev = total > 1 ? Math.sqrt(sqSum / (total - 1)) : 0;

    const formatPortfolioBinLabel = (v: number) => {
      if (v === 0) return '$0';
      if (v >= 1000000) {
        const inM = v / 1000000;
        return Number.isInteger(inM) ? `$${inM}M` : `$${inM.toFixed(2).replace(/\.?0+$/, '')}M`;
      }
      if (v >= 1000) {
        const inK = v / 1000;
        return Number.isInteger(inK) ? `$${inK}K` : `$${inK.toFixed(1).replace(/\.?0+$/, '')}K`;
      }
      return `$${Math.round(v)}`;
    };

    const buildBins = (minBound: number, maxBound: number, binCount = 20) => {
      const rawBinSize = Math.max(1, (maxBound - minBound) / binCount);
      let binSize = 1000;
      const financialSteps = [
        500, 1000, 2500, 5000, 10000, 25000, 50000, 100000,
        250000, 500000, 1000000, 2500000, 5000000, 10000000, 25000000, 50000000
      ];
      for (const step of financialSteps) {
        if (rawBinSize <= step) {
          binSize = step;
          break;
        }
      }
      if (rawBinSize > financialSteps[financialSteps.length - 1]) {
        binSize = Math.ceil(rawBinSize / 10000000) * 10000000;
      }

      const startVal = Math.floor(minBound / binSize) * binSize;
      const count = Math.max(1, Math.ceil((maxBound - startVal) / binSize));

      const bins = Array.from({ length: count }, (_, i) => ({
        binMin: startVal + i * binSize,
        binMax: startVal + (i + 1) * binSize,
        count: 0,
        label: formatPortfolioBinLabel(startVal + i * binSize),
        startYears: [] as number[],
        percentage: 0
      }));

      tableData.forEach(item => {
        if (item.value < startVal || item.value > startVal + count * binSize) return;
        let binIdx = Math.floor((item.value - startVal) / binSize);
        if (Number.isNaN(binIdx)) binIdx = 0;
        if (binIdx >= count) binIdx = count - 1;
        if (binIdx < 0) binIdx = 0;
        bins[binIdx].count++;
        bins[binIdx].startYears.push(item.startYear);
      });

      bins.forEach(b => {
        b.percentage = total > 0 ? (b.count / total) * 100 : 0;
      });

      return bins;
    };

    const globalMin = 0;
    const globalMax = largest > 0 ? largest : 1000;

    const overviewBins = (selectedYearOption === 'final' && result.defaultHistogramBins && result.defaultHistogramBins.length > 0)
      ? result.defaultHistogramBins.map(b => ({
          binMin: b.binMin,
          binMax: b.binMax,
          count: b.count,
          label: b.label,
          startYears: b.startYears,
          percentage: total > 0 ? (b.count / total) * 100 : 0
        }))
      : buildBins(globalMin, globalMax, 20);

    return {
      median,
      average,
      stdDev,
      largest,
      smallest,
      zeroCount,
      zeroPercentage,
      overviewData: overviewBins,
      tableData,
      buildBins,
      globalMin,
      globalMax
    };
  }, [result, selectedYearOption, config?.currentAge, config?.retirementAge, config?.timelineMode]);

  const statsAndData = useMemo(() => {
    if (!baseStatsAndOverview.buildBins) {
      return { ...baseStatsAndOverview, histogramData: [] as any[] };
    }
    const effectiveMin = activeDomainRange.min !== null ? activeDomainRange.min : baseStatsAndOverview.globalMin;
    const effectiveMax = activeDomainRange.max !== null ? activeDomainRange.max : baseStatsAndOverview.globalMax;
    const detailBins = (activeDomainRange.min === null && activeDomainRange.max === null && selectedYearOption === 'final' && result?.defaultHistogramBins && result.defaultHistogramBins.length > 0)
      ? baseStatsAndOverview.overviewData
      : baseStatsAndOverview.buildBins(effectiveMin, effectiveMax, 20);

    return {
      ...baseStatsAndOverview,
      histogramData: detailBins
    };
  }, [baseStatsAndOverview, activeDomainRange, selectedYearOption, result]);

  const overviewData = baseStatsAndOverview?.overviewData;
  const handleBrushChange = React.useCallback((range: { startIndex?: number; endIndex?: number }) => {
    if (brushTimeoutRef.current) {
      clearTimeout(brushTimeoutRef.current);
    }
    brushTimeoutRef.current = setTimeout(() => {
      const overview = overviewData;
      if (
        range &&
        range.startIndex !== undefined &&
        range.endIndex !== undefined &&
        overview &&
        overview[range.startIndex] &&
        overview[range.endIndex]
      ) {
        const nextMin = overview[range.startIndex].binMin;
        const nextMax = overview[range.endIndex].binMax;
        setActiveDomainRange(prev => {
          if (prev.min === nextMin && prev.max === nextMax) return prev;
          return { min: nextMin, max: nextMax };
        });
      }
    }, 40);
  }, [overviewData]);

  if (!result) {
    return <div className="p-8 text-center text-gray-600 animate-pulse">Loading Portfolio Value View...</div>;
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  return (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6 transition-opacity duration-200 ${isCalculating ? 'opacity-100' : 'opacity-100'}`}>
      {/* Title & Milestone Toggles */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-900">Portfolio Value (Real Dollars)</h2>
        <div className="flex flex-wrap bg-gray-100 p-1.5 rounded-2xl gap-1">
          {[
            { label: 'Year 5', value: '5' },
            { label: 'Year 10', value: '10' },
            { label: 'Year 20', value: '20' },
            { label: 'Final Year', value: 'final' }
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelectedYearOption(opt.value)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedYearOption === opt.value ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-700 hover:text-gray-900'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4x2 Stat Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-100 text-sm">
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
            <span className="text-gray-600 font-medium">Median</span>
            <span className="font-bold text-gray-900">{formatCurrency(statsAndData.median)}</span>
          </div>
          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
            <span className="text-gray-600 font-medium">Average</span>
            <span className="font-bold text-gray-900">{formatCurrency(statsAndData.average)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 font-medium">Standard Deviation</span>
            <span className="font-bold text-gray-900">{formatCurrency(statsAndData.stdDev)}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
            <span className="text-gray-600 font-medium">Largest</span>
            <span className="font-bold text-gray-900">{formatCurrency(statsAndData.largest)}</span>
          </div>
          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
            <span className="text-gray-600 font-medium">Smallest</span>
            <span className="font-bold text-gray-900">{formatCurrency(statsAndData.smallest)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 font-medium">Depleted ($0) Portfolios</span>
            <span className="font-bold text-red-600">{statsAndData.zeroCount} ({statsAndData.zeroPercentage.toFixed(2)}%)</span>
          </div>
        </div>
      </div>

      {/* Toggle View */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setViewMode('histogram')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'histogram' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-700 hover:text-gray-900'}`}
          >
            📊 Histogram
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'table' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-700 hover:text-gray-900'}`}
          >
            ≡ Table
          </button>
        </div>
        <p className="text-xs text-gray-700 italic hidden sm:block">Hover chart for details. Slide brush or pick intervals below to dynamically scale bin granularity.</p>
      </div>

      {/* Quick-Zoom Adaptive Range Bar */}
      {viewMode === 'histogram' && (
        <div className="flex flex-wrap items-center gap-2 pt-2 pb-1 bg-gray-50/70 p-3 rounded-2xl border border-gray-200 text-xs">
          <span className="font-bold text-gray-700 uppercase tracking-wider text-[11px] mr-1">Dynamic Range Scale:</span>
          {[
            { label: 'All ($2.5M+ bins)', min: null, max: null },
            { label: '< $5M ($250K bins)', min: 0, max: 5000000 },
            { label: '< $2.5M ($250K bins)', min: 0, max: 2500000 },
            { label: '< $1M ($50K bins)', min: 0, max: 1000000 },
            { label: '< $500K ($25K bins)', min: 0, max: 500000 },
            { label: '< $250K ($25K bins)', min: 0, max: 250000 },
          ].map((pill, i) => {
            const isActive = activeDomainRange.min === pill.min && activeDomainRange.max === pill.max;
            return (
              <button
                key={i}
                onClick={() => setActiveDomainRange({ min: pill.min, max: pill.max })}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-700 hover:bg-blue-50'}`}
              >
                {pill.label}
              </button>
            );
          })}
          {activeDomainRange.min !== null && (
            <button
              onClick={() => setActiveDomainRange({ min: null, max: null })}
              className="ml-auto px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl border border-red-200 transition-all"
            >
              ↺ Reset Full Range
            </button>
          )}
        </div>
      )}

      {/* Content View */}
      {viewMode === 'histogram' ? (
        <div className="space-y-4 pt-4 w-full min-w-0 overflow-hidden">
          {/* Tier 1: Primary High-Resolution Adaptive BarChart (No dynamic key, No inner Brush) */}
          <div className="h-80 w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statsAndData.histogramData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" stroke="#64748b" angle={-15} textAnchor="end" height={50} interval="preserveStartEnd" className="text-xs" />
                <YAxis stroke="#64748b" label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: '#64748b' }} className="text-xs" />
                <Tooltip content={<CustomTooltip isMonteCarlo={isMonteCarlo} />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {statsAndData.histogramData.map((entry, index) => (
                    <Cell key={`detail-cell-${index}`} fill={entry.binMin <= 0 ? '#ef4444' : entry.binMin >= (config?.initialPortfolio || 1000000) ? '#22c55e' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tier 2: Stable Global Overview + Continuous Brush Navigator */}
          <div className="h-28 w-full min-w-0 bg-gray-50/70 p-2 rounded-2xl border border-gray-200 overflow-hidden">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-2 mb-1">Macro Range Navigator (Slide to scale bin widths across timeline)</p>
            <ResponsiveContainer width="100%" height={65}>
              <BarChart data={statsAndData.overviewData} margin={{ top: 0, right: 30, left: 20, bottom: 5 }}>
                <Bar dataKey="count" fill="#cbd5e1" radius={[2, 2, 0, 0]}>
                  {statsAndData.overviewData.map((entry: any, index: number) => (
                    <Cell key={`master-cell-${index}`} fill="#cbd5e1" />
                  ))}
                </Bar>
                <Brush
                  dataKey="label"
                  height={28}
                  stroke="#3b82f6"
                  fill="#f8fafc"
                  startIndex={0}
                  endIndex={Math.max(0, statsAndData.overviewData.length - 1)}
                  onChange={handleBrushChange}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-96 border border-gray-200 rounded-2xl shadow-inner mt-4">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">{isMonteCarlo ? 'Run Number' : 'Start Year'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Real Portfolio Value</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {statsAndData.tableData.map((row) => (
                <tr key={row.startYear} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{isMonteCarlo ? `Run #${row.startYear}` : row.startYear}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {row.status === 'Success' ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Success</span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Depleted</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">{formatCurrency(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
