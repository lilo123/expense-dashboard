# Migration TODO: Vanilla to React (Phase 1.5)

## Phase 1: Base Architecture & Data Initialization
*Goal: Ensure the layout is stable and the app correctly pulls data from Supabase on load.*
- [ ] Restore exact legacy HTML structure and CSS classes. No redesigns or external UI libraries.
- [ ] Ensure all tabs (Dashboard, Recent, Categories, Settings) match legacy structure and events.
- [ ] Data Initialization: Load categories, expenses, and current user on app load (Zustand/Component mount).
- [ ] Catch and propagate Supabase errors correctly within the state.

## Phase 2: Core CRUD Operations & Modals
*Goal: Wire up the basic ability to add, edit, and delete single items, and make the modals work.*
- [ ] **Data Layer**: Implement single `expenseService` operations (`fetchAll`, `add`, `update`, `delete`).
- [ ] **Data Layer**: Implement single `categoryService` operations (`update`, `delete`).
- [ ] **State**: Implement form validation before submission (`!item || isNaN(amount) || !category || !date`) and handle UI error states (`showCategoryError`).
- [ ] **UI Logic**: Ensure modal visibility toggles explicitly handle switching between `display: none` and `display: flex` / `block` matching the legacy `ui.js` behavior.
- [ ] **UI Elements**: Implement `delete-edit-btn` (Delete from Edit Modal action).
- [ ] **UI Elements**: Ensure `editBtn` and `delBtn` in categories use the exact legacy SVGs dynamically created in `render.js` (using `width="18" height="18" viewBox="0 0 24 24"...`).
- [ ] **UI Elements**: Implement inline JS hover effects for category list items (`box-shadow: 0 1px 4px rgba(0,0,0,0.1)`) and category action buttons (background `#f1f3f4`, colors `#1a73e8` / `#d93025`).

## Phase 3: Bulk Actions & Advanced State
*Goal: Implement the selection mode and multi-item database operations.*
- [x] **UI Logic**: Implement `select-mode-btn` (Select Mode toggle).
- [x] **UI Logic**: Implement individual checkbox click handling and event propagation (`handleCheckboxClick`).
- [x] **State**: Manage selected items via a Set for bulk operations.
- [x] **Data/UI**: Implement `bulk-delete-btn` (Bulk Delete action) and backend `deleteBulk`.
- [x] **Data**: Implement backend bulk update expenses (`updateBulk`).
- [x] **Data**: Cascade category name updates to expenses (`updateCategoryName`).

## Phase 4: Chart Accuracy & Interactivity
*Goal: Replicate the exact math, formatting, and drill-down interactions of the legacy charts.*
- [x] Implement `Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })` for Y-axis currency formatting.
- [x] Retain dynamic chart container height calculation (`Math.max(300, labels.length * 40 + 50) + 'px'`) based on dataset size.
- [x] Replicate `parseLocalDate` to prevent timezone offsets when binning expenses by year/month.
- [x] Ensure `onClick` and `onHover` pointer events map accurately onto Chart.js elements.
- [x] **Chart Drill-Down**: Ensure clicking a chart segment (via `onClick(e, activeElements)`) filters the UI to show details for that category/month (via `onCategoryClick` or `onMonthClick`), and the window programmatically scrolls down to it using `container.scrollIntoView({ behavior: 'smooth' })`.

## Phase 5: Edge Features & Polish
*Goal: Fix mobile quirks, auth visuals, and the Siri/Chat integrations.*
- [ ] **Mobile**: Implement `visualViewport` event listeners ('resize', 'scroll') for mobile software keyboard handling, referencing `updateViewport` logic.
- [ ] **Auth**: Implement the inline `#toggle-to-signup` and `#toggle-to-signin` anchors without full page navigation.
- [ ] **Auth**: Ensure password toggle buttons alternate correctly using the exact legacy SVGs (Visible/Hidden paths).
- [ ] **Siri Setup**: Implement Siri Setup modal, copy-to-clipboard functionality, and token generation UI actions (`generateSiriToken`, `copySiriToken`).
- [ ] **Siri Data**: Implement `tokenService` (`fetchLatest`, `create`).
- [ ] **Chat API**: Send message to `/api/chat` with local timezone date (`toLocalDateString(new Date())`).
- [ ] **Chat API**: Handle fallback categories during chat submission.
- [ ] **Loading States**: Replicate button disable/enable logic and text swaps during async operations (e.g., 'Generating...' on Siri token generation, 'Thinking...' in ChatBox, 'Copied!' feedback).
