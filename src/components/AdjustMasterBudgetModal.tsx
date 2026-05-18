'use client';
import { useState, useEffect, useMemo, useActionState } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { saveBulkBudgets } from '@/app/actions/budget';
import { addCategoryAction, deleteCategoryAction } from '@/app/actions';
import { formatFriendlyCurrency, formatNoDecimalCurrency, parseLocalDate, getCurrencySymbol, CURRENCY_CONFIG } from '@/lib/utils';
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
    setBudgets,
    profile,
    addCategory,
    removeCategory,
    expenses
  } = useExpenseStore();

  const [step, setStep] = useState(1);
  const [totalBudgetStr, setTotalBudgetStr] = useState('');
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  const monthWord = useMemo(() => {
    const d = parseLocalDate(`${targetMonth}-01`);
    return isNaN(d.getTime()) ? targetMonth : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [targetMonth]);

  // Hydrate initial state only once per modal session to prevent re-render resets mid-interaction
  useEffect(() => {
    if (isOpen && !hasHydrated) {
      const targetMonthBudgets = budgets.filter(b => b.month === targetMonth);
      if (targetMonthBudgets.length > 0) {
        const total = targetMonthBudgets.reduce((sum, b) => sum + b.limit_amount, 0);
        setTotalBudgetStr(total.toString());
        
        const allocMap: Record<string, number> = {};
        targetMonthBudgets.forEach(b => {
          if (b.category_id) {
            allocMap[b.category_id] = b.limit_amount;
          }
        });
        setAllocations(allocMap);
        setStep(2);
      } else {
        setTotalBudgetStr(initialAmount > 0 ? initialAmount.toString() : '2000');
        setAllocations({});
        setStep(1);
      }
      setHasHydrated(true);
    }
    if (!isOpen) {
      setHasHydrated(false);
    }
  }, [isOpen, budgets, targetMonth, initialAmount, hasHydrated]);

  const totalBudget = parseFloat(totalBudgetStr) || 0;

  const displayCategories = useMemo(() => {
    const defaults = categories.filter(c => DEFAULT_CATEGORIES.includes(c.name));
    const custom = categories.filter(c => !DEFAULT_CATEGORIES.includes(c.name));
    return [...defaults, ...custom];
  }, [categories]);

  const allocatedTotal = useMemo(() => {
    return Object.values(allocations).reduce((sum, amt) => sum + amt, 0);
  }, [allocations]);

  const unallocated = totalBudget - allocatedTotal;

  // Prevent slider freezing by removing intermediate hard-clamping
  const handleAllocationChange = (categoryId: string, value: string) => {
    const amt = parseFloat(value) || 0;
    setAllocations(prev => ({ ...prev, [categoryId]: amt }));
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setIsSubmittingCategory(true);
    try {
      const res = await addCategoryAction(newCategoryName.trim());
      if (res.success && res.data) {
        addCategory(res.data as any);
        setAllocations(prev => ({ ...prev, [res.data!.id]: 0 }));
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
    const hasExpenses = expenses.some(e => e.category_id === catId);
    if (hasExpenses) {
      alert(`"${catName}" contains expenses. Please use the Category Management tab in Account Overview to reassign expenses before deleting.`);
      return;
    }
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
    async (prevState: any, formData: FormData) => {
      const allocationsMap = JSON.parse(formData.get('allocationsPayload') as string);
      const totalBgt = parseFloat(formData.get('totalBudgetPayload') as string) || 0;
      const unalloc = parseFloat(formData.get('unallocatedPayload') as string) || 0;

      if (totalBgt <= 0) {
        return { success: false, error: 'Please enter a valid total budget.' };
      }

      if (unalloc < 0) {
        return { success: false, error: 'Allocations exceed total budget. Please adjust category limits.' };
      }

      const payload: { category_id: string | null; limit_amount: number; currency: string; month: string }[] = displayCategories.map(cat => ({
        category_id: cat.id,
        limit_amount: allocationsMap[cat.id] || 0,
        currency: displayCurrency,
        month: targetMonth
      }));

      // Only push 'Unallocated Budget' surplus record if greater than zero
      if (unalloc > 0) {
        payload.push({
          category_id: null,
          limit_amount: unalloc,
          currency: displayCurrency,
          month: targetMonth
        });
      }

      const res = await saveBulkBudgets(targetMonth, [targetMonth], payload);

      if (res.success) {
        const newBudgets = payload.map((b, idx) => ({
          id: `bgt-${Date.now()}-${idx}`,
          user_id: profile?.id || 'user',
          category_id: b.category_id,
          limit_amount: b.limit_amount,
          currency: b.currency,
          month: b.month
        }));
        // Store merge instead of overwrite to preserve multi-month history
        const existingBudgets = budgets.filter(b => b.month !== targetMonth);
        setBudgets([...existingBudgets, ...newBudgets]);
        return { success: true };
      } else {
        return { success: false, error: res.error || 'Failed to save budget.' };
      }
    },
    { success: false }
  );

  useEffect(() => {
    if (state.success) {
      onClose();
    }
  }, [state.success, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: 'flex' }} onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal') && !isPending) onClose();
    }}>
      <div className="modal-content bg-white/60 backdrop-blur-xl border border-white/30 shadow-2xl text-zen-charcoal rounded-3xl p-8 w-full max-w-md max-h-[90dvh] overflow-y-auto flex flex-col gap-6 animate-scale-up" onClick={e => e.stopPropagation()}>
        
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
          // STEP 2: CATEGORY SLIDERS & SURPLUS COUNTER
          <form action={formAction} className="flex flex-col gap-6 text-left animate-fade-in">
            {/* Hidden Semantic Form Payload Inputs */}
            <input type="hidden" name="allocationsPayload" value={JSON.stringify(allocations)} />
            <input type="hidden" name="totalBudgetPayload" value={totalBudget} />
            <input type="hidden" name="unallocatedPayload" value={unallocated} />

            {/* Top Summary Cards (Total Ceiling Budget & Unallocated Surplus) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-2xl p-4 flex flex-col items-center shadow-sm justify-between min-h-[90px] box-border">
                <span className="text-xs font-semibold text-zen-charcoal/60 uppercase tracking-wider">Total Budget</span>
                <div className="flex items-center bg-white/80 border border-zen-lavender/60 rounded-xl px-3 py-1 shadow-inner w-full max-w-[160px] box-border my-1">
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

              <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-2xl p-4 flex flex-col items-center shadow-sm justify-between min-h-[90px] box-border">
                <span className="text-xs font-semibold text-zen-charcoal/60 uppercase tracking-wider">Unallocated</span>
                <span className="text-2xl font-extrabold text-zen-sage/90 my-1 flex items-center h-9">
                  {formatNoDecimalCurrency(unallocated, displayCurrency)}
                </span>
              </div>
            </div>

            {unallocated < 0 && (
              <div className="p-4 bg-zen-peach/20 border border-zen-peach text-zen-charcoal rounded-2xl text-sm font-semibold">
                Allocations exceed total budget by {formatNoDecimalCurrency(Math.abs(unallocated), displayCurrency)}. Please adjust category limits.
              </div>
            )}

            {/* Category Sliders List */}
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[40dvh] pr-2">
              {displayCategories.map(cat => {
                const val = allocations[cat.id] || 0;
                return (
                  <div key={cat.id} className="flex flex-col gap-2 bg-white/40 p-4 rounded-2xl border border-white/20">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-bold text-sm text-zen-charcoal flex items-center gap-2 truncate min-w-0 flex-1">
                        {cat.icon && <Tag size={16} className="text-zen-charcoal/60 shrink-0" />}
                        <span className="truncate">{cat.name}</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center bg-white/60 border border-zen-lavender/40 rounded-xl px-3 py-1">
                          {CURRENCY_CONFIG[displayCurrency]?.position !== 'suffix' && (
                            <span className="text-xs font-bold text-zen-charcoal mr-1">{getCurrencySymbol(displayCurrency)}</span>
                          )}
                          <input 
                            type="text" 
                            inputMode="decimal"
                            pattern="^[0-9]*\.?[0-9]*$"
                            value={val === 0 ? 0 : val} 
                            onChange={e => handleAllocationChange(cat.id, e.target.value)}
                            className="w-16 bg-transparent border-none text-right text-sm font-bold text-zen-charcoal outline-none appearance-none"
                            placeholder="0"
                          />
                          {CURRENCY_CONFIG[displayCurrency]?.position === 'suffix' && (
                            <span className="text-xs font-bold text-zen-charcoal ml-1">{getCurrencySymbol(displayCurrency)}</span>
                          )}
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          aria-label={`Delete ${cat.name}`}
                          className="w-8 h-8 rounded-full bg-transparent hover:bg-zen-peach/30 text-zen-charcoal flex items-center justify-center cursor-pointer border border-zen-lavender/40 transition-colors p-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Slider Input */}
                    <input 
                      type="range" 
                      min="0" 
                      max={totalBudget} 
                      step="10"
                      value={val}
                      onChange={e => handleAllocationChange(cat.id, e.target.value)}
                      className="w-full accent-zen-sage cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>

            {/* Add New Category Row */}
            <div className="flex gap-2 items-center bg-white/40 p-3 rounded-2xl border border-white/20">
              <input 
                type="text" 
                placeholder="New category name..."
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                className="flex-1 bg-white/60 border border-zen-lavender/40 px-4 py-2 rounded-full text-zen-charcoal text-sm font-semibold outline-none box-border"
              />
              <button 
                type="button"
                onClick={handleAddCategory}
                disabled={isSubmittingCategory || !newCategoryName.trim()}
                className="px-5 py-2 bg-zen-charcoal text-white rounded-full font-bold text-xs hover:bg-zen-charcoal/90 transition-all cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed h-9 flex items-center justify-center gap-1"
              >
                {isSubmittingCategory ? 'Adding...' : <><Plus size={16} /> Add</>}
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-2">
              <button 
                type="button"
                onClick={() => setStep(1)}
                disabled={isPending}
                className="w-1/3 py-4 bg-white/60 border border-zen-lavender/40 text-zen-charcoal rounded-full font-semibold hover:bg-white/80 transition-all cursor-pointer text-sm disabled:opacity-40"
              >
                Back
              </button>
              <button 
                type="submit"
                disabled={isPending || unallocated < 0}
                className="w-2/3 py-4 bg-zen-charcoal text-zen-base rounded-full font-bold text-lg hover:bg-zen-charcoal/90 transition-all cursor-pointer border-none shadow-md disabled:opacity-40 flex items-center justify-center"
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
