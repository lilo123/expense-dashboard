'use client';
import { useState, useEffect } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { bulkUpdateAction, bulkDeleteAction } from '@/app/actions';
import { formatUTCToLocal, toUTCISOString, convertAmount } from '@/lib/utils';

export default function EditExpenseModal() {
  const { isEditModalOpen, toggleEditModal, editingExpenseId, expenses, categories, updateBulkExpenses, deleteExpense, baseCurrency, exchangeRates } = useExpenseStore();
   const [date, setDate] = useState('');
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [currency, setCurrency] = useState('USD');

  const editingExpense = expenses.find(e => e.id === editingExpenseId);

  useEffect(() => {
    if (editingExpense) {
      setDate(editingExpense.date ? formatUTCToLocal(editingExpense.date) : '');
      setItem(editingExpense.item || '');
      // Load original spent amount and currency to edit raw transaction values
      setAmount(editingExpense.original_amount?.toString() || editingExpense.amount?.toString() || '');
      setCategoryId(editingExpense.category_id || '');
      setCurrency(editingExpense.original_currency || editingExpense.currency || baseCurrency);
    }
  }, [editingExpense, baseCurrency]);

  if (!isEditModalOpen) return null;

  const handleSave = async () => {
    if (!editingExpenseId) return;
    try {
      const originalAmount = parseFloat(amount);
      let finalAmount = originalAmount;

      // Re-convert edited amount to base currency on save if original currency is foreign
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
        category_id: categoryId
      };
      // 1. Update Supabase backend
      await bulkUpdateAction([editingExpenseId], updates);
      
      // 2. Update local Zustand state so the UI reflects the change immediately
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
        // Instantly remove from local Zustand state
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
            <span id="action-elem-6" className="close" style={{ fontSize: '24px' }} onClick={() => toggleEditModal()}>&times;</span>
            <h2 style={{ marginBottom: '20px', fontSize: '1.5em' }}>Edit Expense</h2>
            <div className="flex flex-col gap-4">
                <input type="hidden" id="edit-row" />
                <input type="date" id="edit-date" className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50 text-base appearance-none box-border" value={date} onChange={e => setDate(e.target.value)} />
                <input type="text" id="edit-item" placeholder="Item Name" className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50 text-base appearance-none box-border" value={item} onChange={e => setItem(e.target.value)} />
                <div className="flex items-center bg-white/50 border border-zen-lavender/60 rounded-full pl-4 pr-2 h-12 box-border overflow-hidden gap-1">
                    <select 
                      value={currency} 
                      aria-label="Currency"
                      onChange={e => setCurrency(e.target.value as any)}
                      className="bg-transparent border-none text-zen-charcoal font-semibold text-base outline-none focus:ring-0 cursor-pointer pr-1 h-full appearance-none"
                      style={{ padding: '0 20px 0 0', backgroundPosition: 'right center' }}
                    >
                      <option value="USD">$</option>
                      <option value="EUR">€</option>
                      <option value="JPY">¥</option>
                      <option value="GBP">£</option>
                      <option value="SGD">S$</option>
                      <option value="VND">₫</option>
                    </select>
                    <input type="number" id="edit-amount" placeholder="Amount" className="flex-1 border-none bg-transparent text-zen-charcoal p-0 m-0 text-base outline-none focus:ring-0 appearance-none h-full" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <select id="edit-category" aria-label="Category" className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-base appearance-none h-12 box-border" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                  <option value="" disabled>Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <button id="save-edit-btn" onClick={handleSave} className="w-full py-4 mt-2 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-lg cursor-pointer border-none">Save Changes</button>
                <button id="delete-edit-btn" onClick={handleDelete} className="w-full py-4 bg-zen-peach text-zen-charcoal rounded-full font-bold hover:bg-zen-peach/90 transition-all text-lg cursor-pointer border-none">Delete</button>
            </div>
        </div>
    </div>
  );
}
