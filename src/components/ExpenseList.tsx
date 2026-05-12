'use client';
import { useState, useMemo, useRef } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { convertAmount, formatFriendlyCurrency } from '@/lib/utils';
import { bulkDeleteAction } from '@/app/actions';
import { Expense } from '@/types/database';
import { formatFriendlyDate } from '@/lib/utils';

// --- Custom MultiSelectDropdown Helper Component ---
interface MultiSelectDropdownProps {
  label: string;
  pluralLabel: string;
  options: { id: string; name: string }[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  id: string;
}

function MultiSelectDropdown({
  label,
  pluralLabel,
  options,
  selectedIds,
  onChange,
  id
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggleOption = (optionId: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(optionId)) {
      newSelection.delete(optionId);
    } else {
      newSelection.add(optionId);
    }
    onChange(newSelection);
  };

  const handleSelectAll = () => {
    onChange(new Set(options.map(o => o.id)));
  };

  const handleClearAll = () => {
    onChange(new Set());
  };

  const summaryText = useMemo(() => {
    if (selectedIds.size === 0 || selectedIds.size === options.length) {
      return `All ${pluralLabel}`;
    }
    if (selectedIds.size <= 2) {
      return options
        .filter(o => selectedIds.has(o.id))
        .map(o => o.name)
        .join(', ');
    }
    return `${selectedIds.size} ${pluralLabel}`;
  }, [selectedIds, options, pluralLabel]);

  return (
    <div className="relative inline-block" id={`${id}-container`}>
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{ minHeight: 0 }}
        className="px-4 py-0 rounded-full border border-zen-lavender/30 bg-white text-zen-charcoal text-sm outline-none cursor-pointer hover:bg-white/90 transition-all flex items-center justify-center gap-1 font-semibold h-9 min-h-0 shrink-0 box-border"
      >
        <span>{summaryText}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop mask for tap-away closing */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          <div className="absolute left-0 mt-2 min-w-[220px] bg-white/95 backdrop-blur-md border border-zen-lavender/40 shadow-lg rounded-3xl p-3 z-50 flex flex-col gap-2 animate-fade-in">
            <div className="flex justify-between items-center border-b border-zen-lavender/20 pb-2 mb-1 px-1">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-bold text-zen-sage hover:opacity-80 cursor-pointer border-none bg-transparent"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs font-bold text-zen-charcoal/60 hover:text-zen-charcoal cursor-pointer border-none bg-transparent"
              >
                Clear
              </button>
            </div>
            <div className="max-h-[200px] overflow-y-auto flex flex-col gap-1 pr-1">
              {options.map(opt => {
                const isChecked = selectedIds.has(opt.id);
                const checkboxId = `checkbox-${id}-${opt.id}`;
                return (
                  <label
                    key={opt.id}
                    htmlFor={checkboxId}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-zen-sage/10 cursor-pointer text-sm text-zen-charcoal transition-colors select-none"
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleOption(opt.id)}
                      className="rounded text-zen-sage focus:ring-zen-sage/50 cursor-pointer w-4 h-4"
                    />
                    <span className="font-semibold">{opt.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

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
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

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
        const isRecurring = exp.is_recurring;
        const expType = isRecurring ? 'recurring' : 'one-off';
        const matchesType = selectedTypes.size === 0 || selectedTypes.has(expType);
        return matchesSearch && matchesCategory && matchesType;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        if (sortBy === 'date-asc') {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        const amtA = parseFloat(a.amount as any) || 0;
        const amtB = parseFloat(b.amount as any) || 0;
        if (sortBy === 'amount-desc') {
          return amtB - amtA;
        }
        if (sortBy === 'amount-asc') {
          return amtA - amtB;
        }
        return 0;
      });
  }, [expenses, searchQuery, selectedCategories, selectedTypes, sortBy]);

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

  const getSortLabel = (val: string) => {
    switch (val) {
      case 'date-desc': return 'Date: Newest';
      case 'date-asc': return 'Date: Oldest';
      case 'amount-desc': return 'Amount: Highest';
      case 'amount-asc': return 'Amount: Lowest';
      default: return 'Date: Newest';
    }
  };

  const renderSortSelect = (customClass = 'inline-block w-[200px]') => (
    <div className={`relative cursor-pointer h-9 ${customClass}`}>
      <button 
        type="button"
        style={{ minHeight: 0 }}
        className="w-full h-full px-4 py-0 rounded-full border border-zen-lavender/30 bg-white text-zen-charcoal !text-sm font-semibold flex items-center justify-between gap-1.5 hover:bg-white/90 transition-all shadow-sm box-border h-9 min-h-0 shrink-0"
      >
        <span className="truncate">Sort by {getSortLabel(sortBy)}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-zen-charcoal/50 shrink-0">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      <select 
        id="sort-select"
        aria-label="Sort Expenses"
        value={sortBy} 
        onChange={e => setSortBy(e.target.value as any)}
        style={{ minHeight: 0 }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 min-h-0"
      >
        <option value="date-desc">Date: Newest</option>
        <option value="date-asc">Date: Oldest</option>
        <option value="amount-desc">Amount: Highest</option>
        <option value="amount-asc">Amount: Lowest</option>
      </select>
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

                {renderSortSelect('hidden sm:inline-block sm:ml-auto sm:w-[200px]')}
            </div>
        </div>

        {/* 2. SELECT & BULK CONTROLS (Now directly below filters) */}
        <div className="recent-header-controls flex justify-between items-center w-full mb-3 gap-2 box-border">
            {/* Mobile Sort Dropdown: only visible on Mobile (sm:hidden) */}
            {renderSortSelect('sm:hidden flex-grow max-w-[220px] inline-block')}

            <button id="select-mode-btn" onClick={toggleSelectMode} className="hidden sm:flex px-4 py-0 rounded-full border border-zen-lavender/40 bg-white/60 hover:bg-white/80 text-zen-charcoal font-semibold transition-all text-sm cursor-pointer h-9 items-center box-border">
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
                            {exp.is_recurring && (
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
