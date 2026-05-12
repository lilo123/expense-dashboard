'use client';
import { useState, useEffect } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { addExpenseAction } from '@/app/actions';
import { toUTCISOString, convertAmount } from '@/lib/utils';

export default function AddExpenseModal() {
  const { isAddModalOpen, toggleAddModal, categories, toggleCategoryModal, addExpense, baseCurrency, exchangeRates } = useExpenseStore();
  
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  });
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [category_id, setCategoryId] = useState('');
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    if (isAddModalOpen) {
      setCurrency(baseCurrency);
    }
  }, [isAddModalOpen, baseCurrency]);

  if (!isAddModalOpen) return null;

  const handleAdd = async () => {
    if (!date || !item || !amount || !category_id) {
      alert('Please fill out all fields.');
      return;
    }
    
    try {
      const utcDateString = toUTCISOString(date);
      const originalAmount = parseFloat(amount);
      let finalAmount = originalAmount;

      // Convert amount to base currency instantly before database write
      if (currency !== baseCurrency) {
        finalAmount = convertAmount(originalAmount, currency, baseCurrency, exchangeRates);
      }

      const response = await addExpenseAction({
        date: utcDateString,
        item,
        amount: finalAmount,
        original_amount: originalAmount,
        original_currency: currency,
        currency: currency,
        category_id
      });

      if (response.success && response.data) {
        addExpense(response.data);
        toggleAddModal();
        // Reset form
        const d = new Date();
        setDate(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
        setItem('');
        setAmount('');
        setCategoryId('');
      } else {
        alert(response.error || 'Failed to add expense');
      }
    } catch (error) {
      console.error('Failed to add expense', error);
      alert('Failed to add expense');
    }
  };

  return (
    <div id="add-modal" className="modal" style={{ display: 'flex' }} onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) toggleAddModal();
    }}>
        <div className="modal-content bg-white/40 backdrop-blur-md border border-white/20 shadow-xl text-zen-charcoal rounded-3xl" style={{ maxWidth: '400px', padding: '25px', maxHeight: '90dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <span id="action-elem-9" className="close" style={{ fontSize: '24px' }} onClick={toggleAddModal}>&times;</span>
            <h2 className="text-zen-charcoal font-bold m-0 text-left" style={{ marginBottom: '20px', fontSize: '1.5em', marginRight: '40px' }}>Add Expense</h2>
            <div className="flex flex-col gap-4">
                <input type="date" id="add-date" required value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50 text-base appearance-none box-border" />
                <input type="text" id="add-item" placeholder="What did you buy?" required value={item} onChange={e => setItem(e.target.value)} className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50 text-base appearance-none box-border" />
                <div className="flex items-center bg-white/50 border border-zen-lavender/60 rounded-full pl-4 pr-2 h-12 box-border overflow-hidden gap-1">
                    <select 
                      value={currency} 
                      aria-label="Currency"
                      onChange={e => setCurrency(e.target.value as any)}
                      className="bg-transparent border-none text-zen-charcoal font-semibold text-base outline-none focus:ring-0 cursor-pointer pr-1 h-full appearance-none"
                      style={{ padding: '0 20px 0 0', backgroundPosition: 'right center' }}
                    >
                      <option value="CAD">C$</option>
                      <option value="VND">₫</option>
                      <option value="USD">$</option>
                      <option value="EUR">€</option>
                      <option value="JPY">¥</option>
                      <option value="GBP">£</option>
                      <option value="SGD">S$</option>
                    </select>
                    <input type="number" id="add-amount" placeholder="0.00" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="flex-1 border-none bg-transparent text-zen-charcoal p-0 m-0 text-base outline-none focus:ring-0 appearance-none h-full" />
                </div>
                
                <div className="flex gap-2 w-full mb-3 h-11">
                  <select 
                    id="add-category" 
                    value={category_id} 
                    aria-label="Category"
                    onChange={e => setCategoryId(e.target.value)}
                    className="flex-1 px-4 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-base appearance-none h-full"
                  >
                    <option value="" disabled>Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  
                  <button 
                    type="button"
                    onClick={() => toggleCategoryModal()}
                    title="Manage Categories"
                    className="w-11 h-11 rounded-full border border-zen-lavender/40 bg-white/60 hover:bg-white/80 text-zen-charcoal/60 hover:text-zen-charcoal cursor-pointer flex items-center justify-center p-0 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                  </button>
                </div>

                <button id="add-expense-btn" onClick={handleAdd} className="w-full py-4 mt-2 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-lg cursor-pointer border-none">Add Expense</button>
            </div>
        </div>
    </div>
  );
}
