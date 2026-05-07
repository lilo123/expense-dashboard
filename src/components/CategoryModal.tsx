'use client';
import { useState } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { addCategoryAction, updateCategoryAction, deleteCategoryAction } from '@/app/actions';
import { Category } from '@/types/database';

export default function CategoryModal() {
  const { isCategoryModalOpen, toggleCategoryModal, categories, addCategory, updateCategory, removeCategory, updateCategoryInExpenses, expenses } = useExpenseStore();
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
          <div className="modal-content bg-white/40 backdrop-blur-md border border-white/20 shadow-xl text-zen-charcoal" onClick={e => e.stopPropagation()}>
              <span className="close" onClick={() => toggleCategoryModal()}>&times;</span>
              <h2>Manage Categories</h2>
              
              <div className="flex gap-2 mb-5 items-center w-full">
                  <input 
                      type="text" 
                      placeholder="New category name"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      className="flex-1 px-4 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50 text-base h-10"
                  />
                  <button onClick={handleAdd} className="px-6 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-colors text-base cursor-pointer h-10 flex items-center justify-center border-none">Add</button>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {categories.map((cat) => (
                      <li key={cat.id} className="flex justify-between items-center py-3 border-b border-zen-lavender/60">
                          {editingId === cat.id ? (
                              <input 
                                  type="text" 
                                  value={editName}
                                  onChange={e => setEditName(e.target.value)}
                                  className="px-3 py-1 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal mr-2 text-base"
                              />
                          ) : (
                              <span className="font-semibold text-zen-charcoal">{cat.name}</span>
                          )}
                          <div className="flex gap-2 items-center">
                              {editingId === cat.id ? (
                                  <button onClick={saveEdit} className="px-3 py-1 bg-zen-charcoal text-zen-base rounded-full font-semibold hover:bg-zen-charcoal/90 text-sm cursor-pointer">Save</button>
                              ) : (
                                  <div onClick={() => startEdit(cat)} className="cursor-pointer p-1 text-zen-charcoal/60 hover:text-zen-sage transition-colors">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>
                                  </div>
                              )}
                              <div onClick={() => initiateDelete(cat)} className="cursor-pointer p-1 text-zen-charcoal/60 hover:text-zen-peach transition-colors">
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
          <div className="modal-content bg-white/40 backdrop-blur-md border border-white/20 shadow-xl text-zen-charcoal" onClick={e => e.stopPropagation()}>
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
              <div className="my-4 p-3 bg-zen-peach/20 border border-zen-peach/50 text-zen-charcoal rounded-full text-sm text-center">
                <strong>Warning:</strong> Please create at least one other category first before you can delete this one.
              </div>
            )}

            <div className="flex gap-2 justify-end mt-4">
              <button 
                onClick={() => setCategoryToDelete(null)} 
                className="px-4 py-2 bg-white/60 border border-zen-lavender/40 text-zen-charcoal rounded-full font-semibold hover:bg-white/80 transition-colors text-base cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => confirmDelete(categoryToDelete.id, isDeletingEmpty ? undefined : fallbackCategoryId)}
                disabled={!isDeletingEmpty && (!fallbackCategoryId || !hasOtherCategories)}
                className="px-4 py-2 bg-zen-peach text-zen-charcoal rounded-full font-bold hover:bg-zen-peach/90 transition-colors border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-base"
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
