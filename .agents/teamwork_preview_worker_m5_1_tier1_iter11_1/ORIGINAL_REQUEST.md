## 2026-07-06T19:18:11Z

You are the Worker (Iteration 11) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_tier1_iter11_1`.
Your identity/role is `teamwork_preview_worker`.

Load the Jetski skill at:
  `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, `.agents/ORIGINAL_REQUEST.md`, and the Explorer's handoff report at `.agents/teamwork_preview_explorer_m5_1_tier1_iter11_2/handoff.md`.

### Milestone Description & Explorer Findings
In Iteration 10, the Forensic Auditor confirmed that all domain logic engines (`types.ts`, `drawdownEngine.ts`, `simulator.ts`, `config.toml`), Zod schemas, Supabase rate limits, unit tests, and E2E tests are genuinely and correctly implemented with zero cheating or integrity violations (Verdict: CLEAN).
However, the Reviewers and Challengers uncovered four critical build environment and process lifecycle defects: `npm run build` failing with `ENOENT: no such file or directory, open '.next/server/proxy.js.nft.json'` due to `node-file-trace` and `NODE_OPTIONS` `tsx` wrapper environment poisoning, lingering parent `run_e2e.ts` processes respawning `next-server` during `npm run build`, and `suppress_crashes.js` creating zombie servers that hold port 3000 without serving traffic.
Explorer 2 has provided the exact, bulletproof code replacements across `next.config.js` and `e2e/run_e2e.ts`.

### Tasks
1. Implement the exact code replacements in `next.config.js` recommended by Explorer 2 in its handoff report:
   - Add `outputFileTracing: false` to `nextConfig`.
2. Implement the exact code replacements in `e2e/run_e2e.ts` recommended by Explorer 2 in its handoff report:
   - Update `execSync('npm run build', ...)` to sanitize `NODE_OPTIONS: ''` in the environment options (`env: { ...process.env, NODE_OPTIONS: '' }`).
   - Add the lingering parent process cleanup block (`pgrep -f run_e2e` and `kill -9` filtering out `process.pid` and `process.ppid`) before `fuser -k 3000/tcp` and `npm run build`.
   - Remove `suppress_crashes.js` from `NODE_OPTIONS` in `startNextServer()`.
3. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
4. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
5. Ensure `e2e/run_e2e.ts` retains `rm -rf supabase/.temp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, and port `25432` migration.
6. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.
7. Execute the prerequisite process cleanup command to terminate all orphaned test runners and fully prune all containers:
    `fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true`
8. Verify TypeScript compilation and type safety:
    `npx tsc --noEmit`
9. Verify Unit Tests for Planner Business Logic Engines:
    `npm run test __tests__/planner`
10. Run the full test runner command specified in `TEST_READY.md`:
    `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
11. If any tests fail, investigate and implement the necessary fixes in the codebase, then re-verify until all tests pass successfully with exit code 0.
12. Document your commands, changes, and passing test results in `handoff.md` in your working directory, and send a completion message to me.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
