## 2026-07-07T04:46:41Z

You are Worker 1 for Milestone 5.2 (Tier 2 E2E Test Pass - Boundary & Corner Cases), Iteration 2.
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_2_tier2_iter2_1`.

Load the Jetski skill at:
  `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

This skill provides a software engineering methodology for modifying existing code, performing refactors, and ensuring correctness.

Read the following files to understand the project and scope:
- `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_2_tier2/SCOPE.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/ORIGINAL_REQUEST.md`

## Synthesized Explorer Findings (Iteration 2)

### Consensus
- **Omission of Crash Suppression**: `e2e/run_e2e.ts` spawns `nextServer` without `--require ./e2e/suppress_crashes.js` in either `node` arguments or `NODE_OPTIONS`. Consequently, the Next.js server lacks the protections defined in `e2e/suppress_crashes.js` and terminates unexpectedly (`code null`) during Test 9 (`should render correct current month in extreme western timezone (Hawaii)`). (Sources: Explorer 1, Explorer 2, Explorer 3)
- **Destructive Port Cleanup**: When `nextServer` terminates, the `nextServer.on('exit')` event handler triggers and executes `fuser -k 3000/tcp`. `fuser -k 3000/tcp` sends `SIGKILL` to ALL processes with open sockets on port 3000, including active Playwright Chromium client processes. This forcefully terminates Playwright browser processes, corrupts Playwright's internal browser context, and causes cascading timeouts (~15.3s) for Test 10 and all subsequent tests (Tests 10 through 55), failing the E2E suite with exit code 1. (Sources: Explorer 1, Explorer 2, Explorer 3)

### Resolved Conflicts
- None. All Explorers agree on the exact same root causes and provide fully compatible, robust fix strategies.

### Dissenting Views
- None.

### Gaps
- None.

## Your Task
1. **Inject `--require ./e2e/suppress_crashes.js`**: Modify `e2e/run_e2e.ts` (lines 408-417) to include `--require ./e2e/suppress_crashes.js` in both the `node` spawn arguments and the `NODE_OPTIONS` environment variable when spawning `nextServer`.
2. **Refine Port Cleanup Logic**: Modify `nextServer.on('exit')` in `e2e/run_e2e.ts` (line 423) to replace `fuser -k 3000/tcp` with targeted server PID cleanup (`kill -9 ${nextServer.pid}`, `pkill -9 -P ${nextServer.pid}`, `pkill -9 -f "next.*start"`, and/or `lsof -ti:3000 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true`) to ensure only the Next.js server process tree is terminated, leaving Playwright Chromium client processes untouched.
3. **Verify**: Execute `npm run test __tests__/planner/planner.test.ts` and the official E2E test runner command defined in `TEST_READY.md` (`export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && exec npx tsx e2e/run_e2e.ts`) to verify 100% passing tests with exit code 0.
4. **Handoff**: Produce a structured handoff report (`handoff.md`) in your working directory documenting your changes, verification commands, and test results.
5. **Report**: Send a completion message to your parent with the summary of your changes and the path to your `handoff.md`.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
