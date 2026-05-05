import { create } from 'zustand';
import { Expense, Category, User } from '@/types/database';

interface ExpenseState {
  expenses: Expense[];
  categories: Category[];
  user: User | null;
  globalError: string | null;
  
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

  hydrate: (data: { expenses?: Expense[], categories?: Category[], user?: User | null, error?: string }) => void;
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
}

export const useExpenseStore = create<ExpenseState>((set) => ({
  expenses: [],
  categories: [],
  user: null,
  globalError: null,
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
  
  hydrate: (data) => set({ 
    expenses: data.expenses ? [...data.expenses] : [], 
    categories: data.categories ? [...data.categories] : [], 
    user: data.user || null, 
    globalError: data.error || null 
  }),
  
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
  }))
}));
