/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useState, useMemo, useRef, useOptimistic, useActionState } from 'react';
import { saveBulkBudgets } from '@/app/actions/budget';
import { formatFriendlyCurrency, getCurrencySymbol, CURRENCY_CONFIG, convertAmount } from '@/lib/utils';
import { ChevronDown, ChevronUp, Copy, RefreshCw, AlertCircle, Tag } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TargetMonthSelectionModal from './TargetMonthSelectionModal';

interface BudgetDTO {
  id: string;
  category_id: string | null;
  limit_amount: number;
  currency: string;
  month: string;
}

interface CategoryDTO {
  id: string;
  name: string;
  icon: string | null;
}

interface BudgetPlannerProps {
  initialBudgets: BudgetDTO[];
  categories: CategoryDTO[];
  displayCurrency: string;
  initialYear: string;
  exchangeRates?: Record<string, number>;
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function BudgetPlanner({
  initialBudgets,
  categories,
  displayCurrency,
  initialYear,
  exchangeRates = { CAD: 1.0 }
}: BudgetPlannerProps) {
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set([0]));
  const [announcement, setAnnouncement] = useState('');
  const [selectionModalState, setSelectionModalState] = useState<{ isOpen: boolean; sourceMonthStr: string; sourceMonthIndex: number } | null>(null);
  const [optimisticVersion, setOptimisticVersion] = useState(0);
  const router = useRouter();

  const handleYearChange = (newYear: string) => {
    setSelectedYear(newYear);
    router.push(`/budget?year=${newYear}`);
  };

  const availableYears = useMemo(() => {
    const curr = new Date().getFullYear();
    return [String(curr - 2), String(curr - 1), String(curr), String(curr + 1), String(curr + 2)];
  }, []);

  const [optimisticBudgets, setOptimisticBudgets] = useOptimistic(
    initialBudgets,
    (state: BudgetDTO[], update: { targetMonths: string[]; allocations: BudgetDTO[] }) => {
      const filtered = state.filter(b => !update.targetMonths.includes(b.month));
      return [...filtered, ...update.allocations];
    }
  );

  const toggleExpandAll = () => {
    if (expandedMonths.size === 12) {
      setExpandedMonths(new Set());
      setAnnouncement(`Collapsed all month accordions. [${Date.now()}]`);
    } else {
      setExpandedMonths(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
      setAnnouncement(`Expanded all month accordions. [${Date.now()}]`);
    }
  };

  const toggleMonth = (index: number) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const headerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (index + 1) % 12;
      headerRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (index - 1 + 12) % 12;
      headerRefs.current[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      headerRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      headerRefs.current[11]?.focus();
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [copyState, copyAction, isCopyPending] = useActionState(
    async (_prevState: any, _formData: FormData) => {
      const prevYear = String(parseInt(selectedYear) - 1);
      const prevDecember = `${prevYear}-12`;
      const sourceBudgets = initialBudgets.filter(b => b.month === prevDecember);

      if (sourceBudgets.length === 0) {
        return { success: false, error: `No budget records found for December ${prevYear}.` };
      }

      const targetMonths = Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`);
      const payload = sourceBudgets.map(b => ({
        category_id: b.category_id,
        limit_amount: b.limit_amount,
        currency: displayCurrency
      }));

      const optimisticAdditions: BudgetDTO[] = [];
      targetMonths.forEach(m => {
        sourceBudgets.forEach((b, idx) => {
          optimisticAdditions.push({
            id: `opt-${m}-${idx}`,
            category_id: b.category_id,
            limit_amount: b.limit_amount,
            currency: displayCurrency,
            month: m
          });
        });
      });
      setOptimisticBudgets({ targetMonths, allocations: optimisticAdditions });

      const res = await saveBulkBudgets(prevDecember, targetMonths, payload);
      if (res.success) {
        setAnnouncement(`Successfully copied monthly budget from ${prevYear} into all 12 months of ${selectedYear}. [${Date.now()}]`);
        setOptimisticVersion(v => v + 1); // Force remount of all months
        return { success: true };
      } else {
        return { success: false, error: res.error || 'Failed to copy monthly budget.' };
      }
    },
    { success: false }
  );

  const activeYearBudgets = useMemo(() => {
    return optimisticBudgets.filter(b => b.month.startsWith(selectedYear));
  }, [optimisticBudgets, selectedYear]);

  const isYearEmpty = activeYearBudgets.length === 0;

  return (
    <div data-testid="budget-planner-root" className="flex flex-col gap-6 text-left animate-fade-in pb-16 scroll-pt-[120px]">
      
      {/* Top Navigation Header */}
      <div className="flex items-center justify-between">
        <Link 
          href="/dashboard" 
          className="flex items-center gap-2 text-zen-charcoal hover:opacity-80 transition-all text-sm font-semibold no-underline cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex items-center gap-3">
          <label htmlFor="planner-year-select" className="font-bold text-zen-charcoal text-sm m-0">
            Planning Year:
          </label>
          <select 
            id="planner-year-select" 
            value={selectedYear} 
            onChange={e => handleYearChange(e.target.value)}
            className="px-4 py-2 bg-white/60 border border-zen-lavender/60 rounded-full text-zen-charcoal text-sm font-bold outline-none cursor-pointer appearance-none h-11 box-border min-w-[44px]"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Sticky Global Utility Toolbar (Expand All & Copy ceilings) */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border border-white/40 shadow-md rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 transition-all">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={toggleExpandAll}
            className="px-4 py-2.5 min-h-[44px] bg-white/60 border border-zen-lavender/40 text-zen-charcoal rounded-full font-bold hover:bg-white/80 transition-all text-xs cursor-pointer shadow-xs"
          >
            {expandedMonths.size === 12 ? 'Collapse All' : 'Expand All'}
          </button>
          <span className="text-xs text-zen-charcoal/60 font-semibold">
            {expandedMonths.size} of 12 months expanded
          </span>
        </div>

        <form action={copyAction} className="flex items-center">
          <button 
            type="submit"
            disabled={isCopyPending}
            className={`px-5 py-2.5 min-h-[44px] rounded-full font-bold text-xs flex items-center gap-2 transition-all border-none shadow-sm cursor-pointer disabled:opacity-40 ${
              isYearEmpty ? 'bg-zen-sage text-zen-charcoal animate-pulse' : 'bg-zen-charcoal text-zen-base hover:bg-zen-charcoal/90'
            }`}
          >
            <Copy size={14} />
            <span>{isCopyPending ? 'Copying...' : `Copy monthly budget from ${parseInt(selectedYear) - 1}`}</span>
          </button>
        </form>
      </div>

      {/* Screen Reader Polite Announcer */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {copyState.error && (
        <div className="p-4 bg-zen-peach/20 border border-zen-peach text-zen-charcoal rounded-2xl text-sm font-semibold flex items-center gap-2">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span>{copyState.error}</span>
        </div>
      )}

      {/* Form-per-Accordion List */}
      <div className="flex flex-col gap-4">
        {MONTH_LABELS.map((monthName, idx) => {
          const monthStr = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
          const isOpen = expandedMonths.has(idx);
          
          return (
            <MonthAccordionForm
              // React Key Reset: Remount accordion form cleanly on display currency or database budgets propagation changes
              key={`${monthStr}-${displayCurrency}-${optimisticVersion}`}
              monthStr={monthStr}
              monthName={monthName}
              isOpen={isOpen}
              onToggle={() => toggleMonth(idx)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              headerRef={(el) => { headerRefs.current[idx] = el; }}
              optimisticBudgets={optimisticBudgets}
              setOptimisticBudgets={setOptimisticBudgets}
              categories={categories}
              displayCurrency={displayCurrency}
              exchangeRates={exchangeRates}
              setAnnouncement={setAnnouncement}
              onOpenSelectionModal={() => setSelectionModalState({ isOpen: true, sourceMonthStr: monthStr, sourceMonthIndex: idx })}
              optimisticVersion={optimisticVersion}
            />
          );
        })}
      </div>

      {selectionModalState && (
        <TargetMonthSelectionModal
          isOpen={selectionModalState.isOpen}
          onClose={() => setSelectionModalState(null)}
          onSuccess={() => { setSelectionModalState(null); setOptimisticVersion(v => v + 1); }}
          sourceMonthStr={selectionModalState.sourceMonthStr}
          sourceMonthIndex={selectionModalState.sourceMonthIndex}
          selectedYear={selectedYear}
          optimisticBudgets={optimisticBudgets}
          setOptimisticBudgets={setOptimisticBudgets}
          displayCurrency={displayCurrency}
          setAnnouncement={setAnnouncement}
        />
      )}

    </div>
  );
}

interface MonthAccordionFormProps {
  monthStr: string;
  monthName: string;
  isOpen: boolean;
  onToggle: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  headerRef: (el: HTMLButtonElement | null) => void;
  optimisticBudgets: BudgetDTO[];
  setOptimisticBudgets: (update: { targetMonths: string[]; allocations: BudgetDTO[] }) => void;
  categories: CategoryDTO[];
  displayCurrency: string;
  exchangeRates?: Record<string, number>;
  setAnnouncement: (msg: string) => void;
  onOpenSelectionModal: () => void;
  optimisticVersion: number;
}

const activeSubmissions = new Set<string>();

function MonthAccordionForm({
  monthStr,
  monthName,
  isOpen,
  onToggle,
  onKeyDown,
  headerRef,
  optimisticBudgets,
  setOptimisticBudgets,
  categories,
  displayCurrency,
  exchangeRates = { CAD: 1.0 },
  setAnnouncement,
  onOpenSelectionModal,
  optimisticVersion
}: MonthAccordionFormProps) {
  // Memoize budget items corresponding exclusively to this accordion's month
  const monthBudgetsFiltered = useMemo(() => {
    return optimisticBudgets.filter(b => b.month === monthStr);
  }, [optimisticBudgets, monthStr]);

  // 1. Header Calculations: derived directly from monthBudgets prop for scannable closed indicators
  const headerTotalBudget = useMemo(() => {
    return monthBudgetsFiltered.reduce((sum, b) => sum + convertAmount(b.limit_amount, b.currency || 'CAD', displayCurrency, exchangeRates), 0);
  }, [monthBudgetsFiltered, displayCurrency, exchangeRates]);

  const headerAllocatedTotal = useMemo(() => {
    return monthBudgetsFiltered
      .filter(b => b.category_id !== null)
      .reduce((sum, b) => sum + convertAmount(b.limit_amount, b.currency || 'CAD', displayCurrency, exchangeRates), 0);
  }, [monthBudgetsFiltered, displayCurrency, exchangeRates]);

  const headerAllocatedPercent = useMemo(() => {
    if (headerTotalBudget <= 0) return 0;
    return (headerAllocatedTotal / headerTotalBudget) * 100;
  }, [headerAllocatedTotal, headerTotalBudget]);

  const headerUnallocated = useMemo(() => {
    return Math.round((headerTotalBudget - headerAllocatedTotal) * 100) / 100;
  }, [headerTotalBudget, headerAllocatedTotal]);

  // 2. Lazy State Initializers: Hydrated once on initial mount
  const [totalBudgetStr, setTotalBudgetStr] = useState(() => {
    if (monthBudgetsFiltered.length > 0) {
      const total = monthBudgetsFiltered.reduce((sum, b) => {
        return sum + convertAmount(b.limit_amount, b.currency || 'CAD', displayCurrency, exchangeRates);
      }, 0);
      return total.toString();
    }
    return '2000';
  });

  // allocations stores raw keystroke strings to prevent intermediate decimal/empty swallowing
  const [allocations, setAllocations] = useState<Record<string, string>>(() => {
    const allocMap: Record<string, string> = {};
    if (monthBudgetsFiltered.length > 0) {
      monthBudgetsFiltered.forEach(b => {
        if (b.category_id) {
          allocMap[b.category_id] = convertAmount(b.limit_amount, b.currency || 'CAD', displayCurrency, exchangeRates).toString();
        }
      });
    }
    return allocMap;
  });

  const totalBudget = parseFloat(totalBudgetStr) || 0;

  const allocatedTotal = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => {
      const amt = parseFloat(val) || 0;
      return sum + amt;
    }, 0);
  }, [allocations]);

  // Unallocated is rounded to 2 decimal places to resolve floating point subtraction offsets
  const unallocated = useMemo(() => {
    return Math.round((totalBudget - allocatedTotal) * 100) / 100;
  }, [totalBudget, allocatedTotal]);

  const allocatedPercent = useMemo(() => {
    if (totalBudget <= 0) return 0;
    return (allocatedTotal / totalBudget) * 100;
  }, [allocatedTotal, totalBudget]);

  const handleAllocationChange = (categoryId: string, value: string) => {
    // Decouple hard-clamping inside planner inputs to allow over-allocation intermediate states
    setAllocations(prev => ({ ...prev, [categoryId]: value }));
  };

  // React 19 useActionState using semantic hidden accordion form payloads
  const [state, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      activeSubmissions.add(monthStr);

      try {
        const allocMap = JSON.parse(formData.get('allocationsPayload') as string);
        const unalloc = parseFloat(formData.get('unallocatedPayload') as string) || 0;

        const payload: { category_id: string | null; limit_amount: number; currency: string }[] = categories.map(cat => ({
          category_id: cat.id,
          // Parse raw string values back to numbers on submit
          limit_amount: parseFloat(allocMap[cat.id] || '0') || 0,
          currency: displayCurrency
        }));
        payload.push({
          category_id: null,
          limit_amount: unalloc,
          currency: displayCurrency
        });

        const targetMonths = [monthStr];

        const optimisticAdditions: BudgetDTO[] = [];
        targetMonths.forEach(m => {
          payload.forEach((b, idx) => {
            optimisticAdditions.push({
              id: `opt-${m}-${idx}`,
              category_id: b.category_id,
              limit_amount: b.limit_amount,
              currency: displayCurrency,
              month: m
            });
          });
        });
        setOptimisticBudgets({ targetMonths, allocations: optimisticAdditions });

        const res = await saveBulkBudgets(monthStr, targetMonths, payload);
        if (res.success) {
          setAnnouncement(`Saved ${monthName} budget. [${Date.now()}]`);
          return { success: true };
        } else {
          return { success: false, error: res.error || 'Failed to update budget.' };
        }
      } finally {
        activeSubmissions.delete(monthStr);
      }
    },
    { success: false }
  );

  const statusBadge = monthBudgetsFiltered.length > 0
    ? headerUnallocated < 0 
      ? { label: 'Over Ceil', className: 'bg-red-50 text-red-600 border border-red-200/60' }
      : headerUnallocated === 0
        ? { label: 'Balanced', className: 'bg-zen-sage/25 text-zen-sage border border-zen-sage/30' }
        : { label: 'Active', className: 'bg-white/80 text-zen-charcoal border border-zen-lavender/30' }
    : { label: 'Not Configured', className: 'bg-zen-lavender/10 text-zen-charcoal/50 border border-zen-lavender/20' };

  return (
    <div className="bg-white/60 backdrop-blur-xl border border-white/30 shadow-sm rounded-3xl overflow-hidden transition-all">
      <button
        type="button"
        id={`header-${monthStr}`}
        aria-expanded={isOpen}
        aria-controls={`panel-${monthStr}`}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        ref={headerRef}
        className="w-full px-6 py-5 bg-transparent border-none flex items-center justify-between cursor-pointer hover:bg-white/40 transition-colors text-left outline-none focus-visible:ring-2 focus-visible:ring-zen-sage"
      >
        <div className="flex items-center gap-4">
          <span className="font-bold text-lg text-zen-charcoal">{monthName}</span>
          <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          {/* Header Micro Progress Bar (Collapsed State Overview) */}
          {monthBudgetsFiltered.length > 0 && (
            <div className="hidden sm:flex items-center gap-2.5">
              <div 
                role="progressbar"
                aria-valuenow={Math.max(0, Math.min(headerAllocatedPercent, 100))}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Accordion header allocation progress"
                className="w-20 md:w-28 h-2 bg-zen-lavender/15 rounded-full overflow-hidden border border-zen-lavender/20 shadow-inner relative"
              >
                <div 
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    headerUnallocated < 0 
                      ? 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.3)]' 
                      : headerAllocatedPercent === 100 
                        ? 'bg-zen-sage shadow-[0_0_6px_rgba(163,230,53,0.2)]' 
                        : 'bg-zen-sage/80'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(headerAllocatedPercent, 100))}%` }}
                />
              </div>
              <span className={`text-[10px] font-extrabold tracking-wider ${
                headerUnallocated < 0 ? 'text-red-500' : 'text-zen-charcoal/50'
              }`}>
                {headerAllocatedPercent.toFixed(0)}%
              </span>
            </div>
          )}

          <span className="text-sm font-bold text-zen-charcoal/70">
            {monthBudgetsFiltered.length > 0 ? formatFriendlyCurrency(headerTotalBudget, displayCurrency) : 'Not Set'}
          </span>
          {isOpen ? <ChevronUp size={20} className="text-zen-charcoal/60" /> : <ChevronDown size={20} className="text-zen-charcoal/60" />}
        </div>
      </button>

      {isOpen && (
        <div 
          id={`panel-${monthStr}`}
          role="region"
          aria-labelledby={`header-${monthStr}`}
          className="px-6 pb-6 text-left animate-fade-in border-t border-white/20 pt-4 flex flex-col gap-6"
        >
          {state.error && (
            <div className="p-4 bg-zen-peach/20 border border-zen-peach text-zen-charcoal rounded-2xl text-sm font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <form action={formAction} className="flex flex-col gap-6">
            {/* Hidden Semantic Payload Inputs */}
            <input type="hidden" name="allocationsPayload" value={JSON.stringify(allocations)} />
            <input type="hidden" name="totalBudgetPayload" value={totalBudget} />
            <input type="hidden" name="unallocatedPayload" value={unallocated} />

            {/* Accordion Ceilings Summaries */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/40 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col items-start shadow-3xs justify-between min-h-[90px] box-border">
                <span className="text-xs font-semibold text-zen-charcoal/60 uppercase tracking-wider">Target Ceiling</span>
                <div className="flex items-center bg-white/70 border border-zen-lavender/40 rounded-xl px-3 py-1 shadow-inner w-full max-w-[160px] box-border my-1 focus-within:ring-2 focus-within:ring-zen-sage focus-within:border-transparent">
                  {CURRENCY_CONFIG[displayCurrency]?.position !== 'suffix' && (
                    <span className="text-xs font-bold text-zen-charcoal mr-1">{getCurrencySymbol(displayCurrency)}</span>
                  )}
                  <input 
                    type="number" 
                    value={totalBudgetStr}
                    onChange={e => setTotalBudgetStr(e.target.value)}
                    disabled={isPending}
                    className="w-full bg-transparent border-none text-left text-base font-extrabold text-zen-charcoal outline-none appearance-none m-0 disabled:opacity-40"
                    placeholder="0"
                  />
                  {CURRENCY_CONFIG[displayCurrency]?.position === 'suffix' && (
                    <span className="text-xs font-bold text-zen-charcoal ml-1">{getCurrencySymbol(displayCurrency)}</span>
                  )}
                </div>
              </div>

              <div className="bg-white/40 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col items-start shadow-3xs justify-between min-h-[90px] box-border">
                <span className="text-xs font-semibold text-zen-charcoal/60 uppercase tracking-wider">Allocated</span>
                <span className="text-xl font-extrabold text-zen-charcoal/90 my-1 flex items-center h-9">
                  {formatFriendlyCurrency(allocatedTotal, displayCurrency)}
                </span>
              </div>

              <div className="bg-white/40 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col items-start shadow-3xs justify-between min-h-[90px] box-border">
                <span className="text-xs font-semibold text-zen-charcoal/60 uppercase tracking-wider">Unallocated Pool</span>
                <span className="text-xl font-extrabold text-zen-sage/90 my-1 flex items-center h-9">
                  {formatFriendlyCurrency(unallocated, displayCurrency)}
                </span>
              </div>
            </div>

            {/* Parity Expanded Utilization Progress Card (Real-time Feedback) */}
            {totalBudget > 0 && (
              <div className="flex flex-col gap-3 bg-gradient-to-br from-zen-lavender/10 via-white/40 to-zen-peach/10 p-4 rounded-2xl border border-white/40 shadow-xs transition-all duration-300 my-2">
                <div className="flex justify-between items-end">
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[10px] font-bold text-zen-charcoal/40 uppercase tracking-wider">
                      Active Distribution
                    </span>
                    <span className="text-xs font-bold text-zen-charcoal/70 flex items-center gap-1.5">
                      <span>Allocated:</span>
                      <span className="font-extrabold text-zen-charcoal">
                        {formatFriendlyCurrency(allocatedTotal, displayCurrency)}
                      </span>
                      <span className="text-zen-charcoal/40 font-medium">of</span>
                      <span className="font-semibold text-zen-charcoal/60">
                        {formatFriendlyCurrency(totalBudget, displayCurrency)}
                      </span>
                    </span>
                  </div>
                  
                  <span className={`text-xs font-extrabold tracking-wide px-2.5 py-1 rounded-lg shadow-2xs transition-all duration-300 ${
                    unallocated < 0 
                      ? 'text-red-600 bg-red-50 border border-red-200/60' 
                      : unallocated === 0
                        ? 'text-zen-sage bg-zen-sage/20 border border-zen-sage/30'
                        : 'text-zen-charcoal bg-white/80 border border-zen-lavender/30'
                  }`}>
                    {allocatedPercent.toFixed(0)}%
                  </span>
                </div>

                {/* Accordion expanded utilization progress track */}
                <div 
                  role="progressbar"
                  aria-valuenow={Math.max(0, Math.min(allocatedPercent, 100))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Accordion allocation utilization percentage"
                  className="w-full h-2.5 bg-zen-lavender/10 rounded-full overflow-hidden border border-zen-lavender/25 shadow-inner relative"
                >
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                      unallocated < 0 
                        ? 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.4)]' 
                        : allocatedPercent === 100 
                          ? 'bg-zen-sage shadow-[0_0_10px_rgba(163,230,53,0.3)]' 
                          : 'bg-zen-sage/85'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(allocatedPercent, 100))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-semibold transition-all duration-300">
                  {unallocated < 0 ? (
                    <span className="text-red-500 flex items-center gap-1 animate-pulse">
                      ⚠️ Allocations exceed ceiling by {formatFriendlyCurrency(Math.abs(unallocated), displayCurrency)}
                    </span>
                  ) : unallocated === 0 && totalBudget > 0 ? (
                    <span className="text-zen-sage flex items-center gap-1 font-bold">
                      ✓ Fully allocated! Perfect harmony achieved.
                    </span>
                  ) : unallocated > 0 && totalBudget > 0 ? (
                    <span className="text-zen-charcoal/50">
                      ✨ {formatFriendlyCurrency(unallocated, displayCurrency)} remaining for other intentions
                    </span>
                  ) : (
                    <span className="text-zen-charcoal/40">
                      Enter a ceiling limit above to balance your categories.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Clean Category Rows without sliders */}
            <div className="flex flex-col gap-3 max-h-[40dvh] overflow-y-auto pr-2">
              {categories.map(cat => {
                const val = allocations[cat.id] || '';
                const labelId = `cat-label-${monthStr}-${cat.id}`;
                return (
                  <div 
                    key={cat.id} 
                    className="flex justify-between items-center gap-4 bg-white/40 hover:bg-white/60 p-3 sm:p-4 rounded-2xl border border-white/20 shadow-xs hover:shadow-sm transition-all duration-200"
                  >
                    {/* Category Label & Icon */}
                    <span id={labelId} className="font-bold text-sm text-zen-charcoal flex items-center gap-3 truncate min-w-0 flex-1">
                      <span className="w-8 h-8 rounded-xl bg-zen-lavender/15 flex items-center justify-center text-zen-charcoal/70 shrink-0">
                        <Tag size={16} />
                      </span>
                      <span className="truncate tracking-wide text-zen-charcoal/90 font-bold">
                        {cat.name}
                      </span>
                    </span>

                    {/* Input field with focus borders */}
                    <div className="flex items-center bg-white/70 border border-zen-lavender/40 rounded-xl px-3 py-1.5 min-h-[44px] focus-within:ring-2 focus-within:ring-zen-sage/60 focus-within:border-transparent hover:border-zen-lavender/60 transition-all shadow-inner shrink-0">
                      {CURRENCY_CONFIG[displayCurrency]?.position !== 'suffix' && (
                        <span className="text-xs font-extrabold text-zen-charcoal/40 mr-1 select-none">
                          {getCurrencySymbol(displayCurrency)}
                        </span>
                      )}
                      <input 
                        type="text" 
                        inputMode="decimal"
                        pattern="^[0-9]*\.?[0-9]*$"
                        aria-labelledby={labelId}
                        value={val} 
                        onChange={e => handleAllocationChange(cat.id, e.target.value)}
                        disabled={isPending}
                        className="w-16 bg-transparent border-none text-right text-sm font-extrabold text-zen-charcoal outline-none appearance-none disabled:opacity-40 focus:ring-0"
                        placeholder="0"
                      />
                      {CURRENCY_CONFIG[displayCurrency]?.position === 'suffix' && (
                        <span className="text-xs font-extrabold text-zen-charcoal/40 ml-1 select-none">
                          {getCurrencySymbol(displayCurrency)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions Section (Save Month & Propagate) */}
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <button
                type="button"
                disabled={isPending}
                onClick={onOpenSelectionModal}
                className="flex-1 py-3.5 px-5 bg-white/60 border border-zen-lavender/40 text-zen-charcoal hover:bg-white/80 rounded-full font-bold text-sm transition-all cursor-pointer disabled:opacity-40"
              >
                Apply to other months...
              </button>
              <button 
                type="submit"
                disabled={isPending || unallocated < 0}
                className="flex-1 py-3.5 px-5 bg-zen-charcoal text-zen-base hover:bg-zen-charcoal/90 rounded-full font-bold text-sm transition-all cursor-pointer disabled:opacity-40 border-none shadow-md"
              >
                {isPending ? 'Saving...' : 'Save Month'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
