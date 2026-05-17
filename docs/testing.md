# An-yen Expense Dashboard - Testing Architecture & E2E Guide

This document details the automated testing strategy, multi-browser verification boundaries, and developer productivity workflows for the An-yen Expense Dashboard.

---

## 🚀 1. The 4-Tier Enterprise Productivity Workflow

To maintain sub-second developer feedback loops while ensuring 100% cross-browser compatibility, our testing ecosystem is decoupled into four distinct execution tiers:

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

---

## ⚡ 2. Running Tests Locally

### Unit & Component Testing (Jest)
Executes instantly without spinning up Next.js dev servers or database emulators.
```bash
# Run all unit test suites
npm run test

# Run in watch mode during active development
npm run test:watch
```

### Local E2E Fast-Feedback Mode (Playwright)
Executes optimized E2E tests strictly on **Desktop Chromium** in ~10 seconds using our local credentials wrapper:
```bash
npx tsx e2e/run_e2e.ts
```

---

## 🌐 3. Multi-Browser CI Verification
When running under Continuous Integration (`process.env.CI`), Playwright automatically expands test execution across all 5 supported browser emulations:
1. 🖥️ **Desktop Chromium**
2. 🖥️ **Desktop Firefox**
3. 🖥️ **Desktop Webkit** (Safari)
4. 📱 **Mobile Chrome** (Pixel 5)
5. 📱 **Mobile Safari** (iPhone 12)

To emulate the full CI compatibility run locally:
```bash
CI=true npx tsx e2e/run_e2e.ts
```

---

## 🛡️ 4. Architectural Defenses & Best Practices

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
