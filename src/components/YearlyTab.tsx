'use client';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useMemo, useState, useEffect, useRef } from 'react';
import { parseLocalDate, formatFriendlyDate, convertAmount, formatFriendlyCurrency, formatChartFriendlyCurrency, formatAxisFriendlyCurrency, formatNoDecimalCurrency } from '@/lib/utils';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  LineController,
  BarController,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  LineController,
  BarController,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

export default function YearlyTab() {
  const { 
    expenses, activeMonthFilter, setActiveMonthFilter,
    displayCurrency, baseCurrency, exchangeRates, budgets, categories
  } = useExpenseStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const detailsRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [yearlyViewMode, setYearlyViewMode] = useState<'expense' | 'budget'>('expense');
  const [showBreakdown, setShowBreakdown] = useState(false);

  const years = useMemo(() => {
    const yrSet = new Set<string>();
    expenses.forEach(exp => {
      if (!exp.date) return;
      const d = parseLocalDate(exp.date);
      if (!isNaN(d.getTime())) yrSet.add(d.getFullYear().toString());
    });
    const sorted = Array.from(yrSet).sort((a,b) => parseInt(b) - parseInt(a));
    return sorted;
  }, [expenses]);

  useEffect(() => {
    if(years.length > 0 && !years.includes(selectedYear)) {
      setSelectedYear(years[0]);
    }
  }, [years, selectedYear]);

  // E2E test simulation listener
  useEffect(() => {
    const handleSim = (e: any) => setActiveMonthFilter(e.detail);
    window.addEventListener('chart-click-sim', handleSim);
    return () => window.removeEventListener('chart-click-sim', handleSim);
  }, [setActiveMonthFilter]);

  const { recurringData, oneOffData, totalData } = useMemo(() => {
    const recurringByMonth: Record<number, number | null> = {};
    const oneOffByMonth: Record<number, number | null> = {};
    const totalByMonth: Record<number, number | null> = {};
    
    for(let i=0; i<12; i++) {
      recurringByMonth[i] = null;
      oneOffByMonth[i] = null;
      totalByMonth[i] = null;
    }

    expenses.forEach(exp => {
      if (!exp.date) return;
      const d = parseLocalDate(exp.date);
      if (isNaN(d.getTime()) || d.getFullYear().toString() !== selectedYear) return;
      const m = d.getMonth();
      
      if (totalByMonth[m] === null) {
        totalByMonth[m] = 0;
        recurringByMonth[m] = 0;
        oneOffByMonth[m] = 0;
      }
      
      const amtBase = parseFloat(exp.amount as any) || 0;
      const amtDisplay = convertAmount(amtBase, baseCurrency, displayCurrency, exchangeRates);
      
      const isRecurring = !!exp.recurring_expense_id;
      
      if (isRecurring) {
        recurringByMonth[m] = (recurringByMonth[m] || 0) + amtDisplay;
      } else {
        oneOffByMonth[m] = (oneOffByMonth[m] || 0) + amtDisplay;
      }
      totalByMonth[m] = (totalByMonth[m] || 0) + amtDisplay;
    });

    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return {
      recurringData: labels.map((_, i) => recurringByMonth[i]),
      oneOffData: labels.map((_, i) => oneOffByMonth[i]),
      totalData: labels.map((_, i) => totalByMonth[i])
    };
  }, [expenses, selectedYear, displayCurrency, baseCurrency, exchangeRates]);

  const { budgetData } = useMemo(() => {
    const bgtByMonth: Record<number, number | null> = {};

    for(let i=0; i<12; i++) {
      bgtByMonth[i] = null;
    }

    const allBgtMonths = Array.from(new Set(budgets.map(b => b.month))).sort();

    for(let i=0; i<12; i++) {
      const targetMonthStr = `${selectedYear}-${String(i+1).padStart(2, '0')}`;
      let exactBudgets = budgets.filter(b => b.month === targetMonthStr);

      if (exactBudgets.length === 0) {
        const priorMonths = allBgtMonths.filter(m => m < targetMonthStr);
        if (priorMonths.length > 0) {
          const latestPrior = priorMonths[priorMonths.length - 1];
          exactBudgets = budgets.filter(b => b.month === latestPrior);
        }
      }

      let monthBudgetSum = 0;
      exactBudgets.forEach(b => {
        if (b.category_id) {
          monthBudgetSum += convertAmount(b.limit_amount, b.currency as any, displayCurrency, exchangeRates);
        }
      });

      const monthSpentSum = totalData[i] || 0;

      if (monthBudgetSum > 0 || monthSpentSum > 0) {
        bgtByMonth[i] = monthBudgetSum;
      }
    }

    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return {
      budgetData: labels.map((_, i) => bgtByMonth[i])
    };
  }, [budgets, totalData, selectedYear, displayCurrency, exchangeRates]);

  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const chartDatasets = yearlyViewMode === 'budget' ? [
    {
      type: 'line' as const,
      label: 'Monthly Budget',
      data: budgetData,
      borderColor: '#2D3748', // Zen Charcoal
      backgroundColor: '#2D3748',
      borderWidth: 3,
      tension: 0.2,
      fill: false,
      pointHitRadius: 15,
      datalabels: {
        display: false // Removed static sum labels from budget line per user request
      }
    },
    {
      type: 'bar' as const,
      label: 'Actual Spent',
      data: totalData,
      backgroundColor: '#AEC3B0', // Monochromatic light green per user request
      borderRadius: 4,
      barPercentage: 0.6,
      datalabels: {
        display: false // Remove static sum labels from tops of actual expense bars
      }
    }
  ] : (showBreakdown ? [
    {
      label: 'Recurring',
      data: recurringData,
      backgroundColor: '#AEC3B0', // Soft Sage Green
      borderRadius: 4,
      barPercentage: 0.6,
      stack: 'stack1',
      datalabels: {
        display: (context: any) => {
          const val = context.dataset.data[context.dataIndex];
          return val !== null && val > 0;
        },
        anchor: 'center' as const,
        align: 'center' as const,
        color: '#2D3748',
        font: { weight: 'bold' as const, size: 10 },
        formatter: (value: number, context: any) => {
          const idx = context.dataIndex;
          const recVal = recurringData[idx] || 0;
          const oneVal = oneOffData[idx] || 0;
          const total = recVal + oneVal;
          if (total === 0) return '';
          const pct = Math.round((value / total) * 100);
          return pct > 0 ? `${pct}%` : '';
        }
      }
    },
    {
      label: 'One-off',
      data: oneOffData,
      backgroundColor: '#D8D2E1', // Muted Lavender
      borderRadius: 4,
      barPercentage: 0.6,
      stack: 'stack1',
      datalabels: {
        display: false // Removed total sum labels from top of bars
      }
    }
  ] : [
    {
      label: 'Total Spent',
      data: totalData,
      backgroundColor: '#AEC3B0', // Soft Sage Green
      borderRadius: 4,
      barPercentage: 0.6,
      datalabels: {
        display: false // Removed static numerical sum labels from tops of bars
      }
    }
  ]);

  const chartData = {
    labels,
    datasets: chartDatasets
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 30 } },
    onClick: (event: any, elements: any[]) => {
      if (elements.length > 0) {
        const idx = elements[0].index;
        setActiveMonthFilter(idx.toString());
        setTimeout(() => { detailsRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
      }
    },
    scales: {
        x: { 
          stacked: (yearlyViewMode === 'expense' && showBreakdown) || yearlyViewMode === 'budget',
          grid: { display: false }, 
          border: { display: false }, 
          ticks: { color: '#2D3748', font: { weight: 'bold' as const } } 
        },
        y: { 
          stacked: (yearlyViewMode === 'expense' && showBreakdown) || yearlyViewMode === 'budget',
          grid: { display: false }, 
          border: { display: false }, 
          ticks: { 
            display: true, 
            color: '#718096', 
            font: { size: 10 },
            callback: (val: any) => formatAxisFriendlyCurrency(val, displayCurrency)
          },
          min: 0 
        }
    },
    plugins: {
        legend: { 
          display: yearlyViewMode === 'budget' || (yearlyViewMode === 'expense' && showBreakdown),
          position: 'top' as const,
          labels: { boxWidth: 12, font: { weight: 'bold' as const } }
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context: any) {
              let label = context.dataset.label || '';
              if (label) { label += ': '; }
              if (context.parsed.y !== null) { 
                label += formatChartFriendlyCurrency(context.parsed.y, displayCurrency); 
              }
              return label;
            },
            afterBody: function(context: any[]) {
              if (yearlyViewMode === 'budget' && context.length > 0) {
                const idx = context[0].dataIndex;
                const spent = totalData[idx] || 0;
                return `Total Spent: ${formatChartFriendlyCurrency(spent, displayCurrency)}`;
              }
              return '';
            }
          }
        },
        datalabels: {
            display: false // Handled explicitly inside datasets
        }
    }
  };

  const selectedMonthStr = activeMonthFilter !== null ? `${selectedYear}-${String(parseInt(activeMonthFilter, 10)+1).padStart(2, '0')}` : null;
  
  const activeMonthBudgets = useMemo(() => {
    if (!selectedMonthStr) return [];
    const exact = budgets.filter(b => b.month === selectedMonthStr);
    if (exact.length > 0) return exact;
    const allBgtMonths = Array.from(new Set(budgets.map(b => b.month))).sort();
    const priorMonths = allBgtMonths.filter(m => m < selectedMonthStr);
    if (priorMonths.length > 0) {
      const latestPrior = priorMonths[priorMonths.length - 1];
      return budgets.filter(b => b.month === latestPrior).map(b => ({ ...b, month: selectedMonthStr }));
    }
    return [];
  }, [budgets, selectedMonthStr]);

  const activeMonthExpenses = useMemo(() => {
    if (!selectedMonthStr) return [];
    return expenses.filter(exp => exp.date?.substring(0, 7) === selectedMonthStr);
  }, [expenses, selectedMonthStr]);

  const activeMonthSpentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    activeMonthExpenses.forEach(exp => {
      const catId = exp.category_id;
      if (!map[catId]) map[catId] = 0;
      const amtBase = parseFloat(exp.amount as any) || 0;
      const amtDisplay = convertAmount(amtBase, baseCurrency, displayCurrency, exchangeRates);
      map[catId] += amtDisplay;
    });
    return map;
  }, [activeMonthExpenses, baseCurrency, displayCurrency, exchangeRates]);

  const detailExpenses = useMemo(() => {
    if (activeMonthFilter === null) return [];
    const monthIdx = parseInt(activeMonthFilter, 10);
    return expenses.filter(exp => {
      if (!exp.date) return false;
      const d = parseLocalDate(exp.date);
      return d.getFullYear().toString() === selectedYear && d.getMonth() === monthIdx;
    });
  }, [expenses, activeMonthFilter, selectedYear]);

  return (
    <div id="tab-yearly" className="tab-content active" style={{ display: "block" }}>
        <div className="flex justify-between items-center mb-4">
            <h2 className="margin-0 text-zen-charcoal font-bold">
              {yearlyViewMode === 'expense' ? 'Monthly Expenses' : 'Budget vs Spent'}
            </h2>
            <div className="flex items-center gap-3">
                {/* Master View Toggle Switch */}
                <div className="bg-white/40 backdrop-blur-md border border-white/20 rounded-full p-1 inline-flex items-center gap-1">
                  <button 
                    onClick={() => { setYearlyViewMode('expense'); setShowBreakdown(false); }}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all border-none cursor-pointer ${yearlyViewMode === 'expense' ? 'bg-zen-charcoal text-white shadow-sm' : 'text-zen-charcoal/60 hover:text-zen-charcoal bg-transparent'}`}
                  >
                    Expense View
                  </button>
                  <button 
                    onClick={() => setYearlyViewMode('budget')}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all border-none cursor-pointer ${yearlyViewMode === 'budget' ? 'bg-zen-charcoal text-white shadow-sm' : 'text-zen-charcoal/60 hover:text-zen-charcoal bg-transparent'}`}
                  >
                    Budget View
                  </button>
                </div>

                <div className="relative inline-flex items-center">
                  <select 
                    id="yearSelect" 
                    value={selectedYear} 
                    onChange={e => setSelectedYear(e.target.value)}
                    className="pl-4 pr-8 py-2 bg-white/50 border border-zen-lavender/60 rounded-full text-zen-charcoal text-sm font-bold outline-none cursor-pointer h-10 appearance-none box-border min-w-[44px]"
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <div className="absolute right-3.5 pointer-events-none text-zen-charcoal/60 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6"></path>
                    </svg>
                  </div>
                </div>
            </div>
        </div>

        <div className="chart-container" style={{ height: '300px', maxHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isMounted ? (
              <Chart type="bar" data={chartData as any} options={options as any} plugins={[ChartDataLabels]} />
            ) : (
              <div className="text-zen-charcoal/60">Loading Chart...</div>
            )}
        </div>

        {/* Relocated Single-Line Show Recurring Expenses Checkbox (Visible only in Expense View, right corner under chart) */}
        <div className="flex justify-end mt-2 px-1">
          {yearlyViewMode === 'expense' && (
            <label className="inline-flex items-center gap-2 bg-white/40 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 min-h-[44px] cursor-pointer select-none shadow-xs hover:bg-white/60 transition-all box-border">
              <input 
                type="checkbox" 
                checked={showBreakdown}
                onChange={e => setShowBreakdown(e.target.checked)}
                className="w-4 h-4 accent-zen-sage cursor-pointer rounded m-0"
              />
              <span className="text-xs font-bold text-zen-charcoal whitespace-nowrap">Show recurring expenses</span>
            </label>
          )}
        </div>

        <div id="yearly-details-container" ref={detailsRef} style={{ marginTop: '20px' }}>
          {activeMonthFilter !== null && (
            <div className="month-details p-5 bg-white/40 backdrop-blur-md border border-white/20 rounded-3xl mb-5 shadow-sm text-left">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 className="font-bold text-zen-charcoal">{labels[parseInt(activeMonthFilter, 10)]} {selectedYear} Details</h3>
                <button onClick={() => setActiveMonthFilter(null)} className="px-3 py-1 bg-white/60 border border-zen-lavender/40 text-zen-charcoal rounded-full font-semibold hover:bg-white/80 transition-colors text-sm cursor-pointer border-none">Close</button>
              </div>

              {yearlyViewMode === 'budget' ? (
                <div className="flex flex-col gap-3 mt-2">
                  {/* Overall Monthly Summary */}
                  {(() => {
                    const monthIdx = parseInt(activeMonthFilter, 10);
                    const monthSpent = totalData[monthIdx] || 0;
                    const monthBudget = budgetData[monthIdx] || 0;
                    const isMonthOver = monthSpent > monthBudget && monthBudget > 0;

                    return (
                      <div className={`text-lg font-extrabold p-4 rounded-2xl border border-white/20 shadow-sm mb-4 bg-white/60 flex items-center justify-between ${isMonthOver ? 'text-amber-700' : 'text-emerald-700'}`}>
                        <span>Total: {formatNoDecimalCurrency(monthSpent, displayCurrency)} / {formatNoDecimalCurrency(monthBudget, displayCurrency)}</span>
                        {isMonthOver && <span title="Overspent" className="text-amber-700 flex items-center">⚠️</span>}
                      </div>
                    );
                  })()}

                  {categories.map(cat => {
                    const bgt = activeMonthBudgets.find(b => b.category_id === cat.id);
                    const limit = bgt ? convertAmount(bgt.limit_amount, bgt.currency as any, displayCurrency, exchangeRates) : 0;
                    const spent = activeMonthSpentByCategory[cat.id] || 0;
                    if (limit === 0 && spent === 0) return null;
                    const isOver = spent > limit && limit > 0;
                    
                    return (
                      <div key={cat.id} className="flex justify-between items-center p-3 bg-white/60 rounded-2xl border border-white/20 shadow-xs">
                        <span className="font-semibold text-zen-charcoal text-sm">{cat.name}</span>
                        <div className="flex items-center gap-2">
                          {limit === 0 ? (
                            <span className="text-xs font-bold text-zen-charcoal/60">
                              {formatNoDecimalCurrency(spent, displayCurrency)} / No Allocation
                            </span>
                          ) : (
                            <>
                              <span className={`text-xs font-bold ${isOver ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {formatNoDecimalCurrency(spent, displayCurrency)} / {formatNoDecimalCurrency(limit, displayCurrency)}
                              </span>
                              {isOver && <span title="Overspent" className="text-amber-700 text-xs flex items-center">⚠️</span>}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                detailExpenses.length > 0 ? (
                  <div className="recent-list">
                    {detailExpenses.map(exp => (
                      <div key={exp.id} className="expense-item">
                        <div className="expense-info">
                          <h4>{exp.item}</h4>
                          <p>{exp.categories?.name || "Uncategorized"} &bull; {formatFriendlyDate(exp.date)}</p>
                        </div>
                        <div className="expense-amount">
                          {formatFriendlyCurrency(
                            convertAmount(parseFloat(exp.amount as any) || 0, baseCurrency, displayCurrency, exchangeRates),
                            displayCurrency
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No expenses for this month.</p>
                )
              )}

            </div>
          )}
        </div>
    </div>
  );
}
