/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useState, useMemo, useActionState } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { saveBulkBudgets } from '@/app/actions/budget';
import { addCategoryAction, deleteCategoryAction } from '@/app/actions';
import { formatNoDecimalCurrency, parseLocalDate, getCurrencySymbol, CURRENCY_CONFIG, convertAmount, getRemainingMonths } from '@/lib/utils';
import { Tag, Trash2, Plus, X } from 'lucide-react';

const DEFAULT_CATEGORIES = ['Housing', 'Food & Dining', 'Transportation', 'Utilities', 'Personal/Entertainment'];

interface AdjustMasterBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetMonth: string; // YYYY-MM
  initialAmount: number;
}

export default function AdjustMasterBudgetModal({
  isOpen,
  onClose,
  targetMonth,
  initialAmount
}: AdjustMasterBudgetModalProps) {
  const { 
    categories, 
    displayCurrency,
    budgets,
    addCategory,
    removeCategory,
    exchangeRates
  } = useExpenseStore();

  // Lazy initialize form states synchronously on initial mount to prevent render loops or stale prop mismatches
  const [step, setStep] = useState(() => {
    const targetMonthBudgets = budgets.filter(b => b.month === targetMonth);
    return targetMonthBudgets.length > 0 ? 2 : 1;
  });

  const [totalBudgetStr, setTotalBudgetStr] = useState(() => {
    const targetMonthBudgets = budgets.filter(b => b.month === targetMonth);
    if (targetMonthBudgets.length > 0) {
      const total = targetMonthBudgets.reduce((sum, b) => {
        return sum + convertAmount(b.limit_amount, b.currency || 'CAD', displayCurrency, exchangeRates);
      }, 0);
      return total.toString();
    }
    return initialAmount > 0 ? initialAmount.toString() : '2000';
  });

  // allocations stores string values to cleanly preserve intermediate states (e.g., "0." or empty inputs)
  const [allocations, setAllocations] = useState<Record<string, string>>(() => {
    const targetMonthBudgets = budgets.filter(b => b.month === targetMonth);
    const allocMap: Record<string, string> = {};
    targetMonthBudgets.forEach(b => {
      if (b.category_id) {
        allocMap[b.category_id] = convertAmount(b.limit_amount, b.currency || 'CAD', displayCurrency, exchangeRates).toString();
      }
    });
    return allocMap;
  });

  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [applyToRemaining, setApplyToRemaining] = useState(false);

  const remainingMonths = useMemo(() => getRemainingMonths(targetMonth), [targetMonth]);
  const remainingMonthsCount = remainingMonths.length;

  const monthWord = useMemo(() => {
    const d = parseLocalDate(`${targetMonth}-01`);
    return isNaN(d.getTime()) ? targetMonth : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [targetMonth]);

  const totalBudget = parseFloat(totalBudgetStr) || 0;

  const displayCategories = useMemo(() => {
    const defaults = categories.filter(c => DEFAULT_CATEGORIES.includes(c.name));
    const custom = categories.filter(c => !DEFAULT_CATEGORIES.includes(c.name));
    return [...defaults, ...custom];
  }, [categories]);

  // allocatedTotal parses the string allocations dynamically for calculations
  const allocatedTotal = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => {
      const amt = parseFloat(val) || 0;
      return sum + amt;
    }, 0);
  }, [allocations]);

  // Unallocated is rounded to 2 decimal places to resolve floating-point subtract errors (e.g., 100.30 - 50.10 - 50.20 = -1e-14)
  const unallocated = useMemo(() => {
    return Math.round((totalBudget - allocatedTotal) * 100) / 100;
  }, [totalBudget, allocatedTotal]);

  const allocatedPercent = useMemo(() => {
    if (totalBudget <= 0) return 0;
    return (allocatedTotal / totalBudget) * 100;
  }, [allocatedTotal, totalBudget]);

  const handleAllocationChange = (categoryId: string, value: string) => {
    // Decouple hard-clamping inside modal inputs to allow over-allocation intermediate states
    setAllocations(prev => ({ ...prev, [categoryId]: value }));
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setIsSubmittingCategory(true);
    try {
      const res = await addCategoryAction(newCategoryName.trim());
      if (res.success && res.data) {
        addCategory(res.data);
        setNewCategoryName('');
      } else {
        alert(res.error || 'Failed to add category');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (confirm(`Are you sure you want to delete "${catName}"?`)) {
      try {
        const res = await deleteCategoryAction(catId);
        if (res.success) {
          removeCategory(catId);
          setAllocations(prev => {
            const copy = { ...prev };
            delete copy[catId];
            return copy;
          });
        } else {
          alert(res.error || 'Failed to delete category');
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // React 19 useActionState using semantic hidden formData inputs
  const [state, formAction, isPending] = useActionState(
    async (_prevState: any, formData: FormData) => {
      const allocationsMap = JSON.parse(formData.get('allocationsPayload') as string);
      const totalBgt = parseFloat(formData.get('totalBudgetPayload') as string) || 0;
      const unalloc = parseFloat(formData.get('unallocatedPayload') as string) || 0;
      const applyToRemainingVal = formData.get('applyToRemaining') === 'true';

      if (totalBgt <= 0) {
        return { success: false, error: 'Please enter a valid total budget.' };
      }

      if (unalloc < 0) {
        return { success: false, error: 'Allocations exceed total budget. Please adjust category limits.' };
      }

      const payload: { category_id: string | null; limit_amount: number; currency: string }[] = displayCategories.map(cat => ({
        category_id: cat.id,
        // Convert local string representation back to number when saving payload
        limit_amount: parseFloat(allocationsMap[cat.id] || '0') || 0,
        currency: displayCurrency
      }));

      // Only push 'Unallocated Budget' surplus record if greater than zero
      if (unalloc > 0) {
        payload.push({
          category_id: null,
          limit_amount: unalloc,
          currency: displayCurrency
        });
      }

      // Compute target months dynamically based on propagation checkbox selection
      const targetMonths = [targetMonth];
      if (applyToRemainingVal) {
        const remaining = getRemainingMonths(targetMonth);
        targetMonths.push(...remaining);
      }

      const res = await saveBulkBudgets(targetMonth, targetMonths, payload);

      if (res.success) {
        onClose();
        return { success: true };
      } else {
        return { success: false, error: res.error || 'Failed to save budgets.' };
      }
    },
    { success: false }
  );

  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: 'flex' }} onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal') && !isPending) onClose();
    }}>
      <div className="modal-content bg-white border border-zen-lavender/45 shadow-[0_25px_55px_rgba(45,55,72,0.15)] text-zen-charcoal rounded-3xl p-5 sm:p-6 w-full max-w-md max-h-[90dvh] flex flex-col gap-4 animate-scale-up" onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-xl m-0 text-zen-charcoal">
            {step === 1 ? `Set Monthly Ceiling (${monthWord})` : `Allocate ${monthWord} Budget`}
          </h2>
          <button 
            onClick={onClose}
            disabled={isPending}
            className="w-8 h-8 rounded-full bg-white/60 border border-zen-lavender/40 flex items-center justify-center text-zen-charcoal hover:bg-white/80 transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {state.error && (
          <div className="p-4 bg-zen-peach/20 border border-zen-peach text-zen-charcoal rounded-2xl text-sm font-semibold">
            {state.error}
          </div>
        )}

        {step === 1 ? (
          // STEP 1: TOTAL BUDGET PROMPT
          <div className="flex flex-col gap-6 text-left">
            <p className="text-sm text-zen-charcoal/70 leading-relaxed m-0">
              What is your total available budget limit specifically for <strong className="text-zen-charcoal">{monthWord}</strong>?
            </p>

            <div className="flex items-center bg-white/60 border border-zen-lavender/60 rounded-full h-14 px-6 box-border focus-within:ring-2 focus-within:ring-zen-sage shadow-inner">
              <span className="text-zen-charcoal font-bold text-lg pr-3 border-r border-zen-lavender/40">
                {displayCurrency}
              </span>
              <input 
                type="number" 
                placeholder="0.00" 
                value={totalBudgetStr}
                onChange={e => setTotalBudgetStr(e.target.value)}
                className="flex-1 border-none bg-transparent text-zen-charcoal text-lg font-bold px-4 m-0 outline-none appearance-none"
                autoFocus
              />
            </div>

            <button 
              onClick={() => {
                if (totalBudget > 0) setStep(2);
                else alert('Please enter a valid amount.');
              }}
              className="w-full py-4 bg-zen-charcoal text-zen-base rounded-full font-bold text-lg hover:bg-zen-charcoal/90 transition-all cursor-pointer border-none shadow-md mt-2"
            >
              Continue
            </button>
          </div>
        ) : (
          // STEP 2: CATEGORY INPUTS & SUMMARY PROGRESS
          <form action={formAction} className="flex flex-col gap-6 text-left animate-fade-in">
            {/* Hidden Semantic Form Payload Inputs */}
            <input type="hidden" name="allocationsPayload" value={JSON.stringify(allocations)} />
            <input type="hidden" name="totalBudgetPayload" value={totalBudget} />
            <input type="hidden" name="unallocatedPayload" value={unallocated} />

            {/* Centered Premium Total Budget Input Card */}
            <div className="w-full bg-white border border-zen-lavender/45 rounded-2xl p-3 flex flex-col items-center shadow-[0_4px_20px_rgba(45,55,72,0.05)] justify-between box-border">
              <span className="text-xs font-bold text-zen-charcoal/60 uppercase tracking-wider select-none">Total Budget</span>
              <div className="flex items-center bg-white border border-zen-lavender/60 rounded-xl px-4 py-1.5 shadow-inner w-full max-w-[180px] box-border my-1 focus-within:ring-2 focus-within:ring-zen-sage/60">
                {CURRENCY_CONFIG[displayCurrency]?.position !== 'suffix' && (
                  <span className="text-xs font-bold text-zen-charcoal mr-1">{getCurrencySymbol(displayCurrency)}</span>
                )}
                <input 
                  type="number" 
                  value={totalBudgetStr}
                  onChange={e => setTotalBudgetStr(e.target.value)}
                  className="w-full bg-transparent border-none text-center text-xl font-extrabold text-zen-charcoal outline-none appearance-none m-0"
                  placeholder="0.00"
                />
                {CURRENCY_CONFIG[displayCurrency]?.position === 'suffix' && (
                  <span className="text-xs font-bold text-zen-charcoal ml-1">{getCurrencySymbol(displayCurrency)}</span>
                )}
              </div>
            </div>

            {/* Premium Budget Allocation Utilization Progress Card */}
            {totalBudget > 0 && (
              <div className="flex flex-col gap-3 bg-gradient-to-br from-zen-lavender/10 via-white/40 to-zen-peach/10 p-3 rounded-2xl border border-white/40 shadow-xs transition-all duration-300 my-1">
                <div className="flex justify-between items-end">
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[10px] font-bold text-zen-charcoal/40 uppercase tracking-wider">
                      Allocation Distribution
                    </span>
                    <span className="text-xs font-bold text-zen-charcoal/70 flex flex-wrap items-center gap-1.5">
                      <span>Total Allocated:</span>
                      <span className="font-extrabold text-zen-charcoal">
                        {formatNoDecimalCurrency(allocatedTotal, displayCurrency)}
                      </span>
                      <span className="text-zen-charcoal/40 font-medium">of</span>
                      <span className="font-semibold text-zen-charcoal/60">
                        {formatNoDecimalCurrency(totalBudget, displayCurrency)}
                      </span>
                    </span>
                  </div>
                  
                  <span className={`text-xs font-extrabold tracking-wide px-2.5 py-1 rounded-lg shadow-2xs transition-all duration-300 ${
                    unallocated < 0 
                      ? 'text-amber-600 bg-amber-50 border border-amber-200/60' 
                      : unallocated === 0
                        ? 'text-zen-sage bg-zen-sage/20 border border-zen-sage/30'
                        : 'text-zen-charcoal bg-white/80 border border-zen-lavender/30'
                  }`}>
                    {allocatedPercent.toFixed(0)}%
                  </span>
                </div>

                {/* Utilisation progress bar track */}
                <div 
                  role="progressbar"
                  aria-valuenow={Math.max(0, Math.min(allocatedPercent, 100))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Allocation utilization percentage"
                  className="w-full h-2.5 bg-zen-lavender/10 rounded-full overflow-hidden border border-zen-lavender/25 shadow-inner relative"
                >
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                      unallocated < 0 
                        ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
                        : allocatedPercent === 100 
                          ? 'bg-zen-sage shadow-[0_0_10px_rgba(163,230,53,0.3)]' 
                          : 'bg-zen-sage/85'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(allocatedPercent, 100))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-semibold transition-all duration-300">
                  {unallocated < 0 ? (
                    <span className="text-amber-600 font-bold">
                      Allocations exceed target ceiling by {formatNoDecimalCurrency(Math.abs(unallocated), displayCurrency)}
                    </span>
                  ) : unallocated === 0 && totalBudget > 0 ? (
                    <span className="text-zen-sage flex items-center gap-1 font-bold">
                      ✓ Fully allocated! Perfect harmony achieved.
                    </span>
                  ) : unallocated > 0 && totalBudget > 0 ? (
                    <span className="text-zen-charcoal/50">
                      ✨ {formatNoDecimalCurrency(unallocated, displayCurrency)} remaining to allocate
                    </span>
                  ) : (
                    <span className="text-zen-charcoal/40">
                      Set a total available budget limit to begin allocating.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Spacious single-row Category card list */}
            <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[25dvh] pr-2">
              {displayCategories.map(cat => {
                const val = allocations[cat.id] || '';
                const parsedVal = parseFloat(val) || 0;
                const maxSliderVal = Math.max(0, Math.round((parsedVal + unallocated) * 100) / 100);
                const labelId = `cat-label-${targetMonth}-${cat.id}`;
                return (
                  <div 
                    key={cat.id} 
                    className="flex flex-col gap-2 bg-white/40 hover:bg-white/60 p-3 rounded-2xl border border-white/20 shadow-xs hover:shadow-sm transition-all duration-200"
                  >
                    {/* Top Row: Name & Input Field */}
                    <div className="flex justify-between items-center gap-4">
                      {/* Category Label & Icon */}
                      <span id={labelId} className="font-bold text-sm text-zen-charcoal flex items-center gap-3 truncate min-w-0 flex-1">
                        <span className="w-8 h-8 rounded-xl bg-zen-lavender/15 flex items-center justify-center text-zen-charcoal/70 shrink-0">
                          <Tag size={16} />
                        </span>
                        <span className="truncate tracking-wide text-zen-charcoal/90 font-bold">
                          {cat.name}
                        </span>
                      </span>

                      {/* Numerical limit text fields */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center bg-white/75 border border-zen-lavender/40 rounded-xl px-3 py-1 min-h-[36px] focus-within:ring-2 focus-within:ring-zen-sage/60 focus-within:border-transparent hover:border-zen-lavender/60 transition-all shadow-inner">
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
                            className="w-16 bg-transparent border-none text-right text-sm font-extrabold text-zen-charcoal outline-none appearance-none focus:ring-0"
                            placeholder="0"
                          />
                          {CURRENCY_CONFIG[displayCurrency]?.position === 'suffix' && (
                            <span className="text-xs font-extrabold text-zen-charcoal/40 ml-1 select-none">
                              {getCurrencySymbol(displayCurrency)}
                            </span>
                          )}
                        </div>
                        
                        <button 
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          aria-label={`Delete ${cat.name}`}
                          className="w-8.5 h-8.5 rounded-xl bg-white/45 hover:bg-red-50 hover:text-red-500 text-zen-charcoal/60 flex items-center justify-center cursor-pointer border border-zen-lavender/30 transition-all duration-200 shadow-xs"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Dynamic headroom range slider */}
                    <div className="flex items-center gap-3 px-1">
                      <input 
                        type="range"
                        min="0"
                        max={maxSliderVal}
                        step="1"
                        value={parsedVal}
                        onChange={e => handleAllocationChange(cat.id, e.target.value)}
                        aria-labelledby={labelId}
                        className="w-full h-1 bg-zen-lavender/20 rounded-lg appearance-none cursor-pointer accent-zen-sage"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add New Category Row */}
            <div className="flex gap-2 items-center bg-white/40 p-2.5 mr-2 rounded-2xl border border-white/20">
              <input 
                type="text" 
                placeholder="New category name..."
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                className="flex-1 bg-white/50 border border-zen-lavender/40 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-zen-sage/60 focus:border-transparent"
              />
              <button 
                type="button"
                onClick={handleAddCategory}
                disabled={isSubmittingCategory}
                className="px-5 py-2 bg-zen-sage text-white rounded-xl font-bold text-sm hover:bg-zen-sage/90 transition-all flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-40 border-none"
              >
                <Plus size={16} />
                <span>Add</span>
              </button>
            </div>

            {/* One-Click Propagation Checkbox Row */}
            {remainingMonthsCount > 0 && (
              <div className="flex items-center gap-2 py-1.5 px-1 select-none">
                <input
                  type="checkbox"
                  id="applyToRemaining"
                  checked={applyToRemaining}
                  onChange={(e) => setApplyToRemaining(e.target.checked)}
                  className="w-4 h-4 rounded border-zen-lavender/40 text-zen-charcoal focus:ring-zen-sage/60 cursor-pointer accent-zen-charcoal"
                />
                <label htmlFor="applyToRemaining" className="text-xs font-semibold text-zen-charcoal/70 cursor-pointer">
                  Apply to remaining months of the year ({remainingMonthsCount} month{remainingMonthsCount > 1 ? 's' : ''})
                </label>
                <input type="hidden" name="applyToRemaining" value={String(applyToRemaining)} />
              </div>
            )}

            {/* Modal Footer Buttons */}
            <div className="flex gap-3 mt-1">
              <button 
                type="submit"
                disabled={isPending || unallocated < 0}
                className="w-full py-2.5 px-4 bg-zen-charcoal text-zen-base rounded-full font-extrabold text-xs uppercase tracking-wider hover:bg-zen-charcoal/90 transition-all cursor-pointer disabled:opacity-40 border-none shadow-md"
              >
                {isPending ? 'Saving...' : 'Save Allocations'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
