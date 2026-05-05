const fs = require('fs');

// --- Task 1: Update Backend Action Error Handling ---
let actionsPath = 'src/app/actions.ts';
let actionsCode = fs.readFileSync(actionsPath, 'utf8');
if (!actionsCode.includes("if (error.code === '23505') {")) {
  actionsCode = actionsCode.replace(
    /if \(error\) \{\s*return \{ success: false, error: error\.message \}\s*\}/g,
    `if (error) {\n    if (error.code === '23505') {\n      return { success: false, error: 'A category with this name already exists. Please choose a different name.' }\n    }\n    return { success: false, error: error.message }\n  }`
  );
  fs.writeFileSync(actionsPath, actionsCode);
  console.log('Task 1 completed.');
} else {
  console.log('Task 1 already satisfied (23505 constraint handling present).');
}

// --- Task 2: Sanitize Zustand State Hydration ---
let storePath = 'src/store/useExpenseStore.ts';
let storeCode = fs.readFileSync(storePath, 'utf8');
// Ensure strictly replacement
storeCode = storeCode.replace(
  /hydrate: \(data\) => set\(\{[\s\S]*?expenses: data\.expenses \|\| \[\][\s\S]*?\}\),/,
  `hydrate: (data) => set({ \n    expenses: data.expenses ? [...data.expenses] : [], \n    categories: data.categories ? [...data.categories] : [], \n    user: data.user || null, \n    globalError: data.error || null \n  }),`
);
fs.writeFileSync(storePath, storeCode);
console.log('Task 2 completed.');

// --- Task 3: Empty Category Deletion Confirmation ---
let modalPath = 'src/components/CategoryModal.tsx';
let modalContent = fs.readFileSync(modalPath, 'utf8');

if (!modalContent.includes('isDeletingEmpty')) {
  // 1. Add state
  modalContent = modalContent.replace(
    /const \[fallbackCategoryId, setFallbackCategoryId\] = useState<string>\(''\);/,
    "const [fallbackCategoryId, setFallbackCategoryId] = useState<string>('');\n  const [isDeletingEmpty, setIsDeletingEmpty] = useState<boolean>(false);"
  );

  // 2. Modify initiateDelete
  modalContent = modalContent.replace(
    /const initiateDelete = \(cat: Category\) => \{[\s\S]*?confirmDelete\(cat\.id\);\n    \}\n  \};/,
    `const initiateDelete = (cat: Category) => {\n    const expenses = useExpenseStore.getState().expenses;\n    const hasExpenses = expenses.some((e) => e.category_id === cat.id);\n    \n    setCategoryToDelete(cat);\n    setIsDeletingEmpty(!hasExpenses);\n    \n    if (hasExpenses) {\n      const otherCategories = categories.filter(c => c.id !== cat.id);\n      if (otherCategories.length > 0) {\n        setFallbackCategoryId(otherCategories[0].id);\n      } else {\n        setFallbackCategoryId('');\n      }\n    } else {\n      setFallbackCategoryId('');\n    }\n  };`
  );

  // 3. Update the JSX modal body
  modalContent = modalContent.replace(
    /<h2>Reassign Expenses<\/h2>[\s\S]*?<p><strong>\{categoryToDelete\.name\}<\/strong> contains expenses\. Please select a category to reassign them to before deleting\.<\/p>\s*<div style=\{\{ margin: '20px 0' \}\}>\s*<select[\s\S]*?<\/select>\s*<\/div>/,
    `<h2>{isDeletingEmpty ? 'Confirm Deletion' : 'Reassign Expenses'}</h2>\n            <p>\n              {isDeletingEmpty \n                ? <>Are you sure you want to delete <strong>{categoryToDelete.name}</strong>?</>\n                : <><strong>{categoryToDelete.name}</strong> contains expenses. Please select a category to reassign them to before deleting.</>\n              }\n            </p>\n            \n            {!isDeletingEmpty && (\n            <div style={{ margin: '20px 0' }}>\n              <select \n                value={fallbackCategoryId} \n                onChange={e => setFallbackCategoryId(e.target.value)}\n                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}\n              >\n                <option value="" disabled>Select a new category</option>\n                {categories.filter(c => c.id !== categoryToDelete.id).map(c => (\n                  <option key={c.id} value={c.id}>{c.name}</option>\n                ))}\n              </select>\n            </div>\n            )}`
  );

  // 4. Update Confirm Delete button
  modalContent = modalContent.replace(
    /<button\s*onClick=\{\(\) => confirmDelete\(categoryToDelete\.id, fallbackCategoryId\)\}\s*disabled=\{!fallbackCategoryId\}\s*style=\{\{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', opacity: !fallbackCategoryId \? 0\.5 : 1 \}\}\s*>\s*Confirm Delete\s*<\/button>/,
    `<button \n                onClick={() => confirmDelete(categoryToDelete.id, isDeletingEmpty ? undefined : fallbackCategoryId)}\n                disabled={!isDeletingEmpty && !fallbackCategoryId}\n                style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', opacity: (!isDeletingEmpty && !fallbackCategoryId) ? 0.5 : 1 }}\n              >\n                Confirm Delete\n              </button>`
  );

  fs.writeFileSync(modalPath, modalContent);
  console.log('Task 3 completed.');
} else {
  console.log('Task 3 already satisfied.');
}
