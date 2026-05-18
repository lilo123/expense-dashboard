import { createContext, useContext, useRef, useLayoutEffect, useEffect } from 'react';
import { createStore, useStore } from 'zustand';
import { Expense, Category, User, SupportedCurrency, Profile, RecurringExpense, Budget } from '@/types/database';
import { reallocateFundsAction } from '@/app/actions/budget';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface ExpenseState {
  expenses: Expense[];
  categories: Category[];
  recurringExpenses: RecurringExpense[];
  budgets: Budget[];
  user: User | null;
  globalError: string | null;
  
  profile: Profile | null;
  
  displayCurrency: SupportedCurrency;
  baseCurrency: SupportedCurrency;
  exchangeRates: Record<string, number>;

  isAddModalOpen: boolean;
  isEditModalOpen: boolean;
  isCategoryModalOpen: boolean;
  isChatModalOpen: boolean;
  isBulkEditModalOpen: boolean;
  isSiriModalOpen: boolean;
  isRecurringModalOpen: boolean;
  isOnboardingOpen: boolean;
  isReallocationOpen: boolean;
  isBudgetView: boolean;
  
  activeTab: 'dashboard' | 'recent' | 'yearly';
  editingExpenseId: string | null;
  reallocationSourceId: string | null;
  reallocationMonth: string | null;
  activeCategoryFilter: string | null;
  activeMonthFilter: string | null;

  isSelectMode: boolean;
  selectedIds: Set<string>;
  
  setActiveCategoryFilter: (cat: string | null) => void;
  setActiveMonthFilter: (month: string | null) => void;
  setBudgetView: (view: boolean) => void;

  setDisplayCurrency: (curr: SupportedCurrency) => void;
  setProfile: (prof: Profile | null) => void;
  setBaseCurrency: (curr: SupportedCurrency) => void;
  setExchangeRates: (rates: Record<string, number>) => void;
  setBudgets: (budgets: Budget[]) => void;

  hydrate: (data: { 
    expenses?: Expense[]; 
    categories?: Category[]; 
    recurringExpenses?: RecurringExpense[];
    budgets?: Budget[];
    user?: User | null; 
    error?: string;
    displayCurrency?: SupportedCurrency;
    baseCurrency?: SupportedCurrency;
    exchangeRates?: Record<string, number>;
    profile?: Profile | null;
  }) => void;
  toggleAddModal: () => void;
  toggleEditModal: (id?: string) => void;
  toggleCategoryModal: () => void;
  toggleChatModal: () => void;
  toggleBulkEditModal: () => void;
  toggleSiriModal: () => void;
  toggleRecurringModal: () => void;
  toggleOnboarding: () => void;
  toggleReallocation: (sourceId?: string | null, month?: string | null) => void;
  
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
  addRecurringExpense: (config: RecurringExpense) => void;
  removeRecurringExpense: (id: string) => void;
  updateBudgetLimit: (categoryId: string | null, month: string, amount: number) => void;
  executeReallocation: (sourceId: string | null, targetId: string, amount: number, month: string) => Promise<boolean>;
}

export const createExpenseStore = (initialState: Partial<ExpenseState> = {}) => 
  createStore<ExpenseState>((set, get) => ({
    expenses: initialState.expenses || [],
    categories: initialState.categories || [],
    recurringExpenses: initialState.recurringExpenses || [],
    budgets: initialState.budgets || [],
    user: initialState.user || null,
    globalError: initialState.globalError || null,
    displayCurrency: initialState.displayCurrency || 'CAD',
    baseCurrency: initialState.baseCurrency || 'CAD',
    exchangeRates: initialState.exchangeRates || { CAD: 1.0 },
    profile: initialState.profile || null,
    isAddModalOpen: false,
    isEditModalOpen: false,
    isCategoryModalOpen: false,
    isChatModalOpen: false,
    isBulkEditModalOpen: false,
    isSiriModalOpen: false,
    isRecurringModalOpen: false,
    isOnboardingOpen: false,
    isReallocationOpen: false,
    isBudgetView: initialState.isBudgetView || false,
    activeTab: 'dashboard',
    editingExpenseId: null,
    reallocationSourceId: null,
    reallocationMonth: null,
    activeCategoryFilter: null,
    activeMonthFilter: null,
    isSelectMode: false,
    selectedIds: new Set(),

    setActiveCategoryFilter: (cat) => set({ activeCategoryFilter: cat }),
    setActiveMonthFilter: (month) => set({ activeMonthFilter: month }),
    setBudgetView: (view) => set({ isBudgetView: view }),
    
    setDisplayCurrency: (curr) => set(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('displayCurrency', curr);
      }
      return { displayCurrency: curr };
    }),
    setProfile: (prof) => set({ profile: prof }),
    setBaseCurrency: (curr) => set({ baseCurrency: curr }),
    setExchangeRates: (rates) => set({ exchangeRates: rates }),
    setBudgets: (b) => set({ budgets: b }),
    
    hydrate: (data) => set((state) => {
      const activeProfile = data.profile !== undefined ? data.profile : state.profile;
      
      // Sync display currency cleanly to LocalStorage cached preference if present
      let preferredDisplay: SupportedCurrency | null = null;
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('displayCurrency');
        if (stored) preferredDisplay = stored as SupportedCurrency;
      }

      const hydratedBase = data.baseCurrency || (activeProfile ? activeProfile.base_currency : state.baseCurrency);
      const hydratedDisplay = data.displayCurrency || preferredDisplay || (activeProfile ? activeProfile.base_currency : state.displayCurrency);

      return { 
        expenses: data.expenses !== undefined ? [...data.expenses] : state.expenses, 
        categories: data.categories !== undefined ? [...data.categories] : state.categories, 
        recurringExpenses: data.recurringExpenses !== undefined ? [...data.recurringExpenses] : state.recurringExpenses,
        budgets: data.budgets !== undefined ? [...data.budgets] : state.budgets,
        user: data.user !== undefined ? data.user : state.user, 
        globalError: data.error !== undefined ? data.error : state.globalError,
        profile: activeProfile,
        baseCurrency: hydratedBase,
        displayCurrency: hydratedDisplay,
        exchangeRates: data.exchangeRates || state.exchangeRates
      };
    }),
    
    toggleAddModal: () => set((state) => ({ isAddModalOpen: !state.isAddModalOpen })),
    toggleEditModal: (id) => set((state) => ({ isEditModalOpen: !state.isEditModalOpen, editingExpenseId: id || null })),
    toggleCategoryModal: () => set((state) => ({ isCategoryModalOpen: !state.isCategoryModalOpen })),
    toggleChatModal: () => set((state) => ({ isChatModalOpen: !state.isChatModalOpen })),
    toggleBulkEditModal: () => set((state) => ({ isBulkEditModalOpen: !state.isBulkEditModalOpen })),
    toggleSiriModal: () => set((state) => ({ isSiriModalOpen: !state.isSiriModalOpen })),
    toggleRecurringModal: () => set((state) => ({ isRecurringModalOpen: !state.isRecurringModalOpen })),
    toggleOnboarding: () => set((state) => ({ isOnboardingOpen: !state.isOnboardingOpen })),
    toggleReallocation: (sourceId, month) => set((state) => ({
      isReallocationOpen: !state.isReallocationOpen,
      reallocationSourceId: sourceId !== undefined ? sourceId : null,
      reallocationMonth: month !== undefined ? month : null
    })),
    
    reset: () => set({ 
      expenses: [], 
      categories: [], 
      recurringExpenses: [],
      budgets: [],
      user: null, 
      globalError: null, 
      displayCurrency: 'CAD',
      baseCurrency: 'CAD',
      exchangeRates: { CAD: 1.0 },
      profile: null,
      isAddModalOpen: false, 
      isEditModalOpen: false, 
      isCategoryModalOpen: false, 
      isChatModalOpen: false, 
      isBulkEditModalOpen: false, 
      isSiriModalOpen: false, 
      isRecurringModalOpen: false, 
      isOnboardingOpen: false,
      isReallocationOpen: false,
      isBudgetView: false,
      editingExpenseId: null, 
      reallocationSourceId: null,
      reallocationMonth: null,
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

    addExpense: (expense) => set((state) => {
      if (state.expenses.some((e) => e.id === expense.id)) {
        return state;
      }
      return {
        expenses: [expense, ...state.expenses]
      };
    }),

    deleteExpense: (id) => set((state) => ({
      expenses: state.expenses.filter((e) => e.id !== id)
    })),

    addRecurringExpense: (config) => set((state) => ({
      recurringExpenses: [config, ...state.recurringExpenses]
    })),

    removeRecurringExpense: (id) => set((state) => ({
      recurringExpenses: state.recurringExpenses.filter((r) => r.id !== id)
    })),

    updateBudgetLimit: (catId, month, amt) => set((state) => ({
      budgets: state.budgets.map(b => (b.category_id === catId && b.month === month) ? { ...b, limit_amount: amt } : b)
    })),

    executeReallocation: async (sourceId, targetId, amount, month) => {
      const previousBudgets = [...get().budgets];

      // Optimistic update
      set((state) => {
        const newBudgets = state.budgets.map(b => {
          if (b.month !== month) return b;
          if (b.category_id === sourceId) {
            return { ...b, limit_amount: b.limit_amount - amount };
          }
          if (b.category_id === targetId) {
            return { ...b, limit_amount: b.limit_amount + amount };
          }
          return b;
        });
        return { budgets: newBudgets };
      });

      // Background sync
      const res = await reallocateFundsAction({
        month,
        source_category_id: sourceId,
        target_category_id: targetId,
        amount
      });

      if (!res.success) {
        set({ budgets: previousBudgets, globalError: res.error || 'Reallocation failed.' });
        return false;
      }
      return true;
    }
  }));

// Create React Context for Request-Scoped Store
const StoreContext = createContext<ReturnType<typeof createExpenseStore> | null>(null);

function areInitialDataEqual(a: Partial<ExpenseState>, b: Partial<ExpenseState>): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  
  const keysToCompare: (keyof ExpenseState)[] = [
    'expenses', 'categories', 'recurringExpenses', 'budgets', 'user', 'profile',
    'displayCurrency', 'baseCurrency', 'exchangeRates'
  ];
  
  for (const key of keysToCompare) {
    const valA = a[key];
    const valB = b[key];
    
    if (valA === valB) continue;
    if (!valA || !valB) return false;
    
    if (Array.isArray(valA) && Array.isArray(valB)) {
      if (valA.length !== valB.length) return false;
      for (let i = 0; i < valA.length; i++) {
        if (valA[i]?.id !== valB[i]?.id) return false;
        if (key === 'budgets') {
          const itemA = valA[i] as any;
          const itemB = valB[i] as any;
          if (itemA?.limit_amount !== itemB?.limit_amount || itemA?.month !== itemB?.month) {
            return false;
          }
        }
      }
    } else if (typeof valA === 'object' && typeof valB === 'object') {
      if (JSON.stringify(valA) !== JSON.stringify(valB)) return false;
    } else {
      if (valA !== valB) return false;
    }
  }
  return true;
}

// Export StoreProvider Context Component
export function StoreProvider({ children, initialData }: { children: React.ReactNode, initialData: Partial<ExpenseState> }) {
  const storeRef = useRef<ReturnType<typeof createExpenseStore>>(undefined);
  if (!storeRef.current) {
    storeRef.current = createExpenseStore(initialData);
  }
  
  const prevInitialDataRef = useRef<Partial<ExpenseState>>(initialData);

  useIsomorphicLayoutEffect(() => {
    if (prevInitialDataRef.current !== initialData && !areInitialDataEqual(prevInitialDataRef.current, initialData)) {
      storeRef.current?.getState().hydrate(initialData);
      prevInitialDataRef.current = initialData;
    }
  }, [initialData]);

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
