# Initial Prompt: Worker for M5.4

You are the Worker (`teamwork_preview_worker`) for Milestone 5.4 (M5.4: Tier 4 E2E Test Pass - Real-World Application Scenarios) for the Next.js retirement calculator expansion at `/usr/local/google/home/duynguyenn/expense-dashboard`.
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_4_1`.
Your identity is `teamwork_preview_worker_m5_1_4_1`.

## Domain Skill
Load and follow the domain skill at:
`/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

## Milestone Description & Explorer Findings
Your goal is to ensure 100% pass rate for Milestone 5.4 (Tier 4 E2E Test Pass - Real-World Application Scenarios) across the full multi-browser matrix.
Three Explorers investigated the E2E test runner and Tier 4 test cases. While Explorers 2 and 3 observed that the test runner currently passes 63/63 tests on Chromium, Explorer 1 identified that `CI: '1'` is missing from `e2e/run_e2e.ts`, which bypasses the multi-browser matrix (`firefox`, `webkit`, `mobile-chrome`, `mobile-safari`). Explorer 1 also identified two latent issues in `BudgetPlanner.tsx` and `loading.tsx` that must be fixed to ensure the accessibility and CLS tests pass across all viewports and browsers.

### Concrete Fix Strategy to Implement:
1. **Enable Multi-Browser Matrix**: In `e2e/run_e2e.ts` (around line 532), add `CI: '1'` to the `env` object passed to `child_process.spawn`:
   ```typescript
   // Before
   env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=256', PWDEBUG: '0', PLAYWRIGHT_CHROMIUM_USE_HERMETIC: '1' }
   // After
   env: { ...process.env, CI: '1', NODE_OPTIONS: '--max-old-space-size=256', PWDEBUG: '0', PLAYWRIGHT_CHROMIUM_USE_HERMETIC: '1' }
   ```

2. **Fix Accessibility Scroll Padding**: In `src/components/BudgetPlanner.tsx` (around line 194), add `overflow-y-auto max-h-screen` to the root container so `scroll-pt-[120px]` is correctly respected by the browser:
   ```tsx
   // Before
   <div data-testid="budget-planner-root" className="flex flex-col gap-6 text-left animate-fade-in pb-16 scroll-pt-[120px]">
   // After
   <div data-testid="budget-planner-root" className="flex flex-col gap-6 text-left animate-fade-in pb-16 scroll-pt-[120px] overflow-y-auto max-h-screen">
   ```

3. **Align CLS Skeleton Height**: In `src/app/(dashboard)/budget/loading.tsx` (around line 65), change the skeleton array length from 7 to 16 to match the auto-seeded category count:
   ```tsx
   // Before
   {Array.from({ length: 7 }).map((_, i) => (
   // After
   {Array.from({ length: 16 }).map((_, i) => (
   ```

## Verification
After implementing the fixes, verify them by running the E2E test runner:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
node node_modules/.bin/tsx e2e/run_e2e.ts
```
Ensure all tests pass across all 5 browser projects with exit code 0.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Handoff
Write your final `handoff.md` report in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_4_1`) and send a completion message to me (your parent).
