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
        <div className="modal-content bg-white/40 backdrop-blur-md border border-white/20 shadow-xl text-zen-charcoal rounded-3xl" style={{ maxWidth: '400px', padding: '25px', maxHeight: '90dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <span className="close" style={{ fontSize: '24px' }} onClick={() => toggleBulkEditModal()}>&times;</span>
            <h2 style={{ fontSize: '1.5em', marginBottom: '5px' }}>Bulk Edit ({selectedIds.size} selected)</h2>
            <p style={{ marginBottom: '20px', color: 'var(--text-muted)', fontSize: '0.9em' }}>
                Leave fields blank to keep their current values.
            </p>
            <div className="flex flex-col gap-4">
                <input type="date" className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50 text-base appearance-none box-border" value={date} onChange={e => setDate(e.target.value)} />
                <input type="text" placeholder="New Item Name (optional)" className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50 text-base appearance-none box-border" value={item} onChange={e => setItem(e.target.value)} />
                <div className="flex items-center bg-white/50 border border-zen-lavender/60 rounded-full px-4 h-12 box-border overflow-hidden">
                    <span className="text-zen-charcoal/60 text-base mr-2 flex items-center">$</span>
                    <input type="number" placeholder="New Amount (optional)" className="flex-1 border-none bg-transparent text-zen-charcoal p-0 m-0 text-base outline-none focus:ring-0 appearance-none h-full" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <select className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-base appearance-none h-12 box-border" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                  <option value="">Keep current category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <button onClick={handleSave} className="w-full py-4 mt-2 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-lg cursor-pointer border-none">Apply Changes</button>
            </div>
        </div>
    </div>
  );
}
