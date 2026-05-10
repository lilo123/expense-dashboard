import { createContext, useContext, useRef } from 'react';
import { createStore, useStore } from 'zustand';
import { Expense, Category, User } from '@/types/database';

export interface ExpenseState {
  expenses: Expense[];
  categories: Category[];
  user: User | null;
  globalError: string | null;
  
  displayCurrency: 'USD' | 'EUR' | 'JPY' | 'GBP' | 'SGD' | 'VND';
  baseCurrency: 'USD' | 'EUR' | 'JPY' | 'GBP' | 'SGD' | 'VND';
  exchangeRates: Record<string, number>;

  isAddModalOpen: boolean;
  isEditModalOpen: boolean;
  isCategoryModalOpen: boolean;
  isChatModalOpen: boolean;
  isBulkEditModalOpen: boolean;
  isSiriModalOpen: boolean;
  
  activeTab: 'dashboard' | 'recent' | 'yearly';
  editingExpenseId: string | null;
  activeCategoryFilter: string | null;
  activeMonthFilter: string | null;

  isSelectMode: boolean;
  selectedIds: Set<string>;
  
  setActiveCategoryFilter: (cat: string | null) => void;
  setActiveMonthFilter: (month: string | null) => void;

  setDisplayCurrency: (curr: 'USD' | 'EUR' | 'JPY' | 'GBP' | 'SGD' | 'VND') => void;
  setBaseCurrency: (curr: 'USD' | 'EUR' | 'JPY' | 'GBP' | 'SGD' | 'VND') => void;
  setExchangeRates: (rates: Record<string, number>) => void;

  hydrate: (data: { 
    expenses?: Expense[]; 
    categories?: Category[]; 
    user?: User | null; 
    error?: string;
    displayCurrency?: 'USD' | 'EUR' | 'JPY' | 'GBP' | 'SGD' | 'VND';
    baseCurrency?: 'USD' | 'EUR' | 'JPY' | 'GBP' | 'SGD' | 'VND';
    exchangeRates?: Record<string, number>;
  }) => void;
  toggleAddModal: () => void;
  toggleEditModal: (id?: string) => void;
  toggleCategoryModal: () => void;
  toggleChatModal: () => void;
  toggleBulkEditModal: () => void;
  toggleSiriModal: () => void;
  
  reset: () => void;
  
  setActiveTab: (tab: 'dashboard' | 'recent' | 'yearly') => void;
  setGlobalError: (err: string | null) => void;

  toggleSelectMode: () => void;
  toggleSelection: (id: string) => void;
  deleteSelected: () => void;
  updateBulkExpenses: (ids: Set<string>, updates: Partial<Expense>) => void;

  addCategory: (cat: Category) => void;
  updateCategory: (id: string, newName: string) => void;
  removeCategory: (id: string) => void;
  updateCategoryInExpenses: (oldCatId: string, newCatId: string) => void;
  addExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
}

export const createExpenseStore = (initialState: Partial<ExpenseState> = {}) => 
  createStore<ExpenseState>((set) => ({
    expenses: initialState.expenses || [],
    categories: initialState.categories || [],
    user: initialState.user || null,
    globalError: initialState.globalError || null,
    displayCurrency: initialState.displayCurrency || 'CAD',
    baseCurrency: initialState.baseCurrency || 'CAD',
    exchangeRates: initialState.exchangeRates || { CAD: 1.0 },
    isAddModalOpen: false,
    isEditModalOpen: false,
    isCategoryModalOpen: false,
    isChatModalOpen: false,
    isBulkEditModalOpen: false,
    isSiriModalOpen: false,
    activeTab: 'dashboard',
    editingExpenseId: null,
    activeCategoryFilter: null,
    activeMonthFilter: null,
    isSelectMode: false,
    selectedIds: new Set(),

    setActiveCategoryFilter: (cat) => set({ activeCategoryFilter: cat }),
    setActiveMonthFilter: (month) => set({ activeMonthFilter: month }),
    
    setDisplayCurrency: (curr) => set(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('displayCurrency', curr);
      }
      return { displayCurrency: curr };
    }),
    setBaseCurrency: (curr) => set({ baseCurrency: curr }),
    setExchangeRates: (rates) => set({ exchangeRates: rates }),
    
    hydrate: (data) => set((state) => ({ 
      expenses: data.expenses ? [...data.expenses] : [], 
      categories: data.categories ? [...data.categories] : [], 
      user: data.user || null, 
      globalError: data.error || null,
      displayCurrency: data.displayCurrency || state.displayCurrency,
      baseCurrency: data.baseCurrency || state.baseCurrency,
      exchangeRates: data.exchangeRates || state.exchangeRates
    })),
    
    toggleAddModal: () => set((state) => ({ isAddModalOpen: !state.isAddModalOpen })),
    toggleEditModal: (id) => set((state) => ({ isEditModalOpen: !state.isEditModalOpen, editingExpenseId: id || null })),
    toggleCategoryModal: () => set((state) => ({ isCategoryModalOpen: !state.isCategoryModalOpen })),
    toggleChatModal: () => set((state) => ({ isChatModalOpen: !state.isChatModalOpen })),
    toggleBulkEditModal: () => set((state) => ({ isBulkEditModalOpen: !state.isBulkEditModalOpen })),
    toggleSiriModal: () => set((state) => ({ isSiriModalOpen: !state.isSiriModalOpen })),
    
    reset: () => set({ 
      expenses: [], 
      categories: [], 
      user: null, 
      globalError: null, 
      displayCurrency: 'CAD',
      baseCurrency: 'CAD',
      exchangeRates: { CAD: 1.0 },
      isAddModalOpen: false, 
      isEditModalOpen: false, 
      isCategoryModalOpen: false, 
      isChatModalOpen: false, 
      isBulkEditModalOpen: false, 
      isSiriModalOpen: false, 
      editingExpenseId: null, 
      activeCategoryFilter: null, 
      activeMonthFilter: null, 
      isSelectMode: false, 
      selectedIds: new Set() 
    }),
    
    setActiveTab: (tab) => set({ activeTab: tab }),
    setGlobalError: (err) => set({ globalError: err }),

    toggleSelectMode: () => set((state) => ({ 
      isSelectMode: !state.isSelectMode,
      selectedIds: !state.isSelectMode ? state.selectedIds : new Set() 
    })),

    toggleSelection: (id) => set((state) => {
      const newSelection = new Set(state.selectedIds);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      return { selectedIds: newSelection };
    }),

    deleteSelected: () => set((state) => ({
      expenses: state.expenses.filter((e) => !state.selectedIds.has(e.id)),
      selectedIds: new Set(),
      isSelectMode: false
    })),

    updateBulkExpenses: (ids, updates) => set((state) => {
      let newCategoryName: string | undefined;
      if (updates.category_id) {
        const cat = state.categories.find(c => c.id === updates.category_id);
        if (cat) newCategoryName = cat.name;
      }
      
      return {
        expenses: state.expenses.map(e => {
          if (ids.has(e.id)) {
            const updatedExpense = { ...e, ...updates };
            if (updates.category_id && newCategoryName) {
              updatedExpense.categories = { name: newCategoryName };
            }
            return updatedExpense;
          }
          return e;
        }),
        selectedIds: new Set(),
        isSelectMode: false
      };
    }),

    addCategory: (cat) => set((state) => ({
      categories: [...state.categories, cat]
    })),
    
    updateCategory: (id, newName) => set((state) => ({
      categories: state.categories.map(c => c.id === id ? { ...c, name: newName } : c),
      expenses: state.expenses.map(e => e.category_id === id ? { ...e, categories: { name: newName } } : e)
    })),

    removeCategory: (id) => set((state) => ({
      categories: state.categories.filter(c => c.id !== id)
    })),

    updateCategoryInExpenses: (oldCatId, newCatId) => set((state) => {
      const newCat = state.categories.find(c => c.id === newCatId);
      return {
        expenses: state.expenses.map(e => 
          e.category_id === oldCatId 
            ? { ...e, category_id: newCatId, categories: newCat ? { name: newCat.name } : e.categories } 
            : e
        )
      };
    }),

    addExpense: (expense) => set((state) => ({
      expenses: [expense, ...state.expenses]
    })),

    deleteExpense: (id) => set((state) => ({
      expenses: state.expenses.filter((e) => e.id !== id)
    }))
  }));

// Create React Context for Request-Scoped Store
const StoreContext = createContext<ReturnType<typeof createExpenseStore> | null>(null);

// Export StoreProvider Context Component
export function StoreProvider({ children, initialData }: { children: React.ReactNode, initialData: Partial<ExpenseState> }) {
  const storeRef = useRef<ReturnType<typeof createExpenseStore>>(undefined);
  if (!storeRef.current) {
    storeRef.current = createExpenseStore(initialData);
  }
  return (
    <StoreContext.Provider value={storeRef.current}>
      {children}
    </StoreContext.Provider>
  );
}

// Export context-bound custom hook with optional selector (default to entire state)
export function useExpenseStore(): ExpenseState;
export function useExpenseStore<T>(selector: (state: ExpenseState) => T): T;
export function useExpenseStore<T>(selector?: (state: ExpenseState) => T): T | ExpenseState {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useExpenseStore must be used within a StoreProvider');
  return useStore(store, selector || ((state) => state as any));
}
