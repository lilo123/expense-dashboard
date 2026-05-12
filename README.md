# An-yen Wealth App - Internal Developer Guide

Welcome to the internal engineering repository for **An-yen**, a mindful, RPG-inspired financial tracking experience built to foster positive wealth relationships.

This private workspace is optimized for local execution, strict mathematical precision, WCAG contrast guidelines, and high E2E test coverage across desktop and mobile viewports.

---

## 🎨 1. Brand & Design System Guidelines

Our visual theme is rooted in **empowerment, tranquility, and glassmorphic depth**. We strictly reject traditional, stress-inducing financial layouts and wording.

### A. Glassmorphism Card Utility
All main visual widgets, total cards, and modals must utilize our signature frosted glass class configurations:
*   **Class Combo**: `bg-white/40 backdrop-blur-md border border-white/20 shadow-sm`
*   **Corners**: Elements must use fluid pill-shaped corners to prevent sharp angles (e.g., `rounded-full`, `rounded-3xl`, `rounded-2xl`).

### B. Custom Pastel Tailwind Palette
To maintain a calm Zen mood, only reference these brand-approved colors:
*   `bg-zen-base`: Light cream background.
*   `text-zen-charcoal`: Deep charcoal text (main text color).
*   `bg-zen-lavender`: Soft lilac highlights (e.g., buttons, accents).
*   `bg-zen-sage`: Muted green for successful selections, categories, and streaks.
*   `bg-zen-peach`: Pastel peach for delete actions, warning states, and soft dropdown hovers (`hover:bg-zen-peach/30`).

### C. The Levitating Iridescent AI Orb
*   The Mindful AI Coach Companion (`AnyenOrb.tsx`) must use fluid, morphing CSS keyframe animations (`animate-liquid-flow`).
*   **Strict Constraint**: **Never load heavy 3D engines** (like Three.js or WebGL). Visual fluidity must be kept entirely in CSS to guarantee lightning-fast performance on mobile screen sizes.

---

## ⚡ 2. Supabase Local Sandbox Quick-Start

To develop and test securely without polluting live production databases, we replicate the entire cloud Supabase stack locally using lightweight Docker containers.

### A. Start Local Sandbox
Ensure you have Docker running locally, then spin up the Supabase containers:
```bash
npx supabase start
```

### B. Compile Schemas & Reload Cache
Because of local Docker socket permissions, our migrations are compiled and verified using a direct pg connection script. This script applies the sequential DDL structures and issues a PostgREST schema cache reset instantly:
```bash
npx tsx e2e/init_db.ts
```
*Migrations applied sequentially:*
1.  `20260510000000_init.sql` (Base categories, expenses, and RLS rules).
2.  `20260510140000_phase_1_65.sql` (Dual-amount auditing columns & PL/pgSQL trigger).
3.  `20260510150000_phase_1_65_extensions.sql` (Default CAD baseline alters).
4.  `20260510170000_phase_1_7.sql` (User profiles settings DDL table & refactored dual categories trigger).
5.  `20260511000000_phase_1_8_recurring.sql` (Timezone hourly scheduling database tables & cron schedules).
6.  `20260511140000_phase_1_8_refinement.sql` (First occurrence automated triggers and visual alignment refinements).

### C. Seed CAD baseline Dataset
Wipes previous seeds, creates a fresh test user `test-user@example.com` (which automatically fires the Postgres Trigger to seed default categories), caches fixed mock exchange rates (`VND: 18500.0`), and inserts 35 realistic historical expenses:
```bash
npx tsx --env-file=.env.test e2e/seed.ts
```

---

## 🔐 3. Financial Math, Accessibility & Security Standards

### A. Float Arithmetic Rounded Safeguard
*   Javascript floating-point arithmetic is prone to tail drifts (e.g., `0.1 + 0.2 = 0.30000000000000004`).
*   **The Rule**: All currency exchange calculations and logging pairs must route strictly through `convertAmount` inside `src/lib/utils.ts` which mathematically clamps results to exactly **2 decimal places** on every conversion step.

### B. Shortened Displays ('K, 'M)
*   For large-denomination currencies (like Vietnamese Dong `VND`), the UI dynamically compresses text strings (e.g., `₫100K` instead of `100,000 ₫`, and `₫1.5M` instead of `1,500,000 ₫`) to prevent numbers from wrapping or overlapping on mobile.
*   **Strict Chart Precision**: Visual charts (tooltips and datalabels) for standard currencies (like `CAD`, `USD`) must display exactly **2 decimal K precision (`0.00K`)** to prevent small transactions from rounding down to `0K` (e.g., `C$15.50` as `C$0.02K` and `C$0` as `C$0.00K`).

### C. Accessible E2E Selectors
*   To maintain high accessibility (a11y) and ensure automated E2E selectors are deterministic:
    *   All select dropdowns and modals must declare an explicit, descriptive `aria-label` (e.g., `aria-label="Category"` or `aria-label="Currency"`).

### D. Secure Password Re-Authentication (Anti-Hijacking)
*   To prevent unauthorized password modifications in logged-in sessions, the `updatePassword` Server Action enforces a **strict credentials re-authentication check**.
*   Before allowing the save, it runs a secure sign-in check against Supabase Auth:
    `supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })`
*   If the credentials check fails, Postgres immediately rejects the update, keeping the user's credentials completely safe.

### E. Read-Only Edit Pencil Toggles (Accident Prevention)
*   To prevent users from accidentally altering sensitive account configurations:
    *   All form fields inside Settings are **read-only (`disabled`) by default**.
    *   They can only be unlocked by clicking the **Edit Pencil Icon button** next to the section header.
    *   Clicking **Cancel** discards active input states, reverts fields to their cached database settings state, and locks the inputs back to disabled.

---

## 🧪 4. Test Execution Playbook

We run a strict two-tier test suite.

### A. Unit & Component Tests (Jest)
Runs completely offline, verifying Zustand store state transitions, optimistic UI updates in Chat, currency conversion precision, and secure Server Action re-authentications:
```bash
npm run test
```

### B. E2E Integration Tests (Playwright - Desktop & Mobile viewports)
Executes your full application stack simultaneously across **Desktop Chromium, Firefox, Safari (WebKit), Emulated Pixel 5 (Mobile Chrome), and Emulated iPhone 12 (Mobile Safari)**:
```bash
# Run all viewports E2E tests securely (includes auto env-backups and auto-restores)
npx tsx e2e/run_e2e.ts

# Open E2E HTML logs report to inspect screen recordings
npx playwright show-report
```

---

## 🏗️ 5. React Server Component (RSC) Context Boundaries

Next.js Server Component route files (like `src/app/(dashboard)/settings/page.tsx`) execute on the server and **cannot import client-specific providers (like the Zustand StoreProvider Context) directly** due to RSC rendering boundaries.

### The Client Boundary Wrapper Pattern
To keep route pages secure, lightweight, and 100% Server-Side Rendered:
1.  Create a client boundary file marked with `"use client"` (e.g. **`src/components/SettingsWrapper.tsx`**).
2.  Import `StoreProvider` and wrap your interactive settings forms cleanly inside it on the client.
3.  Have your Server Route page import and render `<SettingsWrapper userEmail={user.email} />` safely!
This cleanly isolates all client contexts and prevents Next.js build and compilation crashes.

---

## 📝 6. VCS Commit Conventions

To keep your private code reviews in Critique structured and clean, always write descriptive commit summaries and append the following tagging metadata at the **very bottom** of your commit message:

```text
TAG=agy
CONV=<conversation_id>
```
*(Example: `git commit -m "feat: support CAD default base baseline\n\nTAG=agy\nCONV=ef767037"`)*
