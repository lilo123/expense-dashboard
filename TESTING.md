# An-yen Wealth App - Testing Strategy & Guidelines

Welcome to the testing documentation for An-yen. This document outlines our testing architecture, detailed step-by-step execution instructions, and our strict brand-compliance and design-system assertions that ensure our frontend matches our core philosophies.

---

## 1. Execution Guide

We utilize a two-tier testing architecture: **Jest** (for isolated store/component unit tests) and **Playwright** (for full-stack, browser-simulated E2E integration tests).

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

### B. E2E Integration Tests (Playwright)
E2E tests require your local Next.js server and your local Supabase Docker containers to be running.

*   **Recommended Safe E2E Run (Automated Swap & Safe Restore)**:
    This custom script automatically backs up your active cloud `.env.local`, swaps in local test credentials, seeds the local DB, runs the Chromium Playwright tests, and **guarantees your original cloud environment is fully restored on completion**:
    ```bash
    npx tsx e2e/run_e2e.ts
    ```
*   **Raw Playwright CLI** (Runs Chromium tests directly without wrapper):
    ```bash
    npx playwright test --project=chromium
    ```
*   **View E2E HTML Report Page**:
    Spins up a local web server to inspect screen recordings, network logs, and DOM snapshots of the last test run:
    ```bash
    npx playwright show-report
    ```

### C. Local Supabase CLI (Docker Setup)
To run E2E tests locally without polluting your cloud databases, Supabase CLI replicates the entire cloud stack locally using lightweight Docker containers.

1.  **Initialize configuration** (generates `supabase/config.toml` if missing):
    ```bash
    npx supabase init
    ```
2.  **Start the local database and auth containers**:
    ```bash
    npx supabase start
    ```
3.  **Apply migrations DDL manually & force API cache reload**:
    Our custom PG initializer connects directly to the local Postgres port (54322) and issues a PostgREST reload signal, bypassing Docker socket permission blocks:
    ```bash
    npx tsx e2e/init_db.ts
    ```
4.  **Seed the test database** (Wipes previous runs, registers `test-user@example.com` with `password123`, and inserts default categories like *Food*, *Transport*, and *Utilities*):
    ```bash
    npx tsx --env-file=.env.test e2e/seed.ts
    ```
5.  **Stop local containers** (when finished testing):
    ```bash
    npx supabase stop
    ```

---

## 2. Brand & Empathy Assertions ("No Game Overs")

Our brand philosophy is rooted in empathy and mindfulness. We strictly reject traditional, anxiety-inducing financial language. 

> [!IMPORTANT]
> **The "No Game Overs" Testing Rule**: 
> All UI component unit tests and E2E test cases must assert that the user interface contains **zero negative financial jargon** and **never surfaces raw backend/database error logs**.

### Jargon Constraints:
*   **Forbidden Terms**: "Debt", "Penalty", "Failing", "Over-limit", "Deficit".
*   **Approved Terms**: "Flow", "Pace", "Reallocate", "Borrowed", "Slow down".

### Error Handling Constraints:
*   **Raw Exceptions**: Raw database, authentication, or Network REST exceptions must **NEVER** be displayed to the user.
*   **Global Empathetic Catch-All**: If a network or server-side error (500) occurs, the application must intercept it and display the warm, brand-approved fallback message:
    > *"Uh oh, the system tripped up! Don't worry, your data is safe. Let's try that again."*

#### Verified Implementation in `ChatBox.tsx`:
Our component tests in `__tests__/components/ChatBox.test.tsx` explicitly mock a `500 Database Crash` and assert that:
1.  The raw string `"Database crash"` is **NOT** rendered.
2.  The global catch-all empathetic message is displayed to maintain a calm, encouraging atmosphere.

---

## 3. Design System & Aesthetic Assertions (Zen & Fluid UI)

Our frontend tests validate that the UI correctly aligns with the An-yen Zen aesthetic. 

### UI Style Assertions:
*   **Tailwind Zen Palette**: Verify components utilize our custom pastel theme classes:
    *   `bg-zen-base` (light cream background)
    *   `text-zen-charcoal` (dark charcoal text)
    *   `bg-zen-lavender` / `border-zen-lavender` (soft lilac highlights)
    *   `bg-zen-sage` (muted green for selections and success)
    *   `bg-zen-peach` (pastel peach for warning states)
*   **WCAG AA Contrast Compliance**: pastel backgrounds (like `bg-zen-sage/20` or `bg-white/40`) must be paired with `text-zen-charcoal` to ensure high readability and strict WCAG accessibility contrast.
*   **Glassmorphism Utility**: Cards and modals must use our signature frosted glass look:
    *   `bg-white/40` (semi-transparent white)
    *   `backdrop-blur-md` (frosted blur)
    *   `border-white/20` (subtle border)
*   **Fluid Rounded Corners**: No harsh 90-degree corners. Elements must use pill-shaped utility classes (e.g., `rounded-full`, `rounded-3xl`, `rounded-2xl`).
*   **The Levitating iridescent AI Orb**: The An-yen AI Companion (`AnyenOrb.tsx` and `AnyenAvatar.tsx`) must be styled using the pure CSS `animate-liquid-flow` animation class. 
    > [!WARNING]
    > **No Heavy 3D Engines**: E2E tests verify that the orb uses fluid CSS keyframe morphing and **does not load heavy WebGL engines** (like Three.js) to guarantee the application remains lightweight, fast-loading, and highly responsive on mobile viewports.

---

## 4. Test Coverage Summary

### A. Unit Tests (Jest + RTL)
*   **Zustand Store (`useExpenseStore.tsx`)**: Verifies store initialization, modal state triggers, active tab filters, selection mode Set changes, bulk category updates, and database category cascading.
*   **AI Chat Box (`ChatBox.tsx`)**: Asserts message log lists, dynamic message inputs, **optimistic UI updates** (displaying the user's input and "Thinking..." instantly before network API responds), and empathetic error fallbacks.
*   **Recent List (`ExpenseList.tsx`)**: Verifies expense list rendering, selection checkbox clicks, and bulk action button triggers.
*   **Modals (`AddExpenseModal.tsx`)**: Asserts form inputs, required field validations, and correct action dispatch on submit.

### B. E2E Integration Tests (Playwright)
*   **Authentication (`auth.spec.ts`)**: Asserts route-guard middleware redirections from `/dashboard` to `/login`, invalid password error states, successful login redirection, and session cookie persistence.
*   **Core Dashboard (`dashboard.spec.ts`)**: Covers tab switching, manual expense logging, editing, and deleting via UI modals. Fully tests the **bulk selection checkbox mode** and bulk deleting.
*   **AI Chat Integration (`chat.spec.ts`)**:
    *   Verifies the animated `AnyenOrb` is present and floating on the landing page.
    *   Tests clicking the FAB, opening the assistant, typing natural language (e.g. *"Matcha Tea 6.50"*), verifying the instant loading state, receiving the AI confirmation, and observing the list automatically update.

### C. Zero-Cost, Fast E2E Mocking (BFF Interceptor)
To keep E2E runs fast, deterministic, and completely free, our E2E tests intercept Next.js BFF route handlers:
*   **BFF Intercept**: The E2E suite mocks the secure `/api/chat` route via Playwright's `page.route()` API.
*   **Deterministic Mocking**: Instead of making real, slow, and expensive network requests to the external Groq LLM API, the test intercepts the call and immediately returns a structured mock reply and a seeded expense object.
*   This allows us to test the full React state lifecycle and database insertion layer instantly without requiring live Groq API keys or incurring costs.
