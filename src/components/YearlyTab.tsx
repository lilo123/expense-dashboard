 
'use client';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useMemo, useState, useEffect, useRef, memo } from 'react';
import { parseLocalDate, formatFriendlyDate, convertAmount, formatFriendlyCurrency, formatChartFriendlyCurrency, formatAxisFriendlyCurrency, formatNoDecimalCurrency } from '@/lib/utils';
import { useIsMounted } from '@/lib/hooks';
import { ChevronDown } from 'lucide-react';
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

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function YearlyTab() {
  const expenses = useExpenseStore(state => state.expenses);
  const activeMonthFilter = useExpenseStore(state => state.activeMonthFilter);
  const setActiveMonthFilter = useExpenseStore(state => state.setActiveMonthFilter);
  const displayCurrency = useExpenseStore(state => state.displayCurrency);
  const baseCurrency = useExpenseStore(state => state.baseCurrency);
  const exchangeRates = useExpenseStore(state => state.exchangeRates);
  const budgets = useExpenseStore(state => state.budgets);
  const categories = useExpenseStore(state => state.categories);
  const toggleEditModal = useExpenseStore(state => state.toggleEditModal);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const detailsRef = useRef<HTMLDivElement>(null);
  const isMounted = useIsMounted();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategoryAccordion = (catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };



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

  const [prevYears, setPrevYears] = useState<string[]>([]);
  // Synchronously adjust state during render when years list changes to satisfy set-state-in-effect linter rules
  if (JSON.stringify(years) !== JSON.stringify(prevYears)) {
    setPrevYears(years);
    if (years.length > 0 && !years.includes(selectedYear)) {
      setSelectedYear(years[0]);
    }
  }

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
      
      const amtOriginal = exp.original_amount !== null && exp.original_amount !== undefined ? Number(exp.original_amount) : (Number(exp.amount) || 0);
      const curOriginal = exp.original_currency || exp.currency || baseCurrency;
      const amtDisplay = convertAmount(amtOriginal, curOriginal, displayCurrency, exchangeRates);
      
      const isRecurring = !!exp.recurring_expense_id;
      
      if (isRecurring) {
        recurringByMonth[m] = (recurringByMonth[m] || 0) + amtDisplay;
      } else {
        oneOffByMonth[m] = (oneOffByMonth[m] || 0) + amtDisplay;
      }
      totalByMonth[m] = (totalByMonth[m] || 0) + amtDisplay;
    });



    return {
      recurringData: MONTH_LABELS.map((_, i) => recurringByMonth[i]),
      oneOffData: MONTH_LABELS.map((_, i) => oneOffByMonth[i]),
      totalData: MONTH_LABELS.map((_, i) => totalByMonth[i])
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
          monthBudgetSum += convertAmount(b.limit_amount, b.currency, displayCurrency, exchangeRates);
        }
      });

      const monthSpentSum = totalData[i] || 0;

      if (monthBudgetSum > 0 || monthSpentSum > 0) {
        bgtByMonth[i] = monthBudgetSum;
      }
    }



    return {
      budgetData: MONTH_LABELS.map((_, i) => bgtByMonth[i])
    };
  }, [budgets, totalData, selectedYear, displayCurrency, exchangeRates]);

  // Dynamically compute y-axis maximum ceiling with a comfortable 15% visual buffer
  const yAxisMaxCeiling = useMemo(() => {
    const validBudgets = budgetData.filter((v): v is number => v !== null && v > 0);
    const validSpents = totalData.filter((v): v is number => v !== null && v > 0);
    const allValues = [...validBudgets, ...validSpents];
    if (allValues.length === 0) return undefined;
    const rawMax = Math.max(...allValues);
    return Math.ceil(rawMax * 1.15);
  }, [budgetData, totalData]);

  const chartDatasets = useMemo(() => {
    return showBreakdown ? [
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
          display: false
        }
      },
      {
        type: 'bar' as const,
        label: 'Recurring Spent',
        data: recurringData,
        backgroundColor: '#AEC3B0', // Sage Green
        stack: 'spentStack',
        borderRadius: 4,
        barPercentage: 0.6,
        datalabels: {
          display: false
        }
      },
      {
        type: 'bar' as const,
        label: 'One-off Spent',
        data: oneOffData,
        backgroundColor: '#D8D2E1', // Soft Lavender
        stack: 'spentStack',
        borderRadius: 4,
        barPercentage: 0.6,
        datalabels: {
          display: false
        }
      }
    ] : [
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
          display: false
        }
      },
      {
        type: 'bar' as const,
        label: 'Actual Spent',
        data: totalData,
        backgroundColor: '#AEC3B0', // Monochromatic Sage Green
        borderRadius: 4,
        barPercentage: 0.6,
        datalabels: {
          display: false
        }
      }
    ];
  }, [showBreakdown, budgetData, recurringData, oneOffData, totalData]);

  const chartData = useMemo(() => ({
    labels: MONTH_LABELS,
    datasets: chartDatasets
  }), [chartDatasets]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 5 } },
    onClick: (event: any, elements: any[]) => {
      if (elements.length > 0) {
        const idx = elements[0].index;
        setActiveMonthFilter(idx.toString());
        setTimeout(() => { detailsRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
      }
    },
    scales: {
        x: { 
          stacked: true,
          grid: { display: false }, 
          border: { display: false }, 
          ticks: { color: '#2D3748', font: { weight: 'bold' as const } } 
        },
        y: { 
          stacked: true,
          grid: { display: false }, 
          border: { display: false }, 
          ticks: { 
            display: true, 
            color: '#718096', 
            font: { size: 10 },
            callback: (val: any) => formatAxisFriendlyCurrency(val, displayCurrency)
          },
          min: 0,
          max: yAxisMaxCeiling
        }
    },
    plugins: {
        legend: { 
          display: false
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
              if (context.length > 0) {
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
      const amtOriginal = exp.original_amount !== null && exp.original_amount !== undefined ? Number(exp.original_amount) : (Number(exp.amount) || 0);
      const curOriginal = exp.original_currency || exp.currency || baseCurrency;
      const amtDisplay = convertAmount(amtOriginal, curOriginal, displayCurrency, exchangeRates);
      map[catId] += amtDisplay;
    });
    return map;
  }, [activeMonthExpenses, baseCurrency, displayCurrency, exchangeRates]);

// detailExpenses was removed as it is no longer used since the flat transaction list in Month Details tray was cleaned up.

  return (
    <div id="tab-yearly" className="tab-content active" style={{ display: "block" }}>

        {/* Custom React JSX Legend */}
        <div id="custom-chart-legend" className="flex flex-wrap items-center justify-center gap-6 mb-4 select-none animate-fade-in bg-white/20 backdrop-blur-xs border border-white/10 rounded-full py-1.5 px-4 w-fit mx-auto shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 rounded-full" style={{ backgroundColor: '#2D3748' }} />
            <span className="text-xs font-extrabold text-zen-charcoal/80">Monthly Budget</span>
          </div>
          {!showBreakdown ? (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs" style={{ backgroundColor: '#AEC3B0' }} />
              <span className="text-xs font-extrabold text-zen-charcoal/80">Actual Spent</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-xs" style={{ backgroundColor: '#AEC3B0' }} />
                <span className="text-xs font-extrabold text-zen-charcoal/80">Recurring Spent</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-xs" style={{ backgroundColor: '#D8D2E1' }} />
                <span className="text-xs font-extrabold text-zen-charcoal/80">One-off Spent</span>
              </div>
            </>
          )}
        </div>

        <div className="chart-container" style={{ height: '300px', maxHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isMounted ? (
              <Chart type="bar" data={chartData as any} options={options as any} plugins={[ChartDataLabels]} />
            ) : (
              <div className="text-zen-charcoal/60">Loading Chart...</div>
            )}
        </div>

        {/* Relocated Footer Control Panel Row (positioned below the chart container) */}
        <div className="flex justify-between items-center mt-4 w-full select-none">
            {/* "Show recurring expenses" checkbox Styled as h-10 glassmorphic pill on the left */}
            <label className="inline-flex items-center gap-2 bg-white/40 backdrop-blur-md border border-white/20 rounded-full px-4 h-10 cursor-pointer select-none shadow-xs hover:bg-white/60 transition-all box-border">
              <input 
                type="checkbox" 
                checked={showBreakdown}
                onChange={e => setShowBreakdown(e.target.checked)}
                className="w-4 h-4 accent-zen-sage cursor-pointer rounded m-0"
              />
              <span className="text-xs font-bold text-zen-charcoal whitespace-nowrap">Show recurring expenses</span>
            </label>

            {/* Year Select Dropdown on the right */}
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

        <div id="yearly-details-container" ref={detailsRef} style={{ marginTop: '20px' }}>
          {activeMonthFilter !== null && (
            <div className="month-details p-5 bg-white/40 backdrop-blur-md border border-white/20 rounded-3xl mb-5 shadow-sm text-left">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 className="font-extrabold text-zen-charcoal text-lg">
                  {MONTH_LABELS[parseInt(activeMonthFilter, 10)]} {selectedYear}
                </h3>
                <button onClick={() => setActiveMonthFilter(null)} className="px-3 py-1 bg-white/60 text-zen-charcoal rounded-full font-semibold hover:bg-white/80 transition-colors text-sm cursor-pointer border-none">Close</button>
              </div>

              <div className="flex flex-col gap-3 mt-2">
                {/* Overall Monthly Summary Progress Indicator */}
                {(() => {
                  const monthIdx = parseInt(activeMonthFilter, 10);
                  const monthSpent = Math.round(totalData[monthIdx] || 0);
                  const monthBudget = Math.round(budgetData[monthIdx] || 0);
                  const isMonthOver = monthSpent > monthBudget && monthBudget > 0;
                  const percentage = monthBudget > 0 ? Math.round((monthSpent / monthBudget) * 100) : 0;
                  const barWidth = Math.min(100, percentage);

                  return (
                    <div className="bg-white/60 border border-white/30 p-5 rounded-2xl flex flex-col gap-2 shadow-xs mb-4">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-base text-zen-charcoal">Total:</span>
                        <span className="text-xs font-bold text-zen-charcoal/70">
                          {monthBudget === 0 ? (
                            `Spent ${formatNoDecimalCurrency(monthSpent, displayCurrency)} / No Budget`
                          ) : (
                            `Spent ${formatNoDecimalCurrency(monthSpent, displayCurrency)} of ${formatNoDecimalCurrency(monthBudget, displayCurrency)} (${percentage}%)`
                          )}
                        </span>
                      </div>
                      <div 
                        role="progressbar"
                        aria-valuenow={Math.min(100, percentage)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Overall monthly budget utilization"
                        className="w-full h-3 bg-zen-lavender/20 rounded-full overflow-hidden border border-zen-lavender/30 shadow-inner"
                      >
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${isMonthOver ? 'bg-amber-500' : 'bg-zen-sage'}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {categories.map(cat => {
                  const bgt = activeMonthBudgets.find(b => b.category_id === cat.id);
                  const limit = bgt ? convertAmount(bgt.limit_amount, bgt.currency, displayCurrency, exchangeRates) : 0;
                  const spent = activeMonthSpentByCategory[cat.id] || 0;
                  if (limit === 0 && spent === 0) return null;

                  const isOver = spent > limit && limit > 0;
                  const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
                  const barWidth = Math.min(100, percentage);
                  const isOpen = expandedCategories.has(cat.id);

                  const catExpenses = activeMonthExpenses.filter(exp => exp.category_id === cat.id);

                  return (
                    <div key={cat.id} className="flex flex-col gap-2.5 bg-white/60 p-4 rounded-2xl border border-white/20 shadow-xs">
                      {/* Clickable Accordion Trigger Header */}
                      <div 
                        onClick={() => toggleCategoryAccordion(cat.id)}
                        className="flex justify-between items-center cursor-pointer hover:opacity-80 transition-all select-none"
                      >
                        <span className="font-bold text-sm text-zen-charcoal flex items-center gap-2">
                          <ChevronDown size={14} className={`text-zen-charcoal/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                          {cat.name}
                        </span>
                        <span className="text-xs font-bold text-zen-charcoal/70">
                          {limit === 0 ? (
                            `Spent ${formatNoDecimalCurrency(Math.round(spent), displayCurrency)} / No Allocation`
                          ) : (
                            `Spent ${formatNoDecimalCurrency(Math.round(spent), displayCurrency)} of ${formatNoDecimalCurrency(Math.round(limit), displayCurrency)} (${percentage}%)`
                          )}
                        </span>
                      </div>

                      {/* Mini Utilization Progressbar */}
                      <div 
                        role="progressbar"
                        aria-valuenow={Math.min(100, percentage)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${cat.name} budget utilization`}
                        className="w-full h-2 bg-zen-lavender/10 rounded-full overflow-hidden border border-zen-lavender/20 shadow-inner"
                      >
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${isOver ? 'bg-amber-500' : 'bg-zen-sage'}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>

                      {/* Expanded Category Transaction Details List */}
                      {isOpen && (
                        <div className="mt-3 flex flex-col gap-2.5 animate-fade-in w-full">
                          {catExpenses.length > 0 ? (
                            catExpenses.map(exp => {
                              const amtOriginal = exp.original_amount !== null && exp.original_amount !== undefined ? Number(exp.original_amount) : (Number(exp.amount) || 0);
                              const curOriginal = exp.original_currency || exp.currency || baseCurrency;
                              const convertedAmount = convertAmount(amtOriginal, curOriginal, displayCurrency, exchangeRates);
                              const formattedAmount = formatFriendlyCurrency(convertedAmount, displayCurrency);

                              return (
                                <button
                                  type="button"
                                  key={exp.id}
                                  onClick={() => toggleEditModal(exp.id)}
                                  aria-haspopup="dialog"
                                  aria-label={`Edit expense: ${exp.item} on ${formatFriendlyDate(exp.date)}, amount ${formattedAmount}`}
                                  className="w-full flex justify-between items-center text-xs font-semibold bg-white/80 backdrop-blur-md border border-zen-lavender/30 shadow-sm hover:shadow-md hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zen-sage transition-all duration-200 p-3 rounded-2xl cursor-pointer text-left font-inherit"
                                >
                                  <span className="flex flex-col gap-0.5 text-left min-w-0 flex-1 pr-2">
                                    <span className="text-xs font-bold text-zen-charcoal truncate">{exp.item}</span>
                                    <span className="text-[10px] font-medium text-zen-charcoal/60">{formatFriendlyDate(exp.date)}</span>
                                  </span>
                                  <span className="text-xs font-extrabold text-zen-charcoal shrink-0 pl-2">
                                    {formattedAmount}
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <span className="text-xs text-zen-charcoal/50 text-left italic">No expenses logged in this category.</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          )}
        </div>
    </div>
  );
}

export default memo(YearlyTab);
