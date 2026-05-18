'use client';
import { useState, useMemo, useEffect, useRef, useOptimistic, useActionState } from 'react';
import { saveBulkBudgets } from '@/app/actions/budget';
import { formatFriendlyCurrency, getCurrencySymbol, CURRENCY_CONFIG } from '@/lib/utils';
import { Tag, ChevronDown, ChevronUp, Copy, RefreshCw, AlertCircle } from 'lucide-react';
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
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function BudgetPlanner({
  initialBudgets,
  categories,
  displayCurrency,
  initialYear
}: BudgetPlannerProps) {
  const [selectedYear, setSelectedYear] = useState(initialYear);
  // Deterministic initial state: January (0) expanded by default
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

  const [copyState, copyAction, isCopyPending] = useActionState(
    async (prevState: any, formData: FormData) => {
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

      {/* Sticky Global Utility Toolbar */}
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
              key={monthStr}
              monthStr={monthStr}
              monthName={monthName}
              monthIndex={idx}
              isOpen={isOpen}
              onToggle={() => toggleMonth(idx)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              headerRef={(el) => { headerRefs.current[idx] = el; }}
              optimisticBudgets={optimisticBudgets}
              setOptimisticBudgets={setOptimisticBudgets}
              categories={categories}
              displayCurrency={displayCurrency}
              selectedYear={selectedYear}
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
  monthIndex: number;
  isOpen: boolean;
  onToggle: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  headerRef: (el: HTMLButtonElement | null) => void;
  optimisticBudgets: BudgetDTO[];
  setOptimisticBudgets: (update: { targetMonths: string[]; allocations: BudgetDTO[] }) => void;
  categories: CategoryDTO[];
  displayCurrency: string;
  selectedYear: string;
  setAnnouncement: (msg: string) => void;
  onOpenSelectionModal: () => void;
  optimisticVersion: number;
}

const activeSubmissions = new Set<string>();

function MonthAccordionForm({
  monthStr,
  monthName,
  monthIndex,
  isOpen,
  onToggle,
  onKeyDown,
  headerRef,
  optimisticBudgets,
  setOptimisticBudgets,
  categories,
  displayCurrency,
  selectedYear,
  setAnnouncement,
  onOpenSelectionModal,
  optimisticVersion
}: MonthAccordionFormProps) {
  const monthBudgets = useMemo(() => {
    return optimisticBudgets.filter(b => b.month === monthStr);
  }, [optimisticBudgets, monthStr]);

  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [totalBudgetStr, setTotalBudgetStr] = useState<string>('');

  const totalBudget = parseFloat(totalBudgetStr) || 0;
  const allocatedTotal = useMemo(() => {
    return Object.values(allocations).reduce((sum, amt) => sum + amt, 0);
  }, [allocations]);
  const unallocated = Math.max(0, totalBudget - allocatedTotal);

  const handleAllocationChange = (categoryId: string, value: string) => {
    const amt = parseFloat(value) || 0;
    setAllocations(prev => {
      const currentOtherTotal = Object.entries(prev)
        .filter(([id]) => id !== categoryId)
        .reduce((sum, [, v]) => sum + v, 0);

      const maxAllowed = Math.max(0, totalBudget - currentOtherTotal);
      const clampedAmt = Math.min(amt, maxAllowed);

      return { ...prev, [categoryId]: clampedAmt };
    });
  };

  const statusBadge = useMemo(() => {
    if (monthBudgets.length === 0) {
      return { label: 'Empty', className: 'bg-zen-lavender/20 text-zen-charcoal/70 border border-zen-lavender/40' };
    }
    return { label: 'Allocated', className: 'bg-zen-sage/30 text-zen-charcoal border border-zen-sage' };
  }, [monthBudgets]);

  const [state, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      if (activeSubmissions.has(monthStr)) return prevState;
      activeSubmissions.add(monthStr);

      try {
        const allocMap = JSON.parse(formData.get('allocationsPayload') as string);
        const unalloc = parseFloat(formData.get('unallocatedPayload') as string) || 0;

        const payload: { category_id: string | null; limit_amount: number; currency: string }[] = categories.map(cat => ({
          category_id: cat.id,
          limit_amount: allocMap[cat.id] || 0,
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

  const prevSyncKeyRef = useRef<string | null>(null);
  const currentSyncKey = `${monthStr}-${optimisticVersion}`;

  // Derive local state when accordion opens, month changes, or external propagation occurs, completely immune to intermediate transition commits
  useEffect(() => {
    if (isOpen && !activeSubmissions.has(monthStr) && !state.error) {
      if (prevSyncKeyRef.current !== currentSyncKey || Object.keys(allocations).length === 0) {
        prevSyncKeyRef.current = currentSyncKey;
        if (monthBudgets.length > 0) {
          const total = monthBudgets.reduce((sum, b) => sum + b.limit_amount, 0);
          setTotalBudgetStr(total.toString());
          
          const allocMap: Record<string, number> = {};
          monthBudgets.forEach(b => {
            if (b.category_id) {
              allocMap[b.category_id] = b.limit_amount;
            }
          });
          setAllocations(allocMap);
        } else {
          setTotalBudgetStr('2000');
          setAllocations({});
        }
      }
    }
  }, [isOpen, monthBudgets, state.error, currentSyncKey]);

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

        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-zen-charcoal/70">
            {monthBudgets.length > 0 ? formatFriendlyCurrency(monthBudgets.reduce((s, b) => s + b.limit_amount, 0), displayCurrency) : 'Not Set'}
          </span>
          {isOpen ? <ChevronUp size={20} className="text-zen-charcoal/60" /> : <ChevronDown size={20} className="text-zen-charcoal/60" />}
        </div>
      </button>

      {isOpen && (
        <div
          id={`panel-${monthStr}`}
          role="region"
          aria-labelledby={`header-${monthStr}`}
          className="px-6 pb-6 pt-2 border-t border-zen-lavender/20 animate-fade-in"
        >
          <form action={formAction} className="flex flex-col gap-6">
            <input type="hidden" name="allocationsPayload" value={JSON.stringify(allocations)} />
            <input type="hidden" name="unallocatedPayload" value={unallocated} />
            
            {state.error && (
              <div className="p-4 bg-zen-peach/20 border border-zen-peach text-zen-charcoal rounded-2xl text-sm font-semibold flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-600 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor={`total-ceil-${monthStr}`} className="text-xs font-bold text-zen-charcoal/60 uppercase tracking-wider">
                  Total Ceiling Limit ({displayCurrency})
                </label>
                <input 
                  id={`total-ceil-${monthStr}`}
                  type="number" 
                  placeholder="0.00"
                  value={totalBudgetStr}
                  onChange={e => setTotalBudgetStr(e.target.value)}
                  disabled={isPending}
                  className="px-4 py-3 bg-white/60 border border-zen-lavender/40 rounded-full text-zen-charcoal text-base font-bold outline-none h-12 box-border disabled:opacity-40"
                />
              </div>

              <div className="flex flex-col gap-1 justify-center items-start bg-white/40 p-4 rounded-2xl border border-white/20">
                <span className="text-xs font-bold text-zen-charcoal/60 uppercase tracking-wider">
                  Unallocated Pool
                </span>
                <span className="text-2xl font-extrabold text-zen-sage/90 my-0">
                  {formatFriendlyCurrency(unallocated, displayCurrency)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto max-h-[40dvh] pr-2">
              {categories.map(cat => {
                const val = allocations[cat.id] || 0;
                const labelId = `cat-label-${monthStr}-${cat.id}`;
                return (
                  <div key={cat.id} className="flex flex-col gap-2 bg-white/40 p-3 sm:p-4 rounded-2xl border border-white/20">
                    <div className="flex justify-between items-center gap-2">
                      <span id={labelId} className="font-bold text-sm text-zen-charcoal flex items-center gap-2 truncate min-w-0 flex-1">
                        {cat.icon && <Tag size={16} className="text-zen-charcoal/60 shrink-0" />}
                        <span className="truncate">{cat.name}</span>
                      </span>
                      <div className="flex items-center bg-white/60 border border-zen-lavender/40 rounded-xl px-3 py-1.5 min-h-[44px] box-border shrink-0">
                        {CURRENCY_CONFIG[displayCurrency]?.position !== 'suffix' && (
                          <span className="text-xs font-bold text-zen-charcoal mr-1">{getCurrencySymbol(displayCurrency)}</span>
                        )}
                        <input 
                          type="text" 
                          inputMode="decimal"
                          pattern="^[0-9]*\.?[0-9]*$"
                          aria-labelledby={labelId}
                          value={val === 0 ? 0 : val} 
                          onChange={e => handleAllocationChange(cat.id, e.target.value)}
                          disabled={isPending}
                          className="w-16 bg-transparent border-none text-right text-sm font-bold text-zen-charcoal outline-none appearance-none disabled:opacity-40"
                          placeholder="0"
                        />
                        {CURRENCY_CONFIG[displayCurrency]?.position === 'suffix' && (
                          <span className="text-xs font-bold text-zen-charcoal ml-1">{getCurrencySymbol(displayCurrency)}</span>
                        )}
                      </div>
                    </div>
                    
                    <input 
                      type="range" 
                      aria-labelledby={labelId}
                      aria-label={`Adjust ${cat.name} allocation`}
                      min="0" 
                      max={totalBudget} 
                      step="10"
                      value={val}
                      onChange={e => handleAllocationChange(cat.id, e.target.value)}
                      disabled={isPending}
                      className="w-full accent-zen-sage cursor-pointer disabled:opacity-40 md:hidden"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3 justify-end mt-2">
              <button
                type="submit"
                name="actionType"
                value="save"
                disabled={isPending}
                className="px-6 py-3 bg-white/60 border border-zen-lavender/40 text-zen-charcoal rounded-full font-bold hover:bg-white/80 transition-all text-sm cursor-pointer shadow-xs disabled:opacity-40 flex items-center justify-center"
              >
                {isPending ? 'Saving...' : 'Save Month'}
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={onOpenSelectionModal}
                className="px-6 py-3 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-sm cursor-pointer border-none shadow-md disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} />
                <span>Apply to other months</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

