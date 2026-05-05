const fs = require('fs');
const storePath = 'src/store/useExpenseStore.ts';
let content = fs.readFileSync(storePath, 'utf8');

if (!content.includes('isBulkEditModalOpen')) {
  content = content.replace('isChatModalOpen: boolean;', 'isChatModalOpen: boolean;\n  isBulkEditModalOpen: boolean;');
  content = content.replace('toggleChatModal: () => void;', 'toggleChatModal: () => void;\n  toggleBulkEditModal: () => void;');
  content = content.replace('isChatModalOpen: false,', 'isChatModalOpen: false,\n  isBulkEditModalOpen: false,');
  content = content.replace('toggleChatModal: () => set((state) => ({ isChatModalOpen: !state.isChatModalOpen })),', 'toggleChatModal: () => set((state) => ({ isChatModalOpen: !state.isChatModalOpen })),\n  toggleBulkEditModal: () => set((state) => ({ isBulkEditModalOpen: !state.isBulkEditModalOpen })),');
  fs.writeFileSync(storePath, content);
  console.log('Zustand store updated');
} else {
  console.log('Zustand store already has isBulkEditModalOpen');
}
