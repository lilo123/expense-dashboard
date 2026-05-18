'use client';
import { useState, useEffect, useMemo } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { saveInitialBudgets } from '@/app/actions/budget';
import { addCategoryAction, deleteCategoryAction } from '@/app/actions';
import { formatFriendlyCurrency } from '@/lib/utils';
import { Tag, Trash2, Plus } from 'lucide-react';

const DEFAULT_CATEGORIES = ['Housing', 'Food & Dining', 'Transportation', 'Utilities', 'Personal/Entertainment'];

export default function OnboardingModal() {
  const { 
    isOnboardingOpen, 
    toggleOnboarding, 
    categories, 
    displayCurrency,
    budgets,
    setBudgets,
    profile,
    setProfile,
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

  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Decoupled hydration from active WIP state: only run once per modal session
  useEffect(() => {
    if (isOnboardingOpen && !hasHydrated) {
      const currentMonthBudgets = budgets.filter(b => b.month === currentMonth);
      if (currentMonthBudgets.length > 0) {
        const total = currentMonthBudgets.reduce((sum, b) => sum + b.limit_amount, 0);
        setTotalBudgetStr(total.toString());
        
        const allocMap: Record<string, number> = {};
        currentMonthBudgets.forEach(b => {
          if (b.category_id) {
            allocMap[b.category_id] = b.limit_amount;
          }
        });
        setAllocations(allocMap);
        setStep(2);
      } else {
        setTotalBudgetStr('2000');
        setAllocations({});
        setStep(1);
      }
      setHasHydrated(true);
    }
    if (!isOnboardingOpen) {
      setHasHydrated(false);
    }
  }, [isOnboardingOpen, budgets, currentMonth, hasHydrated]);

  const totalBudget = parseFloat(totalBudgetStr) || 0;

  // Filter categories to show 5 defaults first, then any custom ones
  const displayCategories = useMemo(() => {
    const defaults = categories.filter(c => DEFAULT_CATEGORIES.includes(c.name));
    const custom = categories.filter(c => !DEFAULT_CATEGORIES.includes(c.name));
    return [...defaults, ...custom];
  }, [categories]);

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

      // Clamp amount so it doesn't exceed available total budget
      const maxAllowed = Math.max(0, totalBudget - currentOtherTotal);
      const clampedAmt = Math.min(amt, maxAllowed);

      return { ...prev, [categoryId]: clampedAmt };
    });
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

  const handleSave = async () => {
    if (totalBudget <= 0) {
      alert('Please enter a valid total budget.');
      return;
    }

    const payload: { category_id: string | null; limit_amount: number; currency: string; month: string }[] = displayCategories.map(cat => ({
      category_id: cat.id,
      limit_amount: allocations[cat.id] || 0,
      currency: displayCurrency,
      month: currentMonth
    }));

    // Add 'Unallocated Budget' surplus
    payload.push({
      category_id: null,
      limit_amount: unallocated,
      currency: displayCurrency,
      month: currentMonth
    });

    const res = await saveInitialBudgets(payload);

    if (res.success) {
      const newBudgets = payload.map((b, idx) => ({
        id: `bgt-${Date.now()}-${idx}`,
        user_id: profile?.id || 'user',
        category_id: b.category_id,
        limit_amount: b.limit_amount,
        currency: b.currency,
        month: b.month
      }));
      setBudgets(newBudgets);
      
      // Synchronize client profile store on save to prevent infinite modal loops
      if (profile) {
        setProfile({ ...profile, onboarding_status: 'completed' });
      }
      toggleOnboarding();
    } else {
      alert(res.error || 'Failed to save budget.');
    }
  };

  if (!isOnboardingOpen) return null;

  const isMandatory = profile?.onboarding_status === 'pending';

  return (
    <div className="modal" style={{ display: 'flex' }} onClick={(e) => {
      // Disable backdrop click if onboarding is mandatory
      if (!isMandatory && (e.target as HTMLElement).classList.contains('modal')) toggleOnboarding();
    }}>
      <div className="modal-content bg-white/60 backdrop-blur-xl border border-white/30 shadow-2xl text-zen-charcoal rounded-3xl p-8 w-full max-w-md max-h-[90dvh] overflow-y-auto flex flex-col gap-6 animate-scale-up" onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-xl m-0 text-zen-charcoal">
            {step === 1 ? 'Welcome to An-yen' : 'Allocate Your Budget'}
          </h2>
          {/* Hide close button if onboarding is mandatory */}
          {!isMandatory && (
            <button 
              onClick={toggleOnboarding}
              className="w-8 h-8 rounded-full bg-white/60 border border-zen-lavender/40 flex items-center justify-center text-zen-charcoal hover:bg-white/80 transition-colors cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        {step === 1 ? (
          // STEP 1: TOTAL BUDGET PROMPT
          <div className="flex flex-col gap-6 text-left">
            <p className="text-sm text-zen-charcoal/70 leading-relaxed m-0">
              Let's establish a calm financial launching pad. What is your total available budget for <strong className="text-zen-charcoal">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>?
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
          <div className="flex flex-col gap-6 text-left animate-fade-in">
            
            {/* Persistent Surplus Counter Card */}
            <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-2xl p-4 flex flex-col items-center shadow-sm">
              <span className="text-xs font-semibold text-zen-charcoal/60 uppercase tracking-wider">Unallocated Budget</span>
              <span className="text-3xl font-extrabold text-zen-sage/90 my-1">
                {formatFriendlyCurrency(unallocated, displayCurrency)}
              </span>
            </div>

            {/* Category Sliders List */}
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[40dvh] pr-2">
              {displayCategories.map(cat => {
                const val = allocations[cat.id] || 0;
                return (
                  <div key={cat.id} className="flex flex-col gap-2 bg-white/40 p-4 rounded-2xl border border-white/20">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-zen-charcoal flex items-center gap-2">
                        {cat.icon && <Tag size={16} className="text-zen-charcoal/60" />}
                        {cat.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white/60 border border-zen-lavender/40 rounded-xl px-3 py-1">
                          <span className="text-xs font-bold text-zen-charcoal mr-1">$</span>
                          <input 
                            type="number" 
                            value={val === 0 ? 0 : val} 
                            onChange={e => handleAllocationChange(cat.id, e.target.value)}
                            className="w-16 bg-transparent border-none text-right text-sm font-bold text-zen-charcoal outline-none appearance-none"
                            placeholder="0"
                          />
                        </div>
                        <button 
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
                onClick={() => setStep(1)}
                className="w-1/3 py-4 bg-white/60 border border-zen-lavender/40 text-zen-charcoal rounded-full font-semibold hover:bg-white/80 transition-all cursor-pointer text-sm"
              >
                Back
              </button>
              <button 
                onClick={handleSave}
                className="w-2/3 py-4 bg-zen-charcoal text-zen-base rounded-full font-bold text-lg hover:bg-zen-charcoal/90 transition-all cursor-pointer border-none shadow-md"
              >
                Save Budget
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
