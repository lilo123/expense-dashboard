'use client';
import { useState } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { addExpenseAction } from '@/app/actions';
import { toUTCISOString } from '@/lib/utils';

export default function AddExpenseModal() {
  const { isAddModalOpen, toggleAddModal, categories, toggleCategoryModal, addExpense } = useExpenseStore();
  
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  });
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [category_id, setCategoryId] = useState('');

  if (!isAddModalOpen) return null;

  const handleAdd = async () => {
    if (!date || !item || !amount || !category_id) {
      alert('Please fill out all fields.');
      return;
    }
    
    try {
      const utcDateString = toUTCISOString(date);

      const response = await addExpenseAction({
        date: utcDateString,
        item,
        amount: parseFloat(amount),
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
        <div className="modal-content" style={{ maxWidth: '400px', padding: '25px', borderRadius: '12px', maxHeight: '90dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <span id="action-elem-9" className="close" style={{ fontSize: '24px' }} onClick={toggleAddModal}>&times;</span>
            <h2 style={{ marginBottom: '20px', fontSize: '1.5em', color: 'var(--text)' }}>Add Expense</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input type="date" id="add-date" required value={date} onChange={e => setDate(e.target.value)} style={{ colorScheme: 'dark', WebkitAppearance: 'none', appearance: 'none', display: 'block', maxWidth: '100%', margin: 0, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px', width: '100%', boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text)' }} />
                <input type="text" id="add-item" placeholder="What did you buy?" required value={item} onChange={e => setItem(e.target.value)} style={{ colorScheme: 'dark', WebkitAppearance: 'none', appearance: 'none', display: 'block', maxWidth: '100%', margin: 0, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px', width: '100%', boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text)' }} />
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 12px', overflow: 'hidden', boxSizing: 'border-box', height: '46px' }}>
                    <span style={{ color: '#666', fontSize: '16px', marginRight: '6px', display: 'flex', alignItems: 'center', lineHeight: 1, height: '100%', marginTop: '2px' }}>$</span>
                    <input type="number" id="add-amount" placeholder="0.00" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text)', padding: 0, margin: 0, fontSize: '16px', boxSizing: 'border-box', outline: 'none', colorScheme: 'dark', WebkitAppearance: 'none', height: '100%', lineHeight: '44px', display: 'flex', alignItems: 'center' }} />
                </div>
                
                <div style={{ display: 'flex', gap: '10px', width: '100%', marginBottom: '15px', height: '44px' }}>
                  <select 
                    id="add-category" 
                    value={category_id} 
                    onChange={e => setCategoryId(e.target.value)}
                    style={{ flex: 1, padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', boxSizing: 'border-box', height: '100%', backgroundColor: 'transparent', color: 'inherit' }}
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
                    style={{ width: '44px', height: '44px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#f3f4f6', cursor: 'pointer', boxSizing: 'border-box', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0', transition: 'background 0.2s' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                  </button>
                </div>

                <button id="add-expense-btn" onClick={handleAdd} style={{ padding: '14px', borderRadius: '8px', fontWeight: 'bold', background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', marginTop: '5px', fontSize: '16px', transition: 'opacity 0.2s' }}>Add Expense</button>
            </div>
        </div>
    </div>
  );
}
