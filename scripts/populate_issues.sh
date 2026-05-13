#!/bin/bash
# An-yen Expense Dashboard - Technical Debt Issue Population Script
# Prerequisite: GitHub CLI (`gh`) installed and authenticated (`gh auth login`)

echo "Populating GitHub repository with 13 Technical Debt & Optimization issues..."

# 1. Synchronous Edge Auth Latency
gh issue create \
  --title "Refactor Edge Middleware Auth Verification to getSession()" \
  --label "high-priority" --label "tech-debt" --label "performance" \
  --body "**Target File**: \`src/utils/supabase/middleware.ts\`

### Problem Description
Middleware currently invokes \`supabase.auth.getUser()\` on every route transition to \`/dashboard\` or \`/login\`. This forces a synchronous network call to the external Supabase Auth server at the edge, introducing noticeable navigation latency.

### Conceptual Solution
Refactor middleware to invoke \`supabase.auth.getSession()\`. \`getSession()\` decodes the local JWT cookie without requiring a synchronous external network call, providing instantaneous edge route protection."

# 2. Unindexed Foreign Keys on Budgets Table
gh issue create \
  --title "Add B-Tree Index to Foreign Keys on Budgets Table" \
  --label "medium-priority" --label "tech-debt" --label "database" \
  --body "**Target File**: \`db/safe_db_setup.sql\`

### Problem Description
The foreign key \`category_id UUID REFERENCES categories(id) ON DELETE CASCADE\` on the \`budgets\` table lacks a B-tree index. Deleting a category causes Postgres to perform a sequential scan on \`budgets\` to verify cascading deletions, degrading database performance as table size grows.

### Conceptual Solution
Execute \`CREATE INDEX idx_budgets_category_id ON budgets(category_id);\` to ensure highly optimized relational lookups and rapid cascading deletions."

# 3. Weak Minimum Password Length & Open Signups
gh issue create \
  --title "Enforce NIST 8+ Password Standards and Isolate Public Signups" \
  --label "medium-priority" --label "security" --label "good-first-issue" \
  --body "**Target File**: \`supabase/config.toml\`

### Problem Description
Local Supabase config sets \`minimum_password_length = 6\` (falling below modern NIST 8+ guidelines) and \`enable_signup = true\` (allowing public registration bypassing the invite queue).

### Conceptual Solution
Update \`config.toml\` to set \`minimum_password_length = 8\`, enforce password complexity (\`password_requirements = \"lower_upper_letters_digits\"\`), and toggle \`enable_signup = false\` to isolate registration to admin invite flows."

# 4. Heavy Client-Side Data Aggregations
gh issue create \
  --title "Offload Chart Data Aggregation from Client to Supabase SQL RPC" \
  --label "medium-priority" --label "refactor" --label "performance" \
  --body "**Target Files**: \`src/components/DashboardTab.tsx\` & \`src/components/YearlyTab.tsx\`

### Problem Description
Both components load unpaginated expense lists from memory and perform heavy client-side filtering, grouping, and currency math in JS \`useMemo\` hooks. If historical expenses reach tens of thousands, client-side looping will freeze the UI thread.

### Conceptual Solution
Offload heavy data aggregation to Supabase. Implement SQL views or RPC functions (\`get_monthly_aggregates()\`) to return pre-calculated, grouped category totals directly to the frontend."

# 5. Eager Modal DOM Mounting
gh issue create \
  --title "Lazy Load Modals via Next.js Dynamic Imports" \
  --label "medium-priority" --label "performance" --label "refactor" \
  --body "**Target File**: \`src/components/ClientDashboard.tsx\`

### Problem Description
Eagerly mounts all modals (including the heavy 30KB \`RecurringModal\`) directly in the DOM tree on initial page load, regardless of whether their visibility flags are true, inflating initial JS bundles and delaying hydration.

### Conceptual Solution
Wrap all modal components in Next.js dynamic imports (\`next/dynamic\` with \`ssr: false\`), ensuring they are lazily fetched over the network only when opened by the user."

# 6. Embedded Helper Component Bloat
gh issue create \
  --title "Extract MultiSelectDropdown into Standalone UI Module" \
  --label "medium-priority" --label "refactor" --label "good-first-issue" \
  --body "**Target File**: \`src/components/ExpenseList.tsx\`

### Problem Description
Defines a 115-line custom \`MultiSelectDropdown\` component directly within its module scope instead of importing a reusable UI component, cluttering the main list component.

### Conceptual Solution
Extract \`MultiSelectDropdown\` into its own standalone module under \`src/components/ui/MultiSelectDropdown.tsx\`."

# 7. Tailwind v3 vs. v4 Configuration Redundancy
gh issue create \
  --title "Consolidate Styling Variables Exclusively into CSS @theme" \
  --label "low-priority" --label "tech-debt" --label "good-first-issue" \
  --body "**Target Files**: \`tailwind.config.ts\`, \`postcss.config.mjs\`, \`src/app/globals.css\`

### Problem Description
Maintains both a Tailwind v3 \`tailwind.config.ts\` file and a Tailwind v4 \`@theme\` block in CSS, creating developer confusion and PostCSS compilation overhead.

### Conceptual Solution
Consolidate all styling variables exclusively inside \`@theme\` in \`globals.css\`, delete \`tailwind.config.ts\`, and simplify \`postcss.config.mjs\`."

# 8. Unoptimized Production Compilation
gh issue create \
  --title "Inject Next.js Security Headers and Modularize Imports" \
  --label "low-priority" --label "security" --label "tech-debt" \
  --body "**Target File**: \`next.config.js\`

### Problem Description
Exports a completely blank configuration object \`{}\`, lacking security headers (CSP) or modularized import rules for UI icon libraries.

### Conceptual Solution
Inject Next.js security headers (Content-Security-Policy, X-Frame-Options) and configure \`modularizeImports\` for SVG icon libraries."

# 9. Exact Component Redundancy (DRY Violation)
gh issue create \
  --title "Consolidate AnyenAvatar and AnyenOrb into FrostedOrb" \
  --label "low-priority" --label "refactor" --label "good-first-issue" \
  --body "**Target Files**: \`src/components/AnyenAvatar.tsx\` & \`src/components/marketing/AnyenOrb.tsx\`

### Problem Description
Both files maintain 100% identical React component definitions and Tailwind frosted-glass classes across different directories.

### Conceptual Solution
Delete \`AnyenOrb.tsx\` and consolidate into a single reusable component \`src/components/ui/FrostedOrb.tsx\`."

# 10. Orphaned ai_tone State
gh issue create \
  --title "Purge or Wire Up Orphaned ai_tone Settings State" \
  --label "low-priority" --label "tech-debt" --label "good-first-issue" \
  --body "**Target Files**: \`src/components/SettingsForm.tsx\` & \`src/store/useExpenseStore.tsx\`

### Problem Description
Settings form and store maintain state for an \`ai_tone\` setting, but UI inputs are commented out and hidden, passing unused payload properties to backend update actions.

### Conceptual Solution
Either fully activate \`ai_tone\` by wiring it into AI extraction API prompts, or purge the dead code entirely from the codebase."

# 11. Loose TypeScript Compiler Flags
gh issue create \
  --title "Enforce Strict Compile-Time Type Safety in tsconfig" \
  --label "low-priority" --label "tech-debt" \
  --body "**Target File**: \`tsconfig.json\`

### Problem Description
Sets \`allowJs: true\` and \`skipLibCheck: true\`, permitting untyped legacy JS files to bypass compile-time type checks.

### Conceptual Solution
Progressively migrate legacy JS assets to TypeScript and set \`allowJs: false\`."

# 12. Hardcoded Developer Environment Paths
gh issue create \
  --title "Replace Hardcoded Home Paths with Dynamic Path Resolution" \
  --label "low-priority" --label "tech-debt" --label "good-first-issue" \
  --body "**Target File**: \`scripts/start_dev.sh\`

### Problem Description
Hardcodes explicit absolute developer home paths (\`/usr/local/google/home/duynguyenn/...\`) for NVM and working directories, breaking execution on external machines.

### Conceptual Solution
Use dynamic environment path resolution (\`cd \"\$(dirname \"\$0\")/..\"\`) and rely on standard user \`\$PATH\`."

# 13. Obsolete Asset Indexing Bloat
gh issue create \
  --title "Archive and Isolate Legacy Vite Application" \
  --label "low-priority" --label "tech-debt" \
  --body "**Target Directory**: \`legacy/\`

### Problem Description
Houses an entirely separate, obsolete Vite application complete with its own \`node_modules\` and fragile regex automation scripts, degrading IDE indexing performance.

### Conceptual Solution
Archive and isolate the \`legacy/\` directory outside the active Next.js repository structure."

echo "All 13 technical debt issues have been successfully created!"
