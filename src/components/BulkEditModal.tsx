'use client';
import { useState, useEffect } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { bulkUpdateAction } from '@/app/actions';
import { getRecurringExpensesAction } from '@/app/actions/recurring';
import { Category, RecurringExpense } from '@/types/database';
import { toUTCISOString } from '@/lib/utils';

export default function BulkEditModal() {
  const { 
    isBulkEditModalOpen, 
    toggleBulkEditModal, 
    selectedIds, 
    categories, 
    recurringExpenses,
    hydrate,
    updateBulkExpenses 
  } = useExpenseStore();

  const [date, setDate] = useState('');
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  
  // Bulk Type Edit States
  const [typeOption, setTypeOption] = useState(''); // '', 'one-off', 'recurring'
  const [targetRecurringId, setTargetRecurringId] = useState('');

  // Fetch and hydrate recurring templates on open
  useEffect(() => {
    if (isBulkEditModalOpen) {
      setDate('');
      setItem('');
      setAmount('');
      setCategoryId('');
      setTypeOption('');
      setTargetRecurringId('');

      async function fetchTemplates() {
        try {
          const res = await getRecurringExpensesAction();
          if (res.success && res.data) {
            hydrate({ recurringExpenses: res.data as RecurringExpense[] });
          }
        } catch (error) {
          console.error('[BULK EDIT TEMPLATES FETCH ERROR]:', error);
        }
      }
      fetchTemplates();
    }
  }, [isBulkEditModalOpen, hydrate]);

  if (!isBulkEditModalOpen) return null;

  const handleSave = async () => {
    if (selectedIds.size === 0) return;
    try {
      const updates: any = {};
      if (date) updates.date = toUTCISOString(date);
      if (item) updates.item = item;
      if (amount) updates.amount = parseFloat(amount);
      if (categoryId) updates.category_id = categoryId;

      // Handle Type Update Payload (Decoupled)
      if (typeOption === 'one-off') {
        updates.is_recurring = false;
        updates.recurring_expense_id = null;
      } else if (typeOption === 'recurring') {
        updates.is_recurring = true;
        updates.recurring_expense_id = targetRecurringId || null; // Optional template!
      }

      if (Object.keys(updates).length > 0) {
        const idsArray = Array.from(selectedIds);
        
        // 1. Update backend database
        await bulkUpdateAction(idsArray, updates);
        
        // 2. Update local Zustand state
        updateBulkExpenses(selectedIds, updates);
      }
      
      // 3. Close Modal
      toggleBulkEditModal();
    } catch (error) {
      console.error('Failed to bulk edit expenses', error);
      alert('Failed to bulk edit expenses');
    }
  };

  return (
    <div id="bulk-edit-modal" className="modal" style={{ display: 'flex' }} onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) toggleBulkEditModal();
    }}>
        <div className="modal-content bg-white/40 backdrop-blur-md border border-white/20 shadow-xl text-zen-charcoal rounded-3xl" style={{ maxWidth: '400px', padding: '25px', maxHeight: '90dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-zen-charcoal font-bold m-0 text-left pr-10 leading-snug w-fit" style={{ fontSize: '1.5em', marginBottom: '4px' }}>Bulk Edit ({selectedIds.size} selected)</h2>
            <button 
              className="close-btn rounded-full" 
              onClick={() => toggleBulkEditModal()}
              aria-label="Close Modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <p style={{ marginBottom: '20px', color: 'var(--text-muted)', fontSize: '0.9em' }}>
                Leave fields blank to keep their current values.
            </p>
            <div className="flex flex-col gap-4">
                <input type="date" aria-label="Date" className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50 text-base appearance-none box-border" value={date} onChange={e => setDate(e.target.value)} />
                <input type="text" placeholder="New Item Name (optional)" className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50 text-base appearance-none box-border" value={item} onChange={e => setItem(e.target.value)} />
                
                <div className="flex items-center bg-white/50 border border-zen-lavender/60 rounded-full px-4 h-12 box-border overflow-hidden">
                    <span className="text-zen-charcoal/60 text-base mr-2 flex items-center">$</span>
                    <input type="number" placeholder="New Amount (optional)" className="flex-1 border-none bg-transparent text-zen-charcoal p-0 m-0 text-base outline-none focus:ring-0 appearance-none h-full" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                
                <select aria-label="Category" className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-base appearance-none h-12 box-border" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                  <option value="">Keep current category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                {/* Type Toggling Dropdown */}
                <select 
                  id="bulk-type-option"
                  aria-label="Expense Type" 
                  className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-base appearance-none h-12 box-border" 
                  value={typeOption} 
                  onChange={e => {
                    setTypeOption(e.target.value);
                    if (e.target.value !== 'recurring') setTargetRecurringId('');
                  }}
                >
                  <option value="">Keep current type</option>
                  <option value="one-off">Convert to One-off</option>
                  <option value="recurring">Set as Recurring</option>
                </select>

                {/* Progressive Disclosure select template dropdown (Optional linking) */}
                {typeOption === 'recurring' && (
                  <div className="bg-white/40 border border-white/20 backdrop-blur-md rounded-2xl p-3.5 flex flex-col gap-1.5 text-left animate-fade-in">
                    <label htmlFor="bulk-target-recurring" className="text-xs text-zen-charcoal/60 font-semibold ml-1">
                      Link to existing recurring (Optional)
                    </label>
                    <div className="relative flex items-center w-full">
                      <select 
                        id="bulk-target-recurring"
                        aria-label="Recurring Template" 
                        className="w-full pl-4 pr-10 py-2.5 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-sm appearance-none h-10 box-border cursor-pointer" 
                        value={targetRecurringId} 
                        onChange={e => setTargetRecurringId(e.target.value)}
                      >
                        <option value="">N/A</option>
                        {recurringExpenses.map((rec) => (
                          <option key={rec.id} value={rec.id}>
                            {rec.item} (${rec.amount} / {rec.frequency})
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 pointer-events-none text-zen-charcoal/50 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>
                  </div>
                )}

                <button onClick={handleSave} className="w-full py-4 mt-2 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-lg cursor-pointer border-none">Apply Changes</button>
            </div>
        </div>
    </div>
  );
}
