const fs = require('fs');
const path = 'src/store/useExpenseStore.ts';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('isSiriModalOpen: boolean;')) {
  code = code.replace('isBulkEditModalOpen: boolean;', 'isBulkEditModalOpen: boolean;\n  isSiriModalOpen: boolean;');
  code = code.replace('toggleBulkEditModal: () => void;', 'toggleBulkEditModal: () => void;\n  toggleSiriModal: () => void;\n  reset: () => void;');
  code = code.replace('isBulkEditModalOpen: false,', 'isBulkEditModalOpen: false,\n  isSiriModalOpen: false,');
  code = code.replace('toggleBulkEditModal: () => set((state) => ({ isBulkEditModalOpen: !state.isBulkEditModalOpen })),', 'toggleBulkEditModal: () => set((state) => ({ isBulkEditModalOpen: !state.isBulkEditModalOpen })),\n  toggleSiriModal: () => set((state) => ({ isSiriModalOpen: !state.isSiriModalOpen })),\n  reset: () => set({ expenses: [], categories: [], user: null, globalError: null, isAddModalOpen: false, isEditModalOpen: false, isCategoryModalOpen: false, isChatModalOpen: false, isBulkEditModalOpen: false, isSiriModalOpen: false, activeTab: \'dashboard\', editingExpenseId: null, activeCategoryFilter: null, activeMonthFilter: null, isSelectMode: false, selectedIds: new Set() }),');
  fs.writeFileSync(path, code);
  console.log('Store updated successfully.');
} else {
  console.log('Store already updated.');
}
