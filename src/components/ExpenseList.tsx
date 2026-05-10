'use client';
import { useState } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { convertAmount, formatFriendlyCurrency } from '@/lib/utils';
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
    updateBulkExpenses,
    displayCurrency,
    baseCurrency,
    exchangeRates
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
    <div className={`${isSelectMode ? "select-mode" : ""}`}>
        <div className="recent-header-controls flex gap-2 items-center mb-3">
            <button id="select-mode-btn" onClick={toggleSelectMode} className="px-4 py-2 rounded-full border border-zen-lavender/40 bg-white/60 hover:bg-white/80 text-zen-charcoal font-semibold transition-all text-sm cursor-pointer h-9 flex items-center">
              {isSelectMode ? 'Cancel' : 'Select'}
            </button>
            <div id="bulk-actions" className="gap-2 items-center" style={{ display: isSelectMode ? 'flex' : 'none' }}>
                <button 
                  id="bulk-edit-btn" 
                  onClick={handleBulkEditClick}
                  disabled={selectedIds.size === 0}
                  className="px-4 py-2 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none h-9 flex items-center"
                >
                  Edit Selected
                </button>
                <button 
                  id="bulk-delete-btn" 
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.size === 0}
                  className="px-4 py-2 bg-zen-peach text-zen-charcoal rounded-full font-bold hover:bg-zen-peach/90 transition-all text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none h-9 flex items-center"
                >
                  Delete Selected
                </button>
            </div>
        </div>
        <div className="recent-list pb-24 flex flex-col gap-3" id="recent-list">
            {expenses.map((exp: Expense) => {
              const amtBase = parseFloat(exp.amount as any) || 0;
              const dateStr = formatFriendlyDate(exp.date);
              
              // Select which currency amount to show:
              // If displayCurrency is swapped, show converted. Otherwise, show exact original receipt value!
              let displayAmt = exp.original_amount || amtBase;
              let displayCurr = exp.original_currency || exp.currency || 'USD';

              if (displayCurrency !== baseCurrency) {
                displayAmt = convertAmount(amtBase, baseCurrency, displayCurrency, exchangeRates);
                displayCurr = displayCurrency;
              }

              return (
                <div 
                  key={exp.id} 
                  className={`expense-item transition-all duration-200 bg-white/40 backdrop-blur-md border text-zen-charcoal p-4 rounded-2xl cursor-pointer flex items-center justify-between hover:bg-white/60 ${
                    selectedIds.has(exp.id) 
                      ? 'bg-zen-sage/20 border-zen-sage shadow-sm' 
                      : 'border-white/20'
                  }`}
                  data-id={exp.id} 
                  data-item={exp.item} 
                  data-amount={displayAmt} 
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
                    <div className="expense-amount">
                      {formatFriendlyCurrency(displayAmt, displayCurr)}
                    </div>
                </div>
              );
            })}
        </div>
    </div>
  );
}
