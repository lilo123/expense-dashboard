'use client';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { convertAmount, formatNoDecimalCurrency } from '@/lib/utils';
import { Tag, ListFilter, ChevronDown } from 'lucide-react';
import AdjustMasterBudgetModal from './AdjustMasterBudgetModal';

export default function BudgetView() {
  const { 
    expenses, 
    categories, 
    budgets, 
    displayCurrency, 
    baseCurrency, 
    exchangeRates,
    toggleOnboarding
  } = useExpenseStore();

  const [isMounted, setIsMounted] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [sortDirection, setSortDirection] = useState<'highest' | 'lowest'>('highest');
  const [sortMetric, setSortMetric] = useState<'budget' | 'spend' | 'remaining'>('budget');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortPopoverRef = useRef<HTMLDivElement>(null);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Dismiss sort popover panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortPopoverRef.current && !sortPopoverRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
    };
    if (isSortOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSortOpen]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  // Filter expenses for selected month and convert to display currency
  const selectedMonthExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (!exp.date) return false;
      return exp.date.substring(0, 7) === selectedMonth;
    });
  }, [expenses, selectedMonth]);

  // Filter budgets for selected month, with intelligent prior-month rollover inheritance
  const selectedMonthBudgets = useMemo(() => {
    const exact = budgets.filter(b => b.month === selectedMonth);
    if (exact.length > 0) return exact;

    // Rollover / Inheritance Safeguard: find the most recent month prior to selectedMonth that has budgets
    const allMonths = Array.from(new Set(budgets.map(b => b.month))).sort();
    const priorMonths = allMonths.filter(m => m < selectedMonth);
    if (priorMonths.length > 0) {
      const latestPrior = priorMonths[priorMonths.length - 1];
      return budgets.filter(b => b.month === latestPrior).map(b => ({ ...b, month: selectedMonth }));
    }
    return [];
  }, [budgets, selectedMonth]);

  // Calculate spent per category
  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    selectedMonthExpenses.forEach(exp => {
      const catId = exp.category_id;
      if (!map[catId]) map[catId] = 0;
      const amtBase = Number(exp.amount) || 0;
      const amtDisplay = convertAmount(amtBase, baseCurrency, displayCurrency, exchangeRates);
      map[catId] += amtDisplay;
    });
    return map;
  }, [selectedMonthExpenses, baseCurrency, displayCurrency, exchangeRates]);

  // Find 'Unallocated Budget' surplus
  const surplusBudget = useMemo(() => {
    return selectedMonthBudgets.find(b => b.category_id === null);
  }, [selectedMonthBudgets]);

  const surplusAmount = surplusBudget ? surplusBudget.limit_amount : 0;

  // Calculate Total Limits and Total Spent
  const { totalLimits, totalSpent } = useMemo(() => {
    let limits = 0;
    let spent = 0;
    selectedMonthBudgets.forEach(b => {
      if (b.category_id) limits += b.limit_amount;
    });
    Object.values(spentByCategory).forEach(s => spent += s);
    return { totalLimits: limits, totalSpent: spent };
  }, [selectedMonthBudgets, spentByCategory]);

  const sortedCategories = useMemo(() => {
    const items = categories.map(cat => {
      const budget = selectedMonthBudgets.find(b => b.category_id === cat.id);
      const limit = budget ? budget.limit_amount : 0;
      const spent = spentByCategory[cat.id] || 0;
      const remaining = Math.max(0, limit - spent);
      return { category: cat, limit, spent, remaining };
    });

    const activeItems = items.filter(item => !(item.limit === 0 && item.spent === 0));

    activeItems.sort((a, b) => {
      let metricA = 0;
      let metricB = 0;
      if (sortMetric === 'budget') {
        metricA = a.limit;
        metricB = b.limit;
      } else if (sortMetric === 'spend') {
        metricA = a.spent;
        metricB = b.spent;
      } else if (sortMetric === 'remaining') {
        metricA = a.remaining;
        metricB = b.remaining;
      }
      return sortDirection === 'highest' ? metricB - metricA : metricA - metricB;
    });
    return activeItems;
  }, [categories, selectedMonthBudgets, spentByCategory, sortMetric, sortDirection]);

  // Pre-reconcile integers before subtraction to guarantee A - B = C in UI displays
  const displayTotalLimits = Math.round(totalLimits);
  const displayTotalSpent = Math.round(totalSpent);
  const availableFunds = Math.max(0, displayTotalLimits - displayTotalSpent);

  if (!isMounted) {
    return <div className="flex flex-col gap-6 text-left animate-pulse min-h-[300px] bg-white/20 rounded-3xl p-8" />;
  }

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in">
      
      {/* Month Picker Filter Bar */}
      <div className="flex justify-between items-center bg-white/40 backdrop-blur-md border border-white/20 rounded-full px-6 py-3 shadow-sm">
        <label htmlFor="budget-month-select" className="font-bold text-zen-charcoal text-sm m-0">
          Select Budget Month:
        </label>
        <input 
          id="budget-month-select"
          type="month" 
          value={selectedMonth} 
          onChange={e => setSelectedMonth(e.target.value)}
          className="px-4 py-2 rounded-full bg-white/80 border border-zen-lavender/60 text-zen-charcoal font-semibold text-sm outline-none cursor-pointer shadow-inner box-border"
        />
      </div>

      {/* Top Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Available Funds Card */}
        <div className="bg-white/60 backdrop-blur-xl border border-white/30 shadow-sm p-6 rounded-3xl flex flex-col justify-between items-start">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zen-charcoal/60 uppercase tracking-wider">Available Budget</span>
            <div className="text-4xl font-extrabold text-zen-charcoal my-2">
              {formatNoDecimalCurrency(availableFunds, displayCurrency)}
            </div>
            <span className="text-xs text-zen-charcoal/60">
              Total Limits ({formatNoDecimalCurrency(displayTotalLimits, displayCurrency)}) minus Spent ({formatNoDecimalCurrency(displayTotalSpent, displayCurrency)})
            </span>
          </div>
          
          <button 
            onClick={() => setIsAdjustOpen(true)}
            className="mt-4 px-6 py-2.5 bg-zen-charcoal text-zen-base rounded-full font-bold text-xs hover:bg-zen-charcoal/90 transition-all cursor-pointer border-none shadow-md"
          >
            Adjust Available Budget
          </button>
        </div>

        {/* Unallocated Budget Surplus Card */}
        <div className="bg-white/60 backdrop-blur-xl border border-white/30 shadow-sm p-6 rounded-3xl flex flex-col justify-between items-start">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zen-charcoal/60 uppercase tracking-wider">Unallocated Budget</span>
            <div className="text-4xl font-extrabold text-zen-sage/90 my-2">
              {formatNoDecimalCurrency(surplusAmount, displayCurrency)}
            </div>
          </div>
          
          <button 
            onClick={() => toggleOnboarding()}
            className="mt-4 px-6 py-2.5 bg-zen-charcoal text-zen-base rounded-full font-bold text-xs hover:bg-zen-charcoal/90 transition-all cursor-pointer border-none shadow-md disabled:opacity-40"
          >
            Allocate
          </button>
        </div>

      </div>

      {isAdjustOpen && (
        <AdjustMasterBudgetModal 
          isOpen={isAdjustOpen} 
          onClose={() => setIsAdjustOpen(false)} 
          targetMonth={selectedMonth} 
          initialAmount={surplusAmount} 
        />
      )}

      {/* Capacity Indicators List */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center relative">
          <h3 className="font-bold text-lg text-zen-charcoal m-0">Category Budgets</h3>
          
          {/* Sort popover trigger pill */}
          <div ref={sortPopoverRef} className="relative">
            <button
              type="button"
              onClick={() => setIsSortOpen(!isSortOpen)}
              style={{ minHeight: 0 }}
              className="px-4 py-2 rounded-full border border-zen-lavender/30 bg-white/60 backdrop-blur-md text-zen-charcoal text-xs font-bold flex items-center gap-1.5 hover:bg-white/80 transition-all shadow-xs cursor-pointer"
            >
              <ListFilter size={14} className="text-zen-charcoal/60" />
              <span className="capitalize">
                Sort: {sortDirection} {sortMetric}
              </span>
              <ChevronDown size={12} className={`text-zen-charcoal/50 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Absolute 2-Axis Sort Popover */}
            {isSortOpen && (
              <div className="absolute right-0 top-10 z-50 bg-white/95 backdrop-blur-xl border border-zen-lavender/40 shadow-xl rounded-3xl p-4 flex items-stretch gap-4 text-xs text-zen-charcoal font-semibold min-w-[220px] animate-scale-up">
                {/* Column 1: Direction */}
                <div className="flex flex-col gap-2.5 flex-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="budgetSortDir"
                      checked={sortDirection === 'highest'}
                      onChange={() => setSortDirection('highest')}
                      className="w-3.5 h-3.5 accent-zen-sage"
                    />
                    Highest
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="budgetSortDir"
                      checked={sortDirection === 'lowest'}
                      onChange={() => setSortDirection('lowest')}
                      className="w-3.5 h-3.5 accent-zen-sage"
                    />
                    Lowest
                  </label>
                </div>

                {/* Divider */}
                <div className="w-[1px] bg-zen-lavender/30 self-stretch mx-1" />

                {/* Column 2: Metric */}
                <div className="flex flex-col gap-2.5 flex-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="budgetSortMetric"
                      checked={sortMetric === 'budget'}
                      onChange={() => setSortMetric('budget')}
                      className="w-3.5 h-3.5 accent-zen-sage"
                    />
                    Budget
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="budgetSortMetric"
                      checked={sortMetric === 'spend'}
                      onChange={() => setSortMetric('spend')}
                      className="w-3.5 h-3.5 accent-zen-sage"
                    />
                    Spend
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="budgetSortMetric"
                      checked={sortMetric === 'remaining'}
                      onChange={() => setSortMetric('remaining')}
                      className="w-3.5 h-3.5 accent-zen-sage"
                    />
                    Remaining
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {sortedCategories.map(({ category: cat, limit, spent }) => {
          const isOver = spent > limit && limit > 0;
          
          // Pre-reconcile integers before subtraction
          const displayLimit = Math.round(limit);
          const displaySpent = Math.round(spent);
          const displayRemaining = Math.max(0, displayLimit - displaySpent);
          
          // Decoupled actual percentage from progress bar width clamping for accessible semantics
          const actualPercentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
          const barWidth = Math.min(100, actualPercentage);

          return (
            <div key={cat.id} className="bg-white/60 backdrop-blur-xl border border-white/30 p-5 rounded-3xl flex flex-col gap-3 shadow-sm">
              
              <div className="flex justify-between items-center">
                <span className="font-bold text-base text-zen-charcoal flex items-center gap-2">
                  {cat.icon && <Tag size={16} className="text-zen-charcoal/60" />}
                  {cat.name}
                  <span className="text-xs font-normal text-zen-charcoal/60">({actualPercentage}%)</span>
                </span>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zen-charcoal/70">
                    Spent {formatNoDecimalCurrency(displaySpent, displayCurrency)} of {formatNoDecimalCurrency(displayLimit, displayCurrency)}
                  </span>
                </div>
              </div>

              {/* Fully Accessible Capacity Bar */}
              <div 
                role="progressbar"
                aria-valuenow={Math.min(100, actualPercentage)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Budget utilization for ${cat.name}`}
                className="relative w-full h-3 bg-zen-lavender/20 rounded-full overflow-hidden border border-zen-lavender/30 shadow-inner"
              >
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${isOver ? 'bg-amber-500' : 'bg-zen-sage'}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              {/* Accessibility Context / Descriptive Status Text */}
              <div className="flex justify-between items-center text-xs font-medium text-zen-charcoal/80">
                <span>
                  {isOver ? (
                    <span className="text-amber-600 font-bold">Over Budget</span>
                  ) : (
                    <span>{formatNoDecimalCurrency(displayRemaining, displayCurrency)} remaining</span>
                  )}
                </span>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
