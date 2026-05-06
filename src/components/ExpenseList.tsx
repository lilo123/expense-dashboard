'use client';
import { useState } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { bulkDeleteAction } from '@/app/actions';
import { Expense } from '@/types/database';
import { formatFriendlyDate } from '@/lib/utils';

export default function ExpenseList() {
  const { 
    expenses, 
    isSelectMode, 
    toggleSelectMode, 
    selectedIds, 
    toggleSelection, 
    deleteSelected, 
    toggleEditModal,
    toggleBulkEditModal,
    updateBulkExpenses
  } = useExpenseStore();

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} expense(s)?`)) {
      try {
        await bulkDeleteAction(Array.from(selectedIds));
        deleteSelected();
      } catch (error) {
        console.error('Failed to delete expenses', error);
        alert('Failed to delete expenses');
      }
    }
  };

  const handleBulkEditClick = () => {
    if (selectedIds.size > 0) {
      toggleBulkEditModal();
    }
  };


  return (
    <div id="tab-recent" className={`tab-content active ${isSelectMode ? "select-mode" : ""}`} style={{ display: "block" }}>
        <div className="recent-header-controls" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
            <button id="select-mode-btn" onClick={toggleSelectMode}>
              {isSelectMode ? 'Cancel' : 'Select'}
            </button>
            <div id="bulk-actions" style={{ display: isSelectMode ? 'flex' : 'none', gap: '10px', alignItems: 'center' }}>
                <button 
                  id="bulk-edit-btn" 
                  onClick={handleBulkEditClick}
                  disabled={selectedIds.size === 0}
                  style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed', opacity: selectedIds.size > 0 ? 1 : 0.5 }}>
                  Edit Selected
                </button>
                <button 
                  id="bulk-delete-btn" 
                  className="danger-btn" 
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.size === 0}
                  style={{ opacity: selectedIds.size > 0 ? 1 : 0.5 }}>
                  Delete Selected
                </button>
            </div>
        </div>
        <div className="recent-list" id="recent-list">
            {expenses.map((exp: Expense) => {
              const amt = parseFloat(exp.amount as any) || 0;
              const dateStr = formatFriendlyDate(exp.date);
              
              return (
                <div 
                  key={exp.id} 
                  className={`expense-item transition-colors duration-200 ${
                    selectedIds.has(exp.id) 
                      ? 'bg-black/[0.04] dark:bg-white/[0.04] border-black dark:border-white' 
                      : 'bg-[var(--card-bg)] border-[var(--border)]'
                  }`}
                  data-id={exp.id} 
                  data-item={exp.item} 
                  data-amount={amt} 
                  data-category={exp.categories?.name || "Uncategorized"} 
                  data-date={exp.date}
                  onClick={() => {
                    if (isSelectMode) {
                      toggleSelection(exp.id);
                    } else {
                      toggleEditModal(exp.id);
                    }
                  }}
                >
                    <input 
                      type="checkbox" 
                      className="expense-checkbox" 
                      checked={selectedIds.has(exp.id)}
                      onChange={() => toggleSelection(exp.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="expense-info">
                        <h4>{exp.item}</h4>
                        <p>{exp.categories?.name || "Uncategorized"} &bull; {dateStr}</p>
                    </div>
                    <div className="expense-amount">${amt.toFixed(2)}</div>
                </div>
              );
            })}
        </div>
    </div>
  );
}
