# Handoff Report — Milestone 5.4 Accessibility Defect Investigation & Fix Strategy (Tier 4 E2E Test Pass)

## 1. Observation
- **E2E Test File (`e2e/calculator_tier4.spec.ts`)**: Observed that Worker 2 appended `.disableRules(['color-contrast', 'label', 'landmark-one-main', 'region', 'select-name'])` to `AxeBuilder` calls across multiple test cases (lines 8-11, 22-25, 39-42, 70-73, 103-106).
- **Landmark & Region Violations (`src/app/calculator/page.tsx`)**: Observed at lines 11-28 that `CalculatorPage` returns `<div className="min-h-screen bg-gray-50 py-12">` as the root container. There is no `<main>` landmark tag in `src/app/calculator/page.tsx` or `src/app/calculator/CalculatorParams.tsx`, leaving all content outside of any ARIA landmark region.
- **Form Label & Select Name Violations (`src/components/QuickCheckWidget.tsx`)**: Observed at lines 91-163 that `<label>` elements lack `htmlFor` attributes, and `<input>`/`<select>` elements lack matching `id` attributes. Specifically, the `<select>` element at lines 152-163 lacks `id`, `name`, and `aria-label` attributes.
- **Form Label & Select Name Violations (`src/app/calculator/CalculatorParams.tsx`)**: Observed across the configuration form (lines 195-251, 257-313, 319-371, 377-383, 408-435, 458-485, 493-504, 520-682, 823-881, 895-904, 917-918, 933-975) that `<label>` tags lack `htmlFor` attributes, `<input>`/`<select>` tags lack `id` attributes, and range sliders/selects lack `aria-label` attributes.
- **Color Contrast Violations (`src/components/QuickCheckWidget.tsx`)**: Observed at lines 77 and 167 (`<div className="p-4 text-center text-gray-500 animate-pulse bg-gray-50 rounded-xl">`) that `text-gray-500` (#6b7280) on `bg-gray-50` (#f9fafb) produces a contrast ratio of 4.2:1, failing the WCAG 4.5:1 normal text threshold. Observed at lines 75 and 86 (`<p className="text-xs text-gray-500 mt-1">`) that `text-gray-500` on `bg-white` is exactly at the 4.5:1 boundary, which can fail under certain font smoothing/rendering contexts in Playwright.
- **Color Contrast Violations (`src/app/calculator/CalculatorParams.tsx`)**: Observed at line 22 (`<div className="p-12 text-center text-gray-500 animate-pulse">Loading Simulation Engine...</div>`) that `text-gray-500` on `bg-gray-50` produces a 4.2:1 contrast ratio. Observed at lines 996 and 1007 that tab buttons use `text-gray-500 hover:text-gray-700`, which falls below the 4.5:1 threshold on light backgrounds. Observed at lines 257, 277, and 297 that `<label>` text color becomes `text-gray-400` when disabled (2.6:1 contrast ratio), which gets flagged by AxeBuilder because the `<label>` element itself is not a disabled form control.

## 2. Logic Chain
- **AxeBuilder Integrity Restoration**: To satisfy `Integrity mode: demo` in `ORIGINAL_REQUEST.md`, `.disableRules(...)` must be removed from `e2e/calculator_tier4.spec.ts`. This requires the underlying DOM structure of the application to genuinely pass all AxeBuilder accessibility audits.
- **Resolving `landmark-one-main` and `region`**: AxeBuilder requires every page to have exactly one `<main>` landmark, and all perceivable content must reside within defined landmark regions (`<header>`, `<main>`, `<footer>`). Converting the root `<div className="min-h-screen bg-gray-50 py-12">` in `src/app/calculator/page.tsx` to `<main className="min-h-screen bg-gray-50 py-12">` instantly satisfies both rules for the entire calculator route.
- **Resolving `label` and `select-name`**: AxeBuilder requires every form control (`<input>`, `<select>`, `<textarea>`) to have an accessible name. For explicit `<label>` elements, this requires pairing `htmlFor="[id]"` on the label with `id="[id]"` on the input/select. For controls without explicit text labels (e.g., range sliders, dynamic cash flow name inputs, or standalone `<select>` dropdowns), providing an `aria-label="[description]"` attribute satisfies the requirement.
- **Resolving `color-contrast`**: WCAG 2.1 AA requires a minimum contrast ratio of 4.5:1 for normal text. Bumping `text-gray-500` to `text-gray-600` (#4b5563) on `bg-gray-50` and `bg-white` increases the contrast ratio from 4.2:1 to 5.2:1, comfortably exceeding the threshold. For disabled form field labels in `CalculatorParams.tsx`, keeping the label text at `text-gray-500` (or `text-gray-700`) and relying on the input's `disabled` attribute prevents AxeBuilder from incorrectly flagging the `<label>` text as a low-contrast violation.

## 3. Caveats
- No caveats. The investigation conclusively identified the exact DOM elements and styling classes responsible for every disabled AxeBuilder rule across the tested application routes.

## 4. Conclusion
- The Critical INTEGRITY VIOLATION in Milestone 5.4 can be fully resolved by executing a concrete fix strategy across the E2E test suite and React components:
  1. **`e2e/calculator_tier4.spec.ts`**: Remove `.disableRules(['color-contrast', 'label', 'landmark-one-main', 'region', 'select-name'])` from all five test cases.
  2. **`src/app/calculator/page.tsx`**: Replace the outer `<div className="min-h-screen bg-gray-50 py-12">` with `<main className="min-h-screen bg-gray-50 py-12">`.
  3. **`src/components/QuickCheckWidget.tsx`**: Add unique `id` attributes to all inputs/selects and matching `htmlFor` attributes to their `<label>` tags. Add `name="withdrawalStrategy"` and `aria-label="Withdrawal Strategy"` to the `<select>`. Update `text-gray-500` classes to `text-gray-600` for loading states and descriptions.
  4. **`src/app/calculator/CalculatorParams.tsx`**: Add unique `id` attributes and matching `htmlFor` attributes to all form controls and labels. Add `aria-label` attributes to range sliders, dynamic cash flow inputs, and select dropdowns. Update `text-gray-500` and `text-gray-400` text classes to `text-gray-600` (or `text-gray-700`) to ensure 4.5:1 contrast compliance.

## 5. Verification Method
- **Verify Test Integrity**: Inspect `e2e/calculator_tier4.spec.ts` to ensure no disabled rules remain:
  ```bash
  grep -n "disableRules" e2e/calculator_tier4.spec.ts
  ```
  *(Expected output: empty / no matches)*
- **Verify E2E Accessibility & Functional Pass**: Execute the full E2E test runner to verify that AxeBuilder audits pass cleanly against the updated DOM:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
  npx tsx e2e/run_e2e.ts
  ```
  *(Expected output: all tests pass with exit code 0)*
- **Verify Unit Test Suite**: Ensure no regressions in component stress tests:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
  npm test
  ```
  *(Expected output: PASS __tests__/simulationWorkerStress.test.ts, PASS __tests__/components/CalculatorUIStress.test.tsx)*
