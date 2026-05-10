# An-yen Wealth App - Testing Strategy & Guidelines

Welcome to the testing documentation for An-yen. This document outlines our testing architecture, detailed step-by-step execution instructions, and our strict brand-compliance, currency precision, and design-system assertions.

---

## 1. Execution Guide

We utilize a two-tier testing architecture: **Jest** (for isolated store/component unit tests) and **Playwright** (for full-stack, browser-simulated E2E integration tests across desktop and mobile viewports).

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
E2E tests require your local Next.js server and your local Supabase Docker containers to be running. Playwright executes the entire suite across 5 viewports: Desktop Chromium, Desktop Firefox, Desktop Safari (WebKit), Mobile Chrome (Pixel 5 Emulation), and Mobile Safari (iPhone 12 Emulation).

*   **Recommended Safe E2E Run (Automated Swap & Safe Restore)**:
    This custom script automatically backs up your active cloud `.env.local`, swaps in local test credentials, compiles migrations, seeds the local DB, runs all 5 browser projects, and **guarantees your original cloud environment is fully restored on completion**:
    ```bash
    npx tsx e2e/run_e2e.ts
    ```
*   **Raw Playwright CLI** (Runs chromium project directly):
    ```bash
    npx playwright test --project=chromium
    ```
*   **Run Mobile Emulation Projects Directly**:
    ```bash
    npx playwright test --project=mobile-chrome
    npx playwright test --project=mobile-safari
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
    Our custom PG initializer connects directly to the local Postgres port (54322) and applies the base tables (`20260510000000_init.sql`), currency additions (`20260510140000_phase_1_65.sql`), and CAD default extensions (`20260510150000_phase_1_65_extensions.sql`) before issuing the PostgREST reload signal:
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

---

## 4. Test Coverage Summary

### A. Unit Tests (Jest + RTL)
*   **Zustand Store (`useExpenseStore.tsx`)**: Verifies store hydration, state values, active filters, and currency preferred settings.
*   **Currency Utilities (`utils.test.ts`)**: Tests precision math rounding, CAD prefixes, and VND large numerical `K/M` formatting.
*   **AI Chat Box (`ChatBox.tsx`)**: Asserts optimistic UI loads and empathetic error fallbacks.
*   **Recent List (`ExpenseList.tsx`)**: Verifies list item rendering in original spent currencies.
*   **Modals (`AddExpenseModal.tsx`)**: Asserts ARIA-labeled selects and converts foreign currency values to base currency on submit.

### B. E2E Integration Tests (Playwright)
*   **Trigger Seeding (`currency.spec.ts`)**: Asserts the Postgres categories trigger automatically auto-seeds all 16 categories inside `public.categories` on user signup.
*   **LocalStorage Currency Persistence (`currency.spec.ts`)**: Verifies that changing a Display Currency preference is cached in local storage and safely restored upon page reloads without triggering Next.js hydration mismatch warnings.
*   **Multi-Currency conversions**: Logs `100,000 VND`, asserts the DB stores the CAD converted equivalent (`$5.41`), while the Recent List displays the raw spent `100K ₫`.
*   **Mobile Viewports emulations**: Tests manual CRUD logging and category dropdowns inside simulated Pixel 5 and iPhone 12 viewports.
