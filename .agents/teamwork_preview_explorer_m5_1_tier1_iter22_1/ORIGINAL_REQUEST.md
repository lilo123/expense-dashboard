## 2026-07-07T02:11:06Z
You are Explorer 1 (Iteration 22) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter22_1`.
Your identity/role is `teamwork_preview_explorer`.

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, `.agents/ORIGINAL_REQUEST.md`, `task.md`, and Reviewer 2's handoff report at `.agents/teamwork_preview_reviewer_m5_1_tier1_iter21_2/handoff.md`.

### Failure Context & Reviewer 2 Findings
Reviewer 2 (`ba741358-f982-459b-976d-2e412aa489cf`) executed the full verification suite (`task-32`) and discovered that `npx tsx e2e/run_e2e.ts` fails with 13 failing Playwright tests (exit code 1).
Reviewer 2 identified two primary root causes in its Challenge Summary:

1. **Supabase Realtime / WebSocket 503 Service Unavailable**:
   - During Playwright test execution, the browser console logs `WebSocket connection to 'ws://127.0.0.1:54321/realtime/v1/websocket... failed: Error during WebSocket handshake: Unexpected response code: 503`. This indicates the Realtime service is crashing or rejecting connections, causing dynamic UI updates to fail. Realtime UI updates and category/expense synchronization fail, causing E2E tests to receive 0 items and timeout (`currency.spec.ts`, `dashboard.spec.ts`, `onboarding_safeguards.spec.ts`, `recent_filters.spec.ts`).
   - Mitigation suggested by Reviewer 2: Add explicit health checks and readiness verification for the Supabase Realtime service (`http://127.0.0.1:54321/realtime/v1/health` or similar endpoint) before launching Playwright tests in `e2e/run_e2e.ts`.

2. **Cumulative Layout Shift (CLS) in Budget Streaming View**:
   - The retirement planner UI expansion increased the loaded content box height, resulting in a height difference of 320.5px compared to the skeleton box. This causes a massive layout shift when streaming completes, violating the zero CLS requirement and causing `budget_streaming_suspense.spec.ts` to fail.
   - Mitigation suggested by Reviewer 2: Update the loading skeleton height in `src/app/budget/` (e.g. `src/app/budget/loading.tsx` or `src/app/budget/page.tsx` or related components) to match the expanded retirement planner UI height.

### Task Description
1. Inspect `e2e/run_e2e.ts` to understand how Supabase health checks are currently performed. Determine the exact location and logic needed to add an explicit health check and readiness verification for the Supabase Realtime service (`http://127.0.0.1:54321/realtime/v1/health` or similar) before launching Playwright tests (e.g. in `setup()` or `run()`).
2. Inspect `e2e/budget_streaming_suspense.spec.ts` to understand how the CLS height difference is measured and what the expected tolerance is (`<= 100px`).
3. Inspect `src/app/budget/loading.tsx`, `src/app/budget/page.tsx`, and any related loading skeleton components in `src/app/budget/` or `src/components/` to locate the skeleton box height. Determine the exact CSS height adjustment needed to eliminate the 320.5px height difference.
4. Inspect `supabase/config.toml` to see if there are any Realtime configuration settings (e.g., `[realtime] enabled = true`, `max_client_conn`, rate limits, etc.) that need to be adjusted to prevent 503 errors during sequential Playwright test execution.
5. Ensure all existing architectural guardrails in `e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/init_db.ts`, `next.config.js`, `src/lib/planner/*.ts`, and Supabase migrations are strictly preserved.
6. Recommend a concrete, verified fix strategy with exact file paths, target content chunks, and drop-in replacement chunks in your `handoff.md`. Do NOT implement the changes yourself.

When complete, write `handoff.md` in your working directory and send a completion message to me.
