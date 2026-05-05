'use client';
import { useState, useEffect } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { bulkUpdateAction, bulkDeleteAction } from '@/app/actions';
import { formatUTCToLocal, toUTCISOString } from '@/lib/utils';

export default function EditExpenseModal() {
  const { isEditModalOpen, toggleEditModal, editingExpenseId, expenses, categories, updateBulkExpenses } = useExpenseStore();
  const [date, setDate] = useState('');
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const editingExpense = expenses.find(e => e.id === editingExpenseId);

  useEffect(() => {
    if (editingExpense) {
      setDate(editingExpense.date ? formatUTCToLocal(editingExpense.date) : '');
      setItem(editingExpense.item || '');
      setAmount(editingExpense.amount?.toString() || '');
      setCategoryId(editingExpense.category_id || '');
    }
  }, [editingExpense]);

  if (!isEditModalOpen) return null;

  const handleSave = async () => {
    if (!editingExpenseId) return;
    try {
      const updates: any = {
        date: date ? toUTCISOString(date) : undefined,
        item,
        amount: parseFloat(amount),
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
        useExpenseStore.setState((state) => ({
          expenses: state.expenses.filter(e => e.id !== editingExpenseId)
        }));
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
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            <span id="action-elem-6" className="close" onClick={() => toggleEditModal()}>&times;</span>
            <h2>Edit Expense</h2>
            <input type="hidden" id="edit-row" />
            <input type="date" id="edit-date" style={{ colorScheme: 'dark' }} value={date} onChange={e => setDate(e.target.value)} />
            <input type="text" id="edit-item" placeholder="Item Name" style={{ colorScheme: 'dark' }} value={item} onChange={e => setItem(e.target.value)} />
            <input type="number" id="edit-amount" placeholder="Amount" style={{ colorScheme: 'dark' }} value={amount} onChange={e => setAmount(e.target.value)} />
            <select id="edit-category" style={{ colorScheme: 'dark' }} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="" disabled>Select category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <button id="save-edit-btn" onClick={handleSave}>Save Changes</button>
            <button id="delete-edit-btn" className="danger-btn" style={{ marginTop: '10px' }} onClick={handleDelete}>Delete</button>
        </div>
    </div>
  );
}
