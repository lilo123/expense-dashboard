const fs = require('fs');
const path = 'src/components/ClientDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add SiriModal import
if (!content.includes('import SiriModal')) {
  content = content.replace(
    "import BulkEditModal from './BulkEditModal';",
    "import BulkEditModal from './BulkEditModal';\nimport SiriModal from './SiriModal';"
  );
}

// 2. Add useRouter and Supabase client imports
if (!content.includes('import { useRouter }')) {
  content = content.replace(
    "'use client';\nimport { useRef } from 'react';",
    "'use client';\nimport { useRef } from 'react';\nimport { useRouter } from 'next/navigation';\nimport { createClient } from '@/utils/supabase/client';"
  );
}

// 3. Update useExpenseStore hook
if (!content.includes('toggleSiriModal, reset')) {
  content = content.replace(
    "const { hydrate, globalError, activeTab, toggleAddModal, toggleCategoryModal, toggleChatModal } = useExpenseStore();",
    "const { hydrate, globalError, activeTab, toggleAddModal, toggleCategoryModal, toggleChatModal, toggleSiriModal, reset } = useExpenseStore();"
  );
}

// 4. Add useRouter and handleSignOut
if (!content.includes('const router = useRouter();')) {
  content = content.replace(
    "const hydrated = useRef(false);",
    "const hydrated = useRef(false);\n  const router = useRouter();\n  const supabase = createClient();\n\n  const handleSignOut = async () => {\n    await supabase.auth.signOut();\n    reset();\n    router.push('/login');\n  };"
  );
}

// 5. Update Siri button
content = content.replace(
  /<button id="siri-btn" style=\{\{ display: 'none', (.*?)\}\}>/,
  '<button id="siri-btn" style={{ display: "flex", alignItems: "center", $1}} onClick={toggleSiriModal}>'
);

// 6. Update Sign Out button
content = content.replace(
  /<button id="logout-btn" style=\{\{ display: 'none', (.*?)\}\}>/,
  '<button id="logout-btn" style={{ display: "block", $1}} onClick={handleSignOut}>'
);

// 7. Add SiriModal component at the bottom
if (!content.includes('<SiriModal />')) {
  content = content.replace(
    "<ChatBox />",
    "<ChatBox />\n      <SiriModal />"
  );
}

fs.writeFileSync(path, content);
console.log('ClientDashboard patched successfully.');
