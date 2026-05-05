const fs = require('fs');
const content = `'use client';
import { useState } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { addExpenseAction } from '@/app/actions';

export default function AddExpenseModal() {
  const { isAddModalOpen, toggleAddModal, uniqueCategories, toggleCategoryModal } = useExpenseStore();
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');

  if (!isAddModalOpen) return null;

  const handleAdd = async () => {
    if (!date || !item || !amount || !category) {
      alert('Please fill out all fields.');
      return;
    }
    
    try {
      const newExpense = {
        date,
        item,
        amount: parseFloat(amount),
        category
      };
      
      // Call the server action to insert the expense
      await addExpenseAction(newExpense);
      
      // Reset form and close modal
      setDate(new Date().toISOString().split('T')[0]);
      setItem('');
      setAmount('');
      setCategory('');
      toggleAddModal();
      
    } catch (error) {
      console.error('Failed to add expense:', error);
      alert('Failed to add expense. Please try again.');
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
                
                <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'center' }}>
                  <select id="add-category" value={category} onChange={e => setCategory(e.target.value)} style={{ flex: 1, colorScheme: 'dark', WebkitAppearance: 'none', appearance: 'none', display: 'block', maxWidth: '100%', margin: 0, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px', boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text)', minWidth: 0 }}>
                    <option value="" disabled>Select category</option>
                    {uniqueCategories.map((cat, i) => (
                      <option key={\`\${cat}-\${i}\`} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button id="manage-categories-btn" type="button" onClick={(e) => { e.preventDefault(); toggleCategoryModal(); }} style={{ padding: '12px 15px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', height: '100%', boxSizing: 'border-box' }}>
                    Manage Categories
                  </button>
                </div>

                <button id="add-expense-btn" onClick={handleAdd} style={{ padding: '14px', borderRadius: '8px', fontWeight: 'bold', background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', marginTop: '5px', fontSize: '16px', transition: 'opacity 0.2s' }}>Add Expense</button>
            </div>
        </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/AddExpenseModal.tsx', content);
console.log('AddExpenseModal rewritten successfully.');
