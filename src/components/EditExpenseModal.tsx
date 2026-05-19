'use client';
import { useState, useEffect } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { bulkUpdateAction, bulkDeleteAction } from '@/app/actions';
import { getRecurringExpensesAction } from '@/app/actions/recurring';
import { formatUTCToLocal, toUTCISOString, convertAmount } from '@/lib/utils';
import { RecurringExpense } from '@/types/database';
import Switch from '@/components/ui/Switch';

export default function EditExpenseModal() {
  const { 
    isEditModalOpen, 
    toggleEditModal, 
    editingExpenseId, 
    expenses, 
    categories, 
    recurringExpenses,
    hydrate,
    updateBulkExpenses, 
    deleteExpense, 
    baseCurrency, 
    exchangeRates 
  } = useExpenseStore();

  const [date, setDate] = useState('');
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [currency, setCurrency] = useState('USD');
  
  // Custom Tailwind Toggle & Template State (Decoupled)
  const [isRecurring, setIsRecurring] = useState(false);
  const [targetRecurringId, setTargetRecurringId] = useState('');

  const editingExpense = expenses.find(e => e.id === editingExpenseId);

  // Fetch and hydrate recurring templates on open
  useEffect(() => {
    if (isEditModalOpen) {
      async function fetchTemplates() {
        try {
          const res = await getRecurringExpensesAction();
          if (res.success && res.data) {
            hydrate({ recurringExpenses: res.data as RecurringExpense[] });
          }
        } catch (error) {
          console.error('[EDIT MODAL TEMPLATES FETCH ERROR]:', error);
        }
      }
      fetchTemplates();
    }
  }, [isEditModalOpen, hydrate]);

  // Hydrate form states from editingExpense
  useEffect(() => {
    if (editingExpense) {
      setDate(editingExpense.date ? formatUTCToLocal(editingExpense.date) : '');
      setItem(editingExpense.item || '');
      setAmount(editingExpense.original_amount?.toString() || editingExpense.amount?.toString() || '');
      setCategoryId(editingExpense.category_id || '');
      setCurrency(editingExpense.original_currency || editingExpense.currency || baseCurrency);
      
      // Hydrate decoupled visual type and optional template IDs
      setIsRecurring(editingExpense.is_recurring || false);
      setTargetRecurringId(editingExpense.recurring_expense_id || '');
    }
  }, [editingExpense, baseCurrency]);

  if (!isEditModalOpen) return null;

  const handleSave = async () => {
    if (!editingExpenseId) return;
    try {
      const originalAmount = parseFloat(amount);
      let finalAmount = originalAmount;

      if (currency !== baseCurrency) {
        finalAmount = convertAmount(originalAmount, currency, baseCurrency, exchangeRates);
      }

      const updates: any = {
        date: date ? toUTCISOString(date) : undefined,
        item,
        amount: finalAmount,
        original_amount: originalAmount,
        original_currency: currency,
        currency: currency,
        category_id: categoryId,
        // Decoupled visual & scheduling parameters
        is_recurring: isRecurring,
        recurring_expense_id: isRecurring && targetRecurringId ? targetRecurringId : null
      };

      // 1. Update Supabase backend
      await bulkUpdateAction([editingExpenseId], updates);
      
      // 2. Update local Zustand state
      updateBulkExpenses(new Set([editingExpenseId]), updates);
      
      // 3. Close Modal
      toggleEditModal();
    } catch (error) {
      console.error('Failed to save expense', error);
      alert('Failed to save expense');
    }
  };

  const handleDelete = async () => {
    if (!editingExpenseId) return;
    if (confirm('Are you sure you want to delete this expense?')) {
      try {
        await bulkDeleteAction([editingExpenseId]);
        deleteExpense(editingExpenseId);
        toggleEditModal();
      } catch (error) {
        console.error('Failed to delete expense', error);
        alert('Failed to delete expense');
      }
    }
  };

  return (
    <div id="edit-modal" className="modal" style={{ display: 'flex' }} onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) toggleEditModal();
    }}>
        <div className="modal-content bg-white/40 backdrop-blur-md border border-white/20 shadow-xl text-zen-charcoal rounded-3xl" style={{ maxWidth: '400px', padding: '25px', maxHeight: '90dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-zen-charcoal font-bold m-0 text-left pr-10 leading-snug w-fit" style={{ fontSize: '1.5em', marginBottom: '20px' }}>Edit Expense</h2>
            <button 
              id="action-elem-6" 
              className="close-btn rounded-full" 
              onClick={() => toggleEditModal()}
              aria-label="Close Modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div className="flex flex-col gap-4">
                <input type="hidden" id="edit-row" />
                <input type="date" id="edit-date" className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50 text-base appearance-none box-border" value={date} onChange={e => setDate(e.target.value)} />
                <input type="text" id="edit-item" placeholder="Item Name" className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50 text-base appearance-none box-border" value={item} onChange={e => setItem(e.target.value)} />
                
                <div className="flex items-center bg-white/50 border border-zen-lavender/60 rounded-full h-12 box-border overflow-hidden">
                    <div className="relative flex items-center h-full bg-zen-lavender/15 border-r border-zen-lavender/45 px-4 rounded-l-full">
                        <select 
                          value={currency} 
                          aria-label="Currency"
                          onChange={e => setCurrency(e.target.value as any)}
                          className="bg-transparent border-none text-zen-charcoal font-bold text-base outline-none focus:ring-0 cursor-pointer pr-5 h-full appearance-none z-10"
                        >
                          <option value="CAD">C$</option>
                          <option value="VND">₫</option>
                          <option value="USD">$</option>
                          <option value="EUR">€</option>
                          <option value="JPY">¥</option>
                          <option value="GBP">£</option>
                          <option value="SGD">S$</option>
                        </select>
                        <div className="absolute right-2 pointer-events-none text-zen-charcoal/50 flex items-center justify-center z-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                    </div>
                    <input type="number" id="edit-amount" placeholder="Amount" className="flex-1 border-none bg-transparent text-zen-charcoal px-4 m-0 text-base outline-none focus:ring-0 appearance-none h-full" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                
                <select id="edit-category" aria-label="Category" className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-base appearance-none h-12 box-border" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                  <option value="" disabled>Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                {/* Premium Brand-Compliant Custom Tailwind Toggle Row using Switch primitive */}
                <div className="flex items-center justify-between px-5 py-3 bg-white/20 border border-white/15 rounded-full shadow-sm">
                  <div className="flex flex-col text-left">
                    <span className="text-base font-bold text-zen-charcoal">Recurring Expense</span>
                  </div>
                  <Switch 
                    id="edit-recurring-toggle"
                    checked={isRecurring} 
                    onChange={(val) => {
                      setIsRecurring(val);
                      if (!val) setTargetRecurringId('');
                    }}
                    ariaLabel="Toggle Recurring Status"
                  />
                </div>

                {/* Progressive Disclosure Dropdown (Optional template association) */}
                {isRecurring && (
                  <div className="bg-white/40 border border-white/20 backdrop-blur-md rounded-2xl p-3.5 flex flex-col gap-1.5 text-left animate-fade-in">
                    <label htmlFor="edit-target-recurring" className="text-xs text-zen-charcoal/60 font-semibold ml-1">
                      Link to existing recurring (Optional)
                    </label>
                    <div className="relative flex items-center w-full">
                      <select 
                        id="edit-target-recurring"
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

                <button id="save-edit-btn" onClick={handleSave} className="w-full py-4 mt-2 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-lg cursor-pointer border-none">Save Changes</button>
                <button id="delete-edit-btn" onClick={handleDelete} className="w-full py-4 bg-zen-peach text-zen-charcoal rounded-full font-bold hover:bg-zen-peach/90 transition-all text-lg cursor-pointer border-none">Delete</button>
            </div>
        </div>
    </div>
  );
}
