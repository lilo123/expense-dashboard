# Handoff Report — Milestone 5.2 (Tier 2 E2E Test Pass - Boundary & Corner Cases), Iteration 1, Reviewer 2

## Review Summary
**Verdict**: VETO (REQUEST_CHANGES)

## 1. Observation
- We executed the full verification test suite command: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm run test __tests__/planner/planner.test.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && exec npx tsx e2e/run_e2e.ts`.
- The unit tests (`planner.test.ts`), `verify_accumulation.ts`, and `verify_monte_carlo.ts` all executed successfully and passed with exit code 0.
- During the Playwright E2E test execution in `e2e/run_e2e.ts`, immediately after Test 9 (`should render correct current month in extreme western timezone (Hawaii)`), the Next.js server exited unexpectedly with `code null`.
- The `nextServer.on('exit')` event handler in `e2e/run_e2e.ts` caught the exit and executed `fuser -k 3000/tcp` before respawning the Next.js server.
- Following the respawn, Test 10 (`should navigate to /budget, expand accordions, open selection modal, and propagate budget forward`) and every subsequent Playwright test (Tests 10 through 55) failed due to timeouts (~15.3s), causing the E2E test suite to fail with exit code 1.
- Inspection of `e2e/suppress_crashes.js` reveals it is specifically designed to suppress `process.exit`, `process.kill`, `SIGTERM`, and `SIGINT` to "prevent Next.js server from terminating during E2E tests."
- Inspection of `e2e/run_e2e.ts` reveals that when `nextServer` is spawned (`next start`), `NODE_OPTIONS` is set to `--unhandled-rejections=warn --max-old-space-size=4096`, omitting `--require ./e2e/suppress_crashes.js`.

## 2. Logic Chain
- Because `--require ./e2e/suppress_crashes.js` is omitted from `NODE_OPTIONS` when spawning `nextServer` in `e2e/run_e2e.ts`, the Next.js server is unprotected against fatal signals/exits triggered during complex E2E test interactions (such as timezone boundary shifts in Test 9), leading to its unexpected termination (`code null`).
- When `nextServer.on('exit')` triggers, it executes `fuser -k 3000/tcp`. `fuser -k 3000/tcp` terminates ALL processes with open file descriptors/sockets on port 3000. This includes not just the listening server but also the active Playwright Chromium client processes that maintain established TCP connections to port 3000.
- Terminating the Playwright browser processes via `fuser` severs Playwright's internal IPC/browser context, leaving the Playwright test runner in a permanently broken state where all subsequent test executions (Tests 10 to 55) hang and fail due to timeouts.
- Therefore, Worker 1's implementation fails the verification test pass. To fix this, `e2e/run_e2e.ts` must include `--require ./e2e/suppress_crashes.js` in `NODE_OPTIONS` when spawning `nextServer`, and the respawn cleanup logic should be refined to avoid killing client browser processes with `fuser -k 3000/tcp` (e.g., by targeting the specific server PID or using `fuser -k -n tcp 3000` only when ensuring the port is free before initial startup).

## 3. Caveats
- No caveats. The failure was directly observed in the task execution logs (`task-16.log`), and the root cause was verified by cross-referencing `e2e/run_e2e.ts`, `e2e/suppress_crashes.js`, and `playwright.config.ts`.

## 4. Conclusion
- **Verdict**: VETO (REQUEST_CHANGES).
- Worker 1's changes fail to achieve a clean E2E test pass (exit code 1). The Next.js server crashes during Test 9 due to the omission of `--require ./e2e/suppress_crashes.js` in `NODE_OPTIONS`, and the subsequent `fuser -k 3000/tcp` cleanup corrupts Playwright's browser processes, causing all remaining tests to timeout.

## 5. Verification Method
- To independently verify the failure, execute the following command from the project root (`/usr/local/google/home/duynguyenn/expense-dashboard`):
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm run test __tests__/planner/planner.test.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && exec npx tsx e2e/run_e2e.ts
  ```
- Inspect the output or task log to observe `Next.js server exited unexpectedly with code null. Cleaning up port 3000 and respawning...` after Test 9, followed by timeout failures for Tests 10 through 55.
