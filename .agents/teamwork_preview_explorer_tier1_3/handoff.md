# Handoff Report: Playwright Test Runner & Infra Exploration

## 1. Observation
- **Playwright Configuration (`playwright.config.ts`)**:
  - Sets `testDir: './e2e'` and `baseURL: 'http://localhost:3000'`.
  - Configures `webServer` to execute `npm run build && npm run start` on port 3000 with `timeout: 240000` (4 minutes).
  - Employs conditional cross-browser execution: 5 projects in CI (`chromium`, `firefox`, `webkit`, `mobile-chrome`, `mobile-safari`), and only `chromium` locally.
- **E2E Runner Infrastructure (`e2e/run_e2e.ts`)**:
  - Custom execution script that manages environment variables safely: backs up `.env.local` to `.env.local.bak`, copies `.env.test` to `.env.local`, executes `npx playwright test --workers=1`, and restores `.env.local` upon completion.
- **Testing Guidelines & Best Practices (`TESTING.md`)**:
  - Explains the 4-Tier Productivity Workflow (Tier 1: Jest Watch, Tier 2: Targeted E2E, Tier 3: Pre-push Smoke, Tier 4: Cloud CI/CD).
  - Section 1.C defines local Supabase Docker setup (`npx supabase start`, `npx tsx e2e/init_db.ts`, `npx tsx --env-file=.env.test e2e/seed.ts`, `npx supabase stop`).
  - Section 2 defines Brand & Empathy Assertions ("No Game Overs"): zero negative financial jargon, empathetic error handling, and strict currency precision.
  - Section 3 defines Design System & Aesthetic Assertions: Zen palette, glassmorphism (`bg-white/40 backdrop-blur-md border border-white/20`), fluid rounded corners, and levitating AI orb without WebGL.
  - Section 5 defines Architectural Defenses: Hydration Locks (`isMounted`), Mobile Viewport Number Compression, Local Database Emulator CSP Whitelists (`http://localhost:54321`), Same-Site Domain Resolution.
  - Section 6.C explicitly details the Financial Retirement Planner Testing Specifications:
    * **Dual Entry CUJ**: Simulates landing on `src/app/page.tsx`, adjusting the `QuickCheckWidget.tsx`, clicking "Save & Unlock", logging in, verifying URL hydration in the Detailed Builder (`/plans/new`), tab navigation, and saving to Supabase.
    * **Screen Reader Parity**: Asserts that `WealthFanChart.tsx` renders an adjacent `div` with `className="sr-only"` enclosing an HTML table that dynamically outputs the 10th, 50th, and 90th percentile values at 5-year intervals.
    * **Automated Accessibility (`@axe-core/playwright`)**: Verifies zero WCAG 2.1 AA/AAA violations across all 7 domain tabs and dashboard views.
- **Database Seeding & Profiles Tier (`e2e/seed.ts` and `supabase/migrations/20260526020000_profile_tier.sql`)**:
  - `e2e/seed.ts` initializes `test-user@example.com` (`password123`) and sets `onboarding_status: 'completed'` via the Supabase service role key.
  - `20260526020000_profile_tier.sql` defines `profiles.tier` as `VARCHAR(20) DEFAULT 'standard' CHECK (tier IN ('standard', 'premium'))`, guarded by `prevent_tier_modification_trig` which blocks client-side tier spoofing unless modified via `service_role` or an `admin` user.
- **Package Dependencies (`package.json`)**:
  - Lists `@playwright/test` (`^1.59.1`) but does NOT currently include `@axe-core/playwright` in `devDependencies`.

## 2. Logic Chain
- **Requirement for Dual Entry & Hydration Verification**:
  - The E2E test must begin unauthenticated on the public landing page (`/`), interact with the Quick Check widget, and verify that URL search params are correctly formed when transitioning to `/auth?redirect=/plans/new...`.
  - Following authentication, the test must verify that the Zustand store successfully hydrates from the URL parameters without Next.js hydration mismatch errors (leveraging the `isMounted` hydration lock pattern).
- **Requirement for Premium Lock & Premium Range Selector Verification**:
  - Since `test-user@example.com` defaults to `tier: 'standard'`, navigating to `SimulationTab.tsx` with this user must assert the presence of the An-yen frosted glass Premium Lock card (`bg-white/40 backdrop-blur-md border border-white/20`) and verify that the 50-year and 125-year options are locked.
  - To test the Premium Tier Historical Range Selector unlocking and execution, the test suite requires a premium user. Since client-side updates to `profiles.tier` are blocked by `prevent_tier_modification_trig`, `e2e/seed.ts` must be extended to create a second test user `premium-user@example.com` with `tier: 'premium'` using the `SUPABASE_SERVICE_ROLE_KEY`, OR `e2e/planner_tier1_feature.spec.ts` must instantiate a service-role Supabase client to toggle the tier dynamically. Creating `premium-user@example.com` in `e2e/seed.ts` is the cleanest, most hermetic approach.
- **Requirement for Accessibility & Screen Reader Parity**:
  - The test must integrate `@axe-core/playwright` to run automated accessibility audits across all 7 tabs, asserting zero WCAG 2.1 AA/AAA violations.
  - It must explicitly inspect the DOM for `div.sr-only` adjacent to `WealthFanChart.tsx` to verify the HTML table containing 10th, 50th, and 90th percentile values at 5-year intervals.
- **Requirement for Brand Compliance**:
  - Every view must be asserted to ensure zero occurrences of forbidden terms ("Debt", "Penalty", "Failing", "Over-limit", "Deficit") or raw database error logs ("Game Over"), adhering to the "No Game Overs" rule.

## 3. Caveats
- **Local Supabase & WebServer Execution**: The E2E tests require local Next.js build/start and local Supabase Docker containers running (`http://localhost:54321`). The explorer agent performed static analysis and read-only exploration of the configuration files; actual runtime execution depends on the host environment successfully booting these services.
- **Dependency on `@axe-core/playwright`**: `package.json` does not currently list `@axe-core/playwright` in `devDependencies`. The implementer must install `@axe-core/playwright` (`npm install --save-dev @axe-core/playwright`) prior to running the E2E tests.

## 4. Conclusion
- The Playwright E2E infrastructure is robustly configured via `e2e/run_e2e.ts` and `playwright.config.ts`, ensuring safe local environment handling and CI cross-browser compatibility.
- To achieve 100% test pass rate for `e2e/planner_tier1_feature.spec.ts`, the implementation strategy must execute the following exact steps:
  1. **Update `package.json`**: Install `@axe-core/playwright` as a dev dependency.
  2. **Update `e2e/seed.ts`**: Seed a dedicated premium test user (`premium-user@example.com`, `password123`) and explicitly update their profile to `tier: 'premium'` and `onboarding_status: 'completed'` using the Supabase service role client.
  3. **Implement `e2e/planner_tier1_feature.spec.ts`**:
     - **Test Case 1 (Dual Entry & Standard Tier Lock)**: Navigate to `/`, configure Quick Check widget, click "Save & Unlock", log in as `test-user@example.com`, verify redirection to `/plans/new` with search params, verify URL hydration in the Detailed Builder, navigate through the 7 tabs, assert brand compliance, execute `@axe-core/playwright` audit, navigate to Simulation tab, assert presence of An-yen frosted glass Premium Lock card, and verify 50-yr/125-yr options are disabled.
     - **Test Case 2 (Premium Tier Range Selector & Fan Chart SR Parity)**: Log in directly as `premium-user@example.com`, navigate to `/plans/new`, go to Simulation tab, verify Premium Lock card is absent, select 50-yr and 125-yr historical ranges, verify simulation execution, assert the presence of `div.sr-only` containing the percentile table (10th, 50th, 90th at 5-year intervals), execute `@axe-core/playwright` audit, and save plan to Supabase.

## 5. Verification Method
- **Dependency Verification**: Check `package.json` to ensure `@axe-core/playwright` is present.
- **Seeding Verification**: Run `npx tsx --env-file=.env.test e2e/seed.ts` to confirm successful creation of both `test-user@example.com` and `premium-user@example.com`.
- **E2E Test Execution**: Run `npx tsx e2e/run_e2e.ts` or `npx playwright test e2e/planner_tier1_feature.spec.ts --project=chromium` to verify 100% passing tests.
- **Git Cleanliness**: Run `git status` to ensure all changes remain strictly local with zero commits pushed to remote repositories.
