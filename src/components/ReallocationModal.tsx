'use client';
import { useState, useEffect, useMemo } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { convertAmount, formatFriendlyCurrency } from '@/lib/utils';

export default function ReallocationModal() {
  const { 
    isReallocationOpen, 
    toggleReallocation, 
    categories, 
    budgets, 
    expenses,
    displayCurrency, 
    baseCurrency, 
    exchangeRates,
    executeReallocation,
    reallocationSourceId,
    reallocationMonth
  } = useExpenseStore();

  const [sourceId, setSourceId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fallbackMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const targetMonth = reallocationMonth || fallbackMonth;

  // Filter expenses for target month and convert to display currency
  const targetMonthExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (!exp.date) return false;
      return exp.date.substring(0, 7) === targetMonth;
    });
  }, [expenses, targetMonth]);

  const targetMonthBudgets = useMemo(() => {
    return budgets.filter(b => b.month === targetMonth);
  }, [budgets, targetMonth]);

  // Calculate spent per category
  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    targetMonthExpenses.forEach(exp => {
      const catId = exp.category_id;
      if (!map[catId]) map[catId] = 0;
      const amtBase = parseFloat(exp.amount as any) || 0;
      const amtDisplay = convertAmount(amtBase, baseCurrency, displayCurrency, exchangeRates);
      map[catId] += amtDisplay;
    });
    return map;
  }, [targetMonthExpenses, baseCurrency, displayCurrency, exchangeRates]);

  // Calculate available surplus per category and for 'Unallocated Budget'
  const availableSurplus = useMemo(() => {
    const map: Record<string, number> = {};
    
    // Unallocated Budget (null)
    const surplusBgt = targetMonthBudgets.find(b => b.category_id === null);
    map['null'] = surplusBgt ? surplusBgt.limit_amount : 0;

    // Categories
    categories.forEach(cat => {
      const bgt = targetMonthBudgets.find(b => b.category_id === cat.id);
      const limit = bgt ? bgt.limit_amount : 0;
      const spent = spentByCategory[cat.id] || 0;
      map[cat.id] = Math.max(0, limit - spent);
    });

    return map;
  }, [targetMonthBudgets, categories, spentByCategory]);

  // Hydrate initial source from store reallocationSourceId
  useEffect(() => {
    if (isReallocationOpen) {
      setSourceId(reallocationSourceId);
      setTargetId('');
      setAmountStr('');
      setIsSubmitting(false);
    }
  }, [isReallocationOpen, reallocationSourceId]);

  if (!isReallocationOpen) return null;

  const amount = parseFloat(amountStr) || 0;
  const maxAvailable = availableSurplus[String(sourceId)] || 0;

  const handleTransfer = async () => {
    if (!targetId) {
      alert('Please select a target category.');
      return;
    }
    if (sourceId === targetId) {
      alert('Source and target categories must be different.');
      return;
    }
    if (amount <= 0 || amount > maxAvailable) {
      alert(`Please enter a valid amount up to ${formatFriendlyCurrency(maxAvailable, displayCurrency)}.`);
      return;
    }

    setIsSubmitting(true);
    const success = await executeReallocation(sourceId, targetId, amount, targetMonth);
    setIsSubmitting(false);

    if (success) {
      toggleReallocation();
    }
  };

  return (
    <div className="modal" style={{ display: 'flex' }} onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) toggleReallocation();
    }}>
      <div className="modal-content bg-white/60 backdrop-blur-xl border border-white/30 shadow-2xl text-zen-charcoal rounded-3xl p-8 w-full max-w-md flex flex-col gap-6 animate-scale-up" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-xl m-0 text-zen-charcoal">Reassign Budget</h2>
          <button 
            onClick={() => toggleReallocation()}
            className="w-8 h-8 rounded-full bg-white/60 border border-zen-lavender/40 flex items-center justify-center text-zen-charcoal hover:bg-white/80 transition-colors cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 text-left">
          
          {/* Source Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zen-charcoal/70 uppercase tracking-wider ml-1">Move From</label>
            <div className="relative flex items-center">
              <select 
                value={String(sourceId)} 
                onChange={e => setSourceId(e.target.value === 'null' ? null : e.target.value)}
                className="w-full pl-4 pr-10 py-3.5 rounded-full bg-white/60 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-sm font-semibold appearance-none cursor-pointer shadow-inner box-border"
              >
                <option value="null">
                  Unallocated Budget ({formatFriendlyCurrency(availableSurplus['null'] || 0, displayCurrency)} available)
                </option>
                {categories.map(cat => {
                  const avail = availableSurplus[cat.id] || 0;
                  if (avail <= 0) return null; // Only show categories with surplus
                  return (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({formatFriendlyCurrency(avail, displayCurrency)} available)
                    </option>
                  );
                })}
              </select>
              <div className="absolute right-4 pointer-events-none text-zen-charcoal/50 flex items-center justify-center">
                ▼
              </div>
            </div>
          </div>

          {/* Target Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zen-charcoal/70 uppercase tracking-wider ml-1">Move To</label>
            <div className="relative flex items-center">
              <select 
                value={targetId} 
                onChange={e => setTargetId(e.target.value)}
                className="w-full pl-4 pr-10 py-3.5 rounded-full bg-white/60 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-sm font-semibold appearance-none cursor-pointer shadow-inner box-border"
              >
                <option value="" disabled>Select target category</option>
                {categories.map(cat => {
                  if (cat.id === sourceId) return null;
                  return (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  );
                })}
              </select>
              <div className="absolute right-4 pointer-events-none text-zen-charcoal/50 flex items-center justify-center">
                ▼
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zen-charcoal/70 uppercase tracking-wider ml-1">Amount</label>
            <div className="flex items-center bg-white/60 border border-zen-lavender/60 rounded-full h-14 px-6 box-border focus-within:ring-2 focus-within:ring-zen-sage shadow-inner">
              <span className="text-zen-charcoal font-bold text-lg pr-3 border-r border-zen-lavender/40">
                {displayCurrency}
              </span>
              <input 
                type="number" 
                placeholder="0.00" 
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                max={maxAvailable}
                className="flex-1 border-none bg-transparent text-zen-charcoal text-lg font-bold px-4 m-0 outline-none appearance-none"
                autoFocus
              />
            </div>
            <div className="flex justify-end px-2">
              <button 
                onClick={() => setAmountStr(maxAvailable.toString())}
                className="text-xs text-zen-charcoal/60 hover:text-zen-charcoal underline border-none bg-transparent cursor-pointer p-0"
              >
                Max Available ({formatFriendlyCurrency(maxAvailable, displayCurrency)})
              </button>
            </div>
          </div>

          {/* Submit */}
          <button 
            onClick={handleTransfer}
            disabled={isSubmitting || !targetId || amount <= 0 || amount > maxAvailable}
            className="w-full py-4 bg-zen-charcoal text-zen-base rounded-full font-bold text-lg hover:bg-zen-charcoal/90 transition-all cursor-pointer border-none shadow-md mt-4 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Reassigning...' : 'Confirm Transfer'}
          </button>

        </div>

      </div>
    </div>
  );
}
