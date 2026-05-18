'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { convertAmount, formatFriendlyCurrency } from '@/lib/utils';
import { bulkDeleteAction } from '@/app/actions';
import { Expense } from '@/types/database';
import { formatFriendlyDate } from '@/lib/utils';
import { ListFilter, ChevronDown } from 'lucide-react';

import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';

export default function ExpenseList() {
  const { 
    expenses, 
    categories,
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

  // Filter & Sort States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [sortDirection, setSortDirection] = useState<'highest' | 'lowest'>('highest');
  const [sortMetric, setSortMetric] = useState<'date' | 'amount'>('date');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortPopoverRef = useRef<HTMLDivElement>(null);

  // Dismiss sort popover panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortPopoverRef.current && !sortPopoverRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
    };
    if (isSortOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSortOpen]);

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

  // Derived filtered and sorted list
  const filteredAndSortedExpenses = useMemo(() => {
    return expenses
      .filter((exp: Expense) => {
        const matchesSearch = exp.item.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategories.size === 0 || selectedCategories.has(exp.category_id);
        const isRecurring = exp.is_recurring || !!exp.recurring_expense_id;
        const expType = isRecurring ? 'recurring' : 'one-off';
        const matchesType = selectedTypes.size === 0 || selectedTypes.has(expType);
        return matchesSearch && matchesCategory && matchesType;
      })
      .sort((a, b) => {
        if (sortMetric === 'date') {
          const timeA = new Date(a.date).getTime();
          const timeB = new Date(b.date).getTime();
          return sortDirection === 'highest' ? timeB - timeA : timeA - timeB;
        } else {
          const amtA = Number(a.amount) || 0;
          const amtB = Number(b.amount) || 0;
          return sortDirection === 'highest' ? amtB - amtA : amtA - amtB;
        }
      });
  }, [expenses, searchQuery, selectedCategories, selectedTypes, sortMetric, sortDirection]);

  const categoryOptions = useMemo(() => {
    return categories.map(cat => ({ id: cat.id, name: cat.name }));
  }, [categories]);

  const typeOptions = [
    { id: 'one-off', name: 'One-off' },
    { id: 'recurring', name: 'Recurring' }
  ];

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef<boolean>(false);

  const startPress = (expId: string) => {
    isLongPressTriggeredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
      if (!isSelectMode) {
        toggleSelectMode();
      }
      toggleSelection(expId);
    }, 500);
  };

  const cancelPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleItemClick = (expId: string) => {
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }
    if (isSelectMode) {
      toggleSelection(expId);
    } else {
      toggleEditModal(expId);
    }
  };

  const renderSortSelect = (customClass = 'inline-block w-[200px]') => (
    <div ref={sortPopoverRef} className={`relative h-9 ${customClass}`}>
      <button 
        type="button"
        onClick={() => setIsSortOpen(!isSortOpen)}
        style={{ minHeight: 0 }}
        className="w-full h-full px-4 py-0 rounded-full border border-zen-lavender/30 bg-white text-zen-charcoal !text-sm font-semibold flex items-center justify-between gap-1.5 hover:bg-white/90 transition-all shadow-sm box-border h-9 min-h-0 shrink-0 cursor-pointer"
      >
        <span className="truncate capitalize">
          Sort: {sortDirection} {sortMetric}
        </span>
        <ChevronDown size={14} className={`text-zen-charcoal/50 shrink-0 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Absolute 2-Axis Sort Popover */}
      {isSortOpen && (
        <div className="absolute right-0 top-10 z-50 bg-white/95 backdrop-blur-xl border border-zen-lavender/40 shadow-xl rounded-3xl p-4 flex items-stretch gap-4 text-xs text-zen-charcoal font-semibold min-w-[220px] animate-scale-up">
          {/* Column 1: Direction */}
          <div className="flex flex-col gap-2.5 flex-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="expenseSortDir"
                checked={sortDirection === 'highest'}
                onChange={() => setSortDirection('highest')}
                className="w-3.5 h-3.5 accent-zen-sage"
              />
              Highest
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="expenseSortDir"
                checked={sortDirection === 'lowest'}
                onChange={() => setSortDirection('lowest')}
                className="w-3.5 h-3.5 accent-zen-sage"
              />
              Lowest
            </label>
          </div>

          {/* Divider */}
          <div className="w-[1px] bg-zen-lavender/30 self-stretch mx-1" />

          {/* Column 2: Metric */}
          <div className="flex flex-col gap-2.5 flex-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="expenseSortMetric"
                checked={sortMetric === 'date'}
                onChange={() => setSortMetric('date')}
                className="w-3.5 h-3.5 accent-zen-sage"
              />
              Date
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="expenseSortMetric"
                checked={sortMetric === 'amount'}
                onChange={() => setSortMetric('amount')}
                className="w-3.5 h-3.5 accent-zen-sage"
              />
              Amount
            </label>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`${isSelectMode ? "select-mode" : ""}`}>
        {/* 1. SEARCH & FILTERS (Now at the very top, with high-contrast glass and stack safety) */}
        <div className="recent-filters-container relative z-30 bg-white/60 backdrop-blur-md border border-zen-lavender/40 shadow-sm rounded-3xl p-4 mb-4 flex flex-col gap-3" id="recent-filters">
            <div className="flex gap-2">
                <input 
                  id="search-input"
                  type="text" 
                  placeholder="Search expenses..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-grow px-4 py-2 rounded-full border border-zen-lavender/30 bg-white text-zen-charcoal text-sm outline-none focus:border-zen-sage/60 focus:ring-1 focus:ring-zen-sage/60 transition-all font-semibold h-9"
                />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
                <MultiSelectDropdown
                  id="category-filter"
                  label="Category"
                  pluralLabel="Categories"
                  options={categoryOptions}
                  selectedIds={selectedCategories}
                  onChange={setSelectedCategories}
                />
                                <MultiSelectDropdown
                  id="type-filter"
                  label="Type"
                  pluralLabel="Types"
                  options={typeOptions}
                  selectedIds={selectedTypes}
                  onChange={setSelectedTypes}
                />

                {renderSortSelect('inline-block sm:ml-auto w-full max-w-[220px] sm:w-[200px]')}
            </div>
        </div>

        {/* 2. SELECT & BULK CONTROLS (Now directly below filters) */}
        <div className="recent-header-controls flex justify-between items-center w-full mb-3 gap-2 box-border">
            <button id="select-mode-btn" onClick={toggleSelectMode} className="flex px-4 py-0 rounded-full border border-zen-lavender/40 bg-white/60 hover:bg-white/80 text-zen-charcoal font-semibold transition-all text-sm cursor-pointer h-9 items-center box-border">
              {isSelectMode ? 'Cancel' : 'Select'}
            </button>
            <div id="bulk-actions" className="gap-2 items-center justify-end flex-grow sm:flex-grow-0" style={{ display: isSelectMode ? 'flex' : 'none' }}>
                <button 
                  id="bulk-edit-btn" 
                  onClick={handleBulkEditClick}
                  disabled={selectedIds.size === 0}
                  className="px-4 py-0 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none h-9 flex items-center justify-center box-border"
                >
                  Edit
                </button>
                <button 
                  id="bulk-delete-btn" 
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.size === 0}
                  className="px-4 py-0 bg-zen-peach border border-zen-charcoal/20 text-zen-charcoal rounded-full font-bold hover:bg-zen-peach/90 transition-all text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-9 flex items-center justify-center shadow-sm box-border"
                >
                  Delete
                </button>
            </div>
        </div>

        {/* 3. THE LIST */}
        <div className="recent-list pb-24 flex flex-col gap-3" id="recent-list">
            {filteredAndSortedExpenses.length === 0 ? (
              <div className="empty-state bg-white/40 backdrop-blur-md border border-white/20 rounded-3xl p-8 text-center shadow-sm animate-fade-in">
                <p className="text-zen-charcoal font-bold text-lg mb-1">No expenses found for this view.</p>
                <p className="text-zen-charcoal/60 text-sm">You are all caught up!</p>
              </div>
            ) : (
              filteredAndSortedExpenses.map((exp: Expense) => {
                const amtBase = parseFloat(exp.amount as any) || 0;
                const dateStr = formatFriendlyDate(exp.date);
                
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
                    onMouseDown={() => startPress(exp.id)}
                    onMouseUp={cancelPress}
                    onMouseLeave={cancelPress}
                    onTouchStart={() => startPress(exp.id)}
                    onTouchEnd={cancelPress}
                    onTouchMove={cancelPress}
                    onClick={() => handleItemClick(exp.id)}
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
                          <p className="flex items-center flex-wrap gap-1">
                            <span className="text-zen-charcoal/60 text-sm">{exp.categories?.name || "Uncategorized"} &bull; {dateStr}</span>
                            {(exp.is_recurring || !!exp.recurring_expense_id) && (
                              <span 
                                className="inline-flex items-center ml-1 text-zen-sage/80 hover:text-zen-sage transition-colors duration-200 cursor-help" 
                                title="Recurring Expense"
                                data-testid="recurring-icon"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline">
                                  <path d="m17 2 4 4-4 4"/>
                                  <path d="M3 11v-1a4 4 0 0 1 4-4h14"/>
                                  <path d="m7 22-4-4 4-4"/>
                                  <path d="M21 13v1a4 4 0 0 1-4 4H3"/>
                                </svg>
                              </span>
                            )}
                          </p>
                      </div>
                      <div className="expense-amount font-semibold text-zen-charcoal">
                        {formatFriendlyCurrency(displayAmt, displayCurr)}
                      </div>
                  </div>
                );
              })
            )}
        </div>
    </div>
  );
}
