# Handoff Report — M5.4 Tier 4 E2E Test Pass Investigation

## 1. Observation
During our read-only investigation of the E2E test runner and Tier 4 test cases (multi-browser matrix, a11y audits, hydration resilience, and CLS bounding box checks) at `/usr/local/google/home/duynguyenn/expense-dashboard`, we directly observed the following:

- **Multi-Browser Matrix Configuration (`playwright.config.ts` & `e2e/run_e2e.ts`)**:
  - `playwright.config.ts` (lines 3-75) defines `const isCI = !!process.env.CI;` and dynamically sets `projects: isCI ? [ { name: 'chromium' ... }, { name: 'firefox' ... }, { name: 'webkit' ... }, { name: 'mobile-chrome' ... }, { name: 'mobile-safari' ... } ] : [ { name: 'chromium' ... } ]`.
  - `e2e/run_e2e.ts` (lines 526-535) states `// Run Playwright tests across all browsers sequentially` but spawns Playwright using `spawn('npx', ['playwright', 'test', '--workers=1', '--reporter=list', '--trace=off'], { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=256', PWDEBUG: '0', PLAYWRIGHT_CHROMIUM_USE_HERMETIC: '1' } });`. It does not set `CI: '1'` in the child process environment.

- **Accessibility Audits (`e2e/budget_planner_propagation.spec.ts` & `src/components/BudgetPlanner.tsx`)**:
  - `e2e/budget_planner_propagation.spec.ts` (lines 82-102) tests `should enforce scroll-padding-top accessibility to ensure focused inputs are not obscured beneath sticky toolbar`. It focuses an input (`await firstInput.focus()`) and asserts `expect(inputBox!.y).toBeGreaterThanOrEqual(toolbarBox!.y + toolbarBox!.height)`.
  - `src/components/BudgetPlanner.tsx` (lines 194-224) defines the root container as `<div data-testid="budget-planner-root" className="flex flex-col gap-6 text-left animate-fade-in pb-16 scroll-pt-[120px]">` and the sticky toolbar as `<div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border border-white/40 shadow-md rounded-2xl p-4...">`.

- **CLS Bounding Box Checks (`e2e/budget_streaming_suspense.spec.ts`, `src/app/(dashboard)/budget/loading.tsx`, `e2e/seed.ts`)**:
  - `e2e/budget_streaming_suspense.spec.ts` (lines 16-40) asserts `expect(Math.abs(plannerBox!.height - skeletonBox!.height)).toBeLessThanOrEqual(100);` to ensure zero Cumulative Layout Shift (CLS).
  - `src/app/(dashboard)/budget/loading.tsx` (lines 64-68) renders a mock category list with exactly 7 items: `{Array.from({ length: 7 }).map((_, i) => (<div key={i} className="w-full h-[86px] bg-white/40 rounded-2xl animate-pulse" />))}`.
  - `e2e/seed.ts` (lines 247-275) verifies that the Postgres trigger auto-seeds 16 default categories for the user, which are subsequently rendered in `src/components/BudgetPlanner.tsx`.

## 2. Logic Chain
- **Multi-Browser Matrix Bypass**: Because `e2e/run_e2e.ts` does not explicitly pass `CI: '1'` in the `env` object when spawning Playwright, `process.env.CI` remains undefined during local/agent test runner execution. Consequently, `isCI` in `playwright.config.ts` evaluates to `false`, causing Playwright to only execute the `chromium` project. The remaining 4 browsers (`firefox`, `webkit`, `mobile-chrome`, `mobile-safari`) are completely bypassed, violating the Tier 4 multi-browser matrix requirement.
- **Accessibility Audit Failure (Obscured Inputs)**: The CSS property `scroll-padding-top` (`scroll-pt-[120px]`) only functions when applied to a valid scroll container (e.g., `html`, `body`, or a container with `overflow-y-auto`). Because `src/components/BudgetPlanner.tsx` applies `scroll-pt-[120px]` to a static block `div` without overflow scrolling, the browser ignores it. When `firstInput.focus()` executes, the browser scrolls the input to the absolute top of the viewport, placing it directly beneath the sticky toolbar (`toolbarBox`). As a result, `inputBox!.y < toolbarBox!.y + toolbarBox!.height`, failing the accessibility test.
- **CLS Bounding Box Mismatch**: `BudgetPlannerSkeleton` (`loading.tsx`) hardcodes 7 skeleton rows (7 * 86px = 602px), whereas the actual `BudgetPlanner` renders 16 seeded categories (16 * 86px = 1376px). Even though both containers have `max-h-[40dvh] overflow-y-auto`, on viewports where `40dvh` exceeds 602px (e.g. taller desktop monitors or specific test configurations), the height disparity between the skeleton and the loaded planner exceeds the 100px threshold (`Math.abs(plannerBox!.height - skeletonBox!.height) > 100`), causing a severe Cumulative Layout Shift test failure.

## 3. Caveats
- **Read-Only Constraint**: As an explorer agent, we operated strictly in read-only mode and did not modify any source code or execute write operations to fix the identified issues.
- **Concurrency & Mutex Locks**: Multiple instances of `run_e2e.ts` were observed running concurrently in the environment, contending for `/tmp/run_e2e.lock`. Ensure that lingering test runner processes are terminated before verifying fixes to prevent lock contention.

## 4. Conclusion
To achieve a 100% pass rate for Milestone 5.4 (Tier 4 E2E Test Pass), the implementer must execute the following concrete fix strategy:

1. **Enable Multi-Browser Matrix**: In `e2e/run_e2e.ts` (line 532), add `CI: '1'` to the `env` object passed to `child_process.spawn`:
   ```typescript
   // Before
   env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=256', PWDEBUG: '0', PLAYWRIGHT_CHROMIUM_USE_HERMETIC: '1' }
   // After
   env: { ...process.env, CI: '1', NODE_OPTIONS: '--max-old-space-size=256', PWDEBUG: '0', PLAYWRIGHT_CHROMIUM_USE_HERMETIC: '1' }
   ```

2. **Fix Accessibility Scroll Padding**: In `src/components/BudgetPlanner.tsx` (line 194), add `overflow-y-auto max-h-screen` to the root container so `scroll-pt-[120px]` is correctly respected by the browser:
   ```tsx
   // Before
   <div data-testid="budget-planner-root" className="flex flex-col gap-6 text-left animate-fade-in pb-16 scroll-pt-[120px]">
   // After
   <div data-testid="budget-planner-root" className="flex flex-col gap-6 text-left animate-fade-in pb-16 scroll-pt-[120px] overflow-y-auto max-h-screen">
   ```
   *(Alternatively, move `scroll-pt-[120px]` to the `body` tag in `src/app/layout.tsx`).*

3. **Align CLS Skeleton Height**: In `src/app/(dashboard)/budget/loading.tsx` (line 65), change the skeleton array length from 7 to 16 to match the auto-seeded category count:
   ```tsx
   // Before
   {Array.from({ length: 7 }).map((_, i) => (
   // After
   {Array.from({ length: 16 }).map((_, i) => (
   ```

## 5. Verification Method
To independently verify the fixes, the implementer or verification agent should execute the following commands:

1. **Verify E2E Test Runner & Multi-Browser Matrix**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
   - **Expected Result**: Playwright launches all 5 browser projects (`chromium`, `firefox`, `webkit`, `mobile-chrome`, `mobile-safari`) and all tests pass with exit code 0.

2. **Verify Specific Tier 4 Test Suites**:
   ```bash
   npx playwright test e2e/budget_planner_propagation.spec.ts e2e/budget_streaming_suspense.spec.ts --reporter=list
   ```
   - **Expected Result**: Both the `scroll-padding-top` accessibility audit and the `zero CLS` bounding box check pass successfully across all configured viewports.
