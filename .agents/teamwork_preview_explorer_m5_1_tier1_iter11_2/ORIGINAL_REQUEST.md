## 2026-07-06T19:14:00Z

You are Explorer 2 (Iteration 11) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter11_2`.
Your identity/role is `teamwork_preview_explorer`.

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, and `.agents/ORIGINAL_REQUEST.md`.

### VERIFICATION SWARM FINDINGS & VETOES (Iteration 10)
In Iteration 10, the Forensic Auditor confirmed that all domain logic engines (`types.ts`, `drawdownEngine.ts`, `simulator.ts`, `config.toml`), Zod schemas, Supabase rate limits, unit tests, and E2E tests are genuinely and correctly implemented with zero cheating or integrity violations (Verdict: CLEAN).
However, the Reviewers and Challengers uncovered four critical build environment and process lifecycle defects that cause `npm run build` and `npx tsx e2e/run_e2e.ts` to fail during independent verification:

#### 1. Reviewer 1 (Iter 10) Findings (REQUEST_CHANGES)
`npm run build` failed during `e2e/run_e2e.ts` with `Error: ENOENT: no such file or directory, open '.../.next/server/proxy.js.nft.json'`, blocking E2E test execution.
**Mitigation**: Add `outputFileTracing: false` to `next.config.js`.

#### 2. Challenger 2 (Iter 10) Findings (FAILED)
`npx tsx e2e/run_e2e.ts` passes `NODE_OPTIONS` containing `tsx` down to `execSync('npm run build')`, which poisons `next build --webpack`'s `node-file-trace` engine and causes `ENOENT: no such file or directory, open '.next/server/proxy.js.nft.json'`. Standalone `npm run build` in a clean terminal succeeds perfectly in 18.5s.
**Mitigation**: Update `e2e/run_e2e.ts` to sanitize `NODE_OPTIONS` before calling `npm run build` (e.g., `execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '' } })`).

#### 3. Reviewer 2 (Iter 10) Findings (REQUEST_CHANGES)
Independent verification of `npx tsx e2e/run_e2e.ts` failed during `npm run build` due to a critical process lifecycle race condition where lingering parent `run_e2e.ts` processes (which are not killed by `fuser -k 3000/tcp`) immediately respawn `next-server` while `npm run build` is executing, corrupting the `.next` directory.
**Mitigation**: Implement necessary process lifecycle fixes in `e2e/run_e2e.ts` (e.g., explicitly killing lingering `run_e2e` processes before starting a new run, or ensuring `fuser -k 3000/tcp` doesn't trigger lingering parent respawns).

#### 4. Challenger 1 (Iter 10) Findings (FAILED)
During full E2E test runner execution, `npx tsx e2e/run_e2e.ts` failed with exit code 1. Empirical analysis revealed a severe architectural flaw in Worker 1's `e2e/suppress_crashes.js`. Suppressing `process.exit(1)` on fatal Next.js errors prevents the process from terminating, creating a zombie server that holds port 3000 without serving traffic (`⨯ Failed to handle request for /login`). This breaks `run_e2e.ts` respawn logic (`Error: listen EADDRINUSE: address already in use 127.0.0.1:3000`) and causes Playwright tests to fail with timeouts.
**Mitigation**: Redesign or remove `e2e/suppress_crashes.js` to eliminate the zombie server flaw.

### Objective
Your objective is to investigate `e2e/run_e2e.ts`, `next.config.js`, `e2e/suppress_crashes.js`, and the codebase, analyze the root causes of these build environment and process lifecycle failures, and recommend a concrete, bulletproof fix strategy.
1. Recommend the exact code changes to `next.config.js` to add `outputFileTracing: false` to permanently eliminate `node-file-trace` `ENOENT` errors.
2. Recommend the exact code changes to `e2e/run_e2e.ts` to sanitize `NODE_OPTIONS: ''` before calling `execSync('npm run build', ...)` to prevent `tsx` wrapper environment poisoning.
3. Recommend the exact code changes to `e2e/run_e2e.ts` to explicitly kill lingering parent `run_e2e.ts` processes (e.g., `pkill -f run_e2e` or similar, while ensuring the current process doesn't kill itself, or using a unique lock/pid mechanism) before starting `npm run build`, preventing lingering parents from respawning `next-server` during the build.
4. Recommend the exact code changes to `e2e/run_e2e.ts` to remove `suppress_crashes.js` from `NODE_OPTIONS`, allowing the Next.js server to genuinely exit on fatal errors so `nextServer.on('exit')` can respawn it cleanly without creating zombie servers.
5. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
6. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
7. Ensure `e2e/run_e2e.ts` retains `rm -rf supabase/.temp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, and port `25432` migration.
8. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.

When complete, write `handoff.md` in your working directory and send a completion message to me.
