# An-yen Wealth App - Testing Strategy & Guidelines

Welcome to the testing documentation for An-yen. This document outlines our testing architecture, detailed step-by-step execution instructions, and our strict brand-compliance, currency precision, and design-system assertions.

---

## 1. Execution Guide & The 4-Tier Productivity Workflow

We utilize a two-tier testing architecture: **Jest** (for isolated store/component unit tests) and **Playwright** (for full-stack, browser-simulated E2E integration tests across desktop and mobile viewports). To maintain sub-second developer feedback loops while ensuring 100% cross-browser compatibility, our testing ecosystem is decoupled into four distinct execution tiers:

```
┌─────────────────────────────────────────────────────────┐
│ Tier 1: Local Watch-Mode Unit Testing (< 2s)            │
│ (Jest / React Testing Library -> npm run test:watch)    │
└────────────────────────────┬────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────┐
│ Tier 2: Targeted Single-Spec E2E (< 5s)                 │
│ (Playwright Desktop Chromium -> e2e/currency.spec.ts)   │
└────────────────────────────┬────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────┐
│ Tier 3: Automated Git Pre-Push Smoke Tests (~15s)       │
│ (Husky / Lefthook -> Core Auth & Dashboard Specs)       │
└────────────────────────────┬────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────┐
│ Tier 4: Asynchronous Cloud CI/CD Auditing (Cloud CPU)   │
│ (Full 175-Test Multi-Browser Cross-Compatibility Run)   │
└─────────────────────────────────────────────────────────┘
```

### A. Unit & Component Tests (Jest)
Jest tests are completely offline, isolated, and run in milliseconds by mocking out database layers.

*   **Run all unit tests once**:
    ```bash
    npm run test
    ```
*   **Run in watch mode** (re-runs automatically when files change):
    ```bash
    npm run test:watch
    ```

### B. E2E Integration Tests (Playwright - Desktop & Mobile)
E2E tests require your local Next.js server and your local Supabase Docker containers to be running. 

*   **Local Fast-Feedback Mode (Desktop Chromium)**:
    This custom script automatically backs up your active cloud `.env.local`, swaps in local test credentials, compiles migrations, seeds the local DB, runs optimized tests strictly on **Desktop Chromium** in ~10 seconds, and **guarantees your original cloud environment is fully restored on completion**:
    ```bash
    npx tsx e2e/run_e2e.ts
    ```
*   **Full Multi-Browser CI Emulation Mode**:
    When running under Continuous Integration (`process.env.CI`), Playwright automatically expands test execution across all 5 supported browser emulations (Desktop Chromium, Desktop Firefox, Desktop Safari, Mobile Chrome, Mobile Safari):
    ```bash
    CI=true npx tsx e2e/run_e2e.ts
    ```
*   **Raw Playwright CLI** (Runs chromium project directly):
    ```bash
    npx playwright test --project=chromium
    ```
*   **View E2E HTML Report Page**:
    Spins up a local web server on port 9323 to inspect screen recordings, network logs, and DOM snapshots of the last test run:
    ```bash
    npx playwright show-report
    ```

### C. Local Supabase CLI (Docker Setup)
To run E2E tests locally without polluting your cloud databases, Supabase CLI replicates the entire cloud stack locally using lightweight Docker containers.

1.  **Initialize configuration** (generates `supabase/config.toml` if missing):
    ```bash
    npx supabase init
    ```
2.  **Start local database and auth containers**:
    ```bash
    npx supabase start
    ```
3.  **Apply all migrations DDL sequentially & force cache reload**:
    Our custom PG initializer connects directly to the local Postgres port (54322) and applies base tables (`20260510000000_init.sql`), currency additions (`20260510140000_phase_1_65.sql`), CAD extensions (`20260510150000_phase_1_65_extensions.sql`), recurring cron additions (`20260511000000_phase_1_8_recurring.sql`), and visual refinements (`20260511140000_phase_1_8_refinement.sql`) sequentially:
    ```bash
    npx tsx e2e/init_db.ts
    ```
4.  **Seed the test database** (Deletes previous test users, creates `test-user@example.com` triggers categories seeding, seeds mock exchange rates CAD base, and generates 35 historical expenses):
    ```bash
    npx tsx --env-file=.env.test e2e/seed.ts
    ```
5.  **Stop local containers** (when finished testing):
    ```bash
    npx supabase stop
    ```

---

## 2. Brand & Empathy Assertions ("No Game Overs")

Our brand philosophy is rooted in empathy and mindfulness. We strictly reject traditional, anxiety-inducing financial language and hardcode precision controls to protect currency records.

> [!IMPORTANT]
> **The "No Game Overs" Testing Rule**: 
> All UI component unit tests and E2E test cases must assert that the user interface contains **zero negative financial jargon** and **never surfaces raw database error logs**.

### Jargon Constraints:
*   **Forbidden Terms**: "Debt", "Penalty", "Failing", "Over-limit", "Deficit".
*   **Approved Terms**: "Flow", "Pace", "Reallocate", "Borrowed", "Slow down".

### Error Handling Constraints:
*   **Global Empathetic Catch-All**: If a network or database server-side error occurs, the application must display:
    > *"Uh oh, the system tripped up! Don't worry, your data is safe. Let's try that again."*

### Currency Precision Constraints & CAD defaults:
*   **Float Math Rounding**: Unit tests (`utils.test.ts`) verify that currency exchange rates and identical pairs are clamped strictly to 2 decimal places to prevent floating-point tail drifts in the UI.
*   **CAD Baseline**: All default user profiles log and baseline in **CAD (C$)** by default to maintain a clean, standard launching pad. CAD and VND are re-ordered to sit at the top of all select lists.
*   **VND Compactness**: VN Dong values are compressed dynamically (e.g. `₫100K`, `₫1.5M`) rather than rendering large numerical digits, preserving clean, uncluttered glassmorphism card structures.

---

## 3. Design System & Aesthetic Assertions (Zen & Fluid UI)

Our frontend tests validate that the UI correctly aligns with the An-yen Zen aesthetic. 

### UI Style Assertions:
*   **Tailwind Zen Palette**: Verify components utilize our custom pastel theme classes (`bg-zen-base`, `text-zen-charcoal`, `bg-zen-sage`, etc.).
*   **Glassmorphism Utility**: Cards and modals must use our signature frosted glass look (`bg-white/40 backdrop-blur-md border border-white/20`).
*   **Fluid Rounded Corners**: No harsh 90-degree corners (`rounded-full`, `rounded-3xl`, `rounded-2xl`).
*   **The Levitating iridescent AI Orb**: The An-yen AI Companion must use the pure CSS `animate-liquid-flow` keyframe morphing without WebGL to guarantee 100% lightweight, fast loading.
*   **Global Modals Layout Alignment & Overlap Safety**: Automated tests measure outer bounding boxes (`titleBox.x`, `closeBox.x`, etc.) across viewports to guarantee that absolute close triggers never intersect or collide with text elements.
*   **Visual Snapshots Baseline Matching (`toHaveScreenshot`)**: Targets header container boxes to compare rasterized browser renders against saved baseline images, locking in optical visual centering (flex centers, baseline adjustments, and button padding overrides) exactly.
*   **Automated Mathematical Filter Heights Alignment Tests**: E2E tests dynamically fetch the bounding boxes of the Search Input, Category Filter Dropdown, Type Filter Dropdown, and Sort Select button. It mathematically asserts that their rendered heights are **exactly identical** down to the sub-pixel (e.g. 36px), preventing any vertical alignment mismatches or CSS cascading regressions!
*   **Layered Glass-on-Glass Card Layouts**: Sub-settings containers inside modals are styled using a higher white opacity/tint (**`bg-white/60 border-zen-lavender/40 shadow-sm`**) compared to the base modal's `bg-white/40` background, giving them a beautiful premium 3D layered contrast.

---

## 4. Test Coverage Summary

### A. Unit Tests (Jest + RTL)
*   **Zustand Store (`useExpenseStore.tsx`)**: Verifies store hydration, state values, active filters, and currency preferred settings.
*   **Currency Utilities (`utils.test.ts`)**: Tests precision math rounding, CAD prefixes, and VND large numerical `K/M` formatting.
*   **AI Chat Box (`ChatBox.tsx`)**: Asserts optimistic UI loads and empathetic error fallbacks.
*   **Recent List (`ExpenseList.tsx`)**: Verifies list item rendering in original spent currencies.
*   **Modals (`AddExpenseModal.tsx`)**: Asserts ARIA-labeled selects and converts foreign currency values to base currency on submit.
*   **Recurring Manager (`RecurringModal.tsx`)**: Unit tests verify real-time client-side first execution date calculations, Ends radio button selections, and active input state enabling/disabling.
*   **Database Calendar Math Triggers (`recurring_db.test.ts`)**: Verifies pg_cron triggers under past frozen years to assert Month Cap (May 31 -> June 30), Feb Non-Leap (Jan 30 -> Feb 28), and Feb Leap Year (Jan 31 -> Feb 29) boundary transitions.

### B. E2E Integration Tests (Playwright)
*   **Trigger Seeding (`currency.spec.ts`)**: Asserts the Postgres categories trigger automatically auto-seeds all 16 categories inside `public.categories` on user signup.
*   **LocalStorage Currency Persistence (`currency.spec.ts`)**: Verifies that changing a Display Currency preference is cached in local storage and safely restored upon page reloads without triggering Next.js hydration mismatch warnings.
*   **Multi-Currency conversions**: Logs `100,000 VND`, asserts the DB stores the CAD converted equivalent (`$5.41`), while the Recent List displays the raw spent `100K ₫`.
*   **Scheduled Expenses CRUD Scheduling (`recurring.spec.ts`)**: Verifies the complete end-to-end recurring expense CRUD flow (weekly pills, Ends After Occurrences radio selections, dynamic helper date strings) and confirms background database inserts.
*   **Global Modals Overlap & Visual regression (`modals_ui.spec.ts`)**: Verifies structural safety (zero exit overlaps, roundness, deep charcoal accessibility text contrast) on both Desktop (`1280x800`) and Mobile (`375x812`) viewport emulations across all 6 application modals.
*   **Onboarding Category Polish & Safeguards (`onboarding_safeguards.spec.ts`)**: Verifies inline category additions are rendered dynamically, and active categories are strictly protected from deletion if linked to active expenses.
*   **Onboarding Skip Flow Persistence (`onboarding_safeguards.spec.ts`)**: Verifies that skipping onboarding asynchronously updates the profile's onboarding status, closes the modal, and persists the completed state successfully across manual browser reloads.

---

## 5. Architectural Defenses & E2E Stability

### A. Hydration Locks for Webkit Stability
Next.js `Suspense` boundaries unmount and remount input elements upon client-side hydration. To prevent Playwright from typing into unhydrated inputs (which causes Webkit login failures), inputs utilize a native React mount lock:
```tsx
const [isMounted, setIsMounted] = useState(false);
useEffect(() => setIsMounted(true), []);

<input type="email" disabled={!isMounted} />
```
Playwright's actionability engine pauses automatically until `isMounted` resolves, guaranteeing 0% flakiness.

### B. Mobile Viewport Number Compression
Mobile viewports format numbers over $1,000$ into compressed friendly strings (e.g., `1,324.51` $\rightarrow$ `1.32K`). E2E assertions respect this layout by conditioning desktop-specific checks:
```typescript
await expect(totalLabel).toContainText('€');
if (!isMobile) {
  await expect(totalLabel).not.toContainText('K');
}
```

### C. Same-Site Domain Resolution
Safari/Webkit's **Intelligent Tracking Prevention (ITP)** blocks auth session cookies if the app runs on `localhost` and Supabase connects to `127.0.0.1`. E2E configurations explicitly map `NEXT_PUBLIC_SUPABASE_URL` to `http://localhost:54321` in `.env.test` to satisfy first-party same-site rules.

---

## 6. Strict Automated QA Safeguards & Regression Defenses

### A. Global Jest ConsoleError Guard (`jest.setup.ts`)
To proactively catch state rendering violations, key conflicts, and hydration issues before they reach production, we utilize a global custom `ConsoleGuard` warning spy in our Jest setup configuration. 
If React triggers any forbidden warnings or error patterns during test execution, the spy intercepts the console stream and **fails the test suite instantly** with an informative traceback.

*   **Monitored Warning & Error Patterns**:
    *   `not wrapped in act` (Concurrent rendering/async issues)
    *   `Each child in a list should have a unique "key" prop` (List rendering bugs)
    *   `React does not recognize the.*prop on a DOM element` (Prop mismatches)
    *   `Text content did not match` / `Hydration failed` (SSR/Client mismatch errors)
    *   `Cannot update a component while rendering a different component` (Zustand render-phase warning)
    *   `Can't perform a React state update on an unmounted component` (Memory leak warnings)

### B. Playwright Strict Bounding Box Alignment (`e2e/budget_streaming_suspense.spec.ts`)
To prevent Cumulative Layout Shift (CLS) regressions, our E2E test suite validates structural height and position symmetry between loading skeleton states and fully loaded dynamic layouts. 

By throttling network connections, the tests capture the precise bounding box coordinates ($x$, $y$, $width$, $height$) of the loading skeletons, wait for server-side streaming to resolve, capture the fully loaded page boundaries, and assert strict sub-pixel thresholds:

*   **Layout Assertions**:
    *   **Horizontal & Vertical Centering Alignment**: Bounding box position ($x$, $y$) differences must be `Math.abs(plannerBox.y - skeletonBox.y) <= 1.0px`.
    *   **Height Symmetry**: Bounding box height differences must be `Math.abs(plannerBox.height - skeletonBox.height) <= 100.0px`. This prevents dynamic content from shifting elements below by more than a minor visual margin, guaranteeing professional layout stability.
