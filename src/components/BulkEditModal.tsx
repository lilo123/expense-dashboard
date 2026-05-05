'use client';
import { useState, useEffect } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { bulkUpdateAction } from '@/app/actions';
import { Category } from '@/types/database';
import { toUTCISOString } from '@/lib/utils';

export default function BulkEditModal() {
  const { isBulkEditModalOpen, toggleBulkEditModal, selectedIds, categories, updateBulkExpenses } = useExpenseStore();
  const [date, setDate] = useState('');
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    if (isBulkEditModalOpen) {
      setDate('');
      setItem('');
      setAmount('');
      setCategoryId('');
    }
  }, [isBulkEditModalOpen]);

  if (!isBulkEditModalOpen) return null;

  const handleSave = async () => {
    if (selectedIds.size === 0) return;
    try {
      const updates: any = {};
      if (date) updates.date = toUTCISOString(date);
      if (item) updates.item = item;
      if (amount) updates.amount = parseFloat(amount);
      if (categoryId) updates.category_id = categoryId;

      if (Object.keys(updates).length > 0) {
        const idsArray = Array.from(selectedIds);
        
        // 1. Update Supabase backend
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
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            <span className="close" onClick={() => toggleBulkEditModal()}>&times;</span>
            <h2>Bulk Edit ({selectedIds.size} selected)</h2>
            <p style={{ marginBottom: '15px', color: 'var(--text-muted)', fontSize: '0.9em' }}>
                Leave fields blank to keep their current values.
            </p>
            
            <input type="date" style={{ colorScheme: 'dark' }} value={date} onChange={e => setDate(e.target.value)} />
            <input type="text" placeholder="New Item Name (optional)" style={{ colorScheme: 'dark' }} value={item} onChange={e => setItem(e.target.value)} />
            <input type="number" placeholder="New Amount (optional)" style={{ colorScheme: 'dark' }} value={amount} onChange={e => setAmount(e.target.value)} />
            <select style={{ colorScheme: 'dark' }} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">Keep current category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <button onClick={handleSave}>Apply Changes</button>
        </div>
    </div>
  );
}
