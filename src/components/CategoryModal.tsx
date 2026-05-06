'use client';
import { useState } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { addCategoryAction, updateCategoryAction, deleteCategoryAction } from '@/app/actions';
import { Category } from '@/types/database';

export default function CategoryModal() {
  const { isCategoryModalOpen, toggleCategoryModal, categories, addCategory, updateCategory, removeCategory, updateCategoryInExpenses } = useExpenseStore();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [fallbackCategoryId, setFallbackCategoryId] = useState<string>('');
  const [isDeletingEmpty, setIsDeletingEmpty] = useState<boolean>(false);

  const otherCategories = categoryToDelete ? categories.filter(c => c.id !== categoryToDelete.id) : [];
  const hasOtherCategories = otherCategories.length > 0;

  if (!isCategoryModalOpen) return null;

  const handleAdd = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await addCategoryAction(newCategoryName.trim());
      if (res.success && res.data) {
        addCategory(res.data as Category);
        setNewCategoryName('');
      } else {
        alert(res.error || 'Failed to add category');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      const res = await updateCategoryAction(editingId, editName.trim());
      if (res.success) {
        updateCategory(editingId, editName.trim());
        setEditingId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const initiateDelete = (cat: Category) => {
    const expenses = useExpenseStore.getState().expenses;
    const hasExpenses = expenses.some((e) => e.category_id === cat.id);
    
    setCategoryToDelete(cat);
    setIsDeletingEmpty(!hasExpenses);
    
    if (hasExpenses) {
      const otherCategories = categories.filter(c => c.id !== cat.id);
      if (otherCategories.length > 0) {
        setFallbackCategoryId(otherCategories[0].id);
      } else {
        setFallbackCategoryId('');
      }
    } else {
      setFallbackCategoryId('');
    }
  };

  const confirmDelete = async (categoryIdToDel: string, fallbackId?: string) => {
    try {
      const res = await deleteCategoryAction(categoryIdToDel, fallbackId);
      if (res.success) {
        if (fallbackId) {
          updateCategoryInExpenses(categoryIdToDel, fallbackId);
        }
        removeCategory(categoryIdToDel);
        setCategoryToDelete(null);
        setFallbackCategoryId('');
      } else {
        alert(res.error || 'Failed to delete category');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <div className="modal" style={{ display: 'flex' }} onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('modal')) toggleCategoryModal();
      }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
              <span className="close" onClick={() => toggleCategoryModal()}>&times;</span>
              <h2>Manage Categories</h2>
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <input 
                      type="text" 
                      placeholder="New category name"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      style={{ flex: 1, marginBottom: 0 }}
                  />
                  <button onClick={handleAdd} style={{ width: 'auto' }}>Add</button>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {categories.map((cat) => (
                      <li key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                          {editingId === cat.id ? (
                              <input 
                                  type="text" 
                                  value={editName}
                                  onChange={e => setEditName(e.target.value)}
                                  style={{ marginBottom: 0, marginRight: '10px' }}
                              />
                          ) : (
                              <span>{cat.name}</span>
                          )}
                          <div style={{ display: 'flex', gap: '5px' }}>
                              {editingId === cat.id ? (
                                  <button onClick={saveEdit} style={{ padding: '4px 8px', width: 'auto' }}>Save</button>
                              ) : (
                                  <div onClick={() => startEdit(cat)} style={{ cursor: 'pointer', padding: '4px' }}>
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>
                                  </div>
                              )}
                              <div onClick={() => initiateDelete(cat)} style={{ cursor: 'pointer', padding: '4px', color: '#f44336' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                              </div>
                          </div>
                      </li>
                  ))}
              </ul>
          </div>
      </div>

      {categoryToDelete && (
        <div className="modal" style={{ display: 'flex', zIndex: 1000 }} onClick={(e) => {
          if ((e.target as HTMLElement).classList.contains('modal')) setCategoryToDelete(null);
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{isDeletingEmpty ? 'Confirm Deletion' : (hasOtherCategories ? 'Reassign Expenses' : 'Cannot Delete')}</h2>
            <p>
              {isDeletingEmpty 
                ? <>Are you sure you want to delete <strong>{categoryToDelete.name}</strong>?</>
                : (hasOtherCategories 
                    ? <><strong>{categoryToDelete.name}</strong> contains expenses. Please select a category to reassign them to before deleting.</>
                    : <><strong>{categoryToDelete.name}</strong> contains expenses. You cannot delete this category because there are no other categories to reassign the expenses to.</>
                  )
              }
            </p>
            
            {!isDeletingEmpty && hasOtherCategories && (
            <div style={{ margin: '20px 0' }}>
              <select 
                value={fallbackCategoryId} 
                onChange={e => setFallbackCategoryId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              >
                <option value="" disabled>Select a new category</option>
                {otherCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            )}

            {!isDeletingEmpty && !hasOtherCategories && (
              <div style={{ margin: '15px 0', padding: '12px', background: '#ffebee', color: '#d32f2f', borderRadius: '8px', fontSize: '0.9em', border: '1px solid #ffcdd2' }}>
                <strong>Warning:</strong> Please create at least one other category first before you can delete this one.
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setCategoryToDelete(null)} 
                style={{ backgroundColor: '#f1f3f4', color: '#333', border: '1px solid #ccc', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => confirmDelete(categoryToDelete.id, isDeletingEmpty ? undefined : fallbackCategoryId)}
                disabled={!isDeletingEmpty && (!fallbackCategoryId || !hasOtherCategories)}
                style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', opacity: (!isDeletingEmpty && (!fallbackCategoryId || !hasOtherCategories)) ? 0.5 : 1 }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
