## 2026-07-06T20:39:35Z

You are the Worker (Iteration 14) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_tier1_iter14_1`.
Your identity/role is `teamwork_preview_worker`.

Load the Jetski skill at:
  `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, `.agents/ORIGINAL_REQUEST.md`, and the Explorer's handoff report at `.agents/teamwork_preview_explorer_m5_1_tier1_iter14_3/handoff.md`.

### Milestone Description & Explorer Findings
In Iteration 13, the Forensic Auditor, Reviewer 1, Challenger 1, and Challenger 2 uncovered three critical E2E test runner flaws in `e2e/run_e2e.ts`:
1. `npx supabase start --ignore-health-check` exits with 0 when `supabase local development setup is running` but API gateway containers (Kong, Auth, Rest) are stopped, and the initial health check lacks restart recovery (`http://127.0.0.1:54321 is unreachable.`).
2. When `http://127.0.0.1:54321` is unresponsive during health checks, the retry mechanism attempts `rm -rf supabase/.temp` and `npx supabase start` without first stopping containers (`npx supabase stop --no-backup`) or cleaning volumes (`docker volume rm -f`), triggering a fatal `schema_migrations_pkey` duplicate key constraint violation and container crash (`connect ECONNREFUSED 127.0.0.1:54321`).
3. When executed within a composite bash command string containing `run_e2e`, `pgrep -f run_e2e` matches the grandparent `bash` process itself. Because the script only filters out `currentPid` (`node`) and `parentPid` (`npx`), `kill -9` forcibly terminates the grandparent `bash` process mid-execution, abruptly halting the test runner chain prior to `npm run build`.

Explorer 3 has provided the exact, bulletproof code replacements for `e2e/run_e2e.ts`.

### Tasks
1. Implement the exact code replacements in `e2e/run_e2e.ts` recommended by Explorer 3 in its handoff report:
   - Modify all three health check loops (initial health check lines 107-130, pre-seed health check lines 156-181, post-build health check lines 207-232) to include the clean restart recovery block when `retries === 15 || retries === 10 || retries === 5`:
     ```typescript
        if (retries === 15 || retries === 10 || retries === 5) {
          console.log('Supabase seems unresponsive. Attempting to cleanly restart Supabase...');
          try {
            execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' });
            execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' });
            execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' });
            execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' });
            execSync('pkill -f supabase 2>/dev/null || true', { stdio: 'inherit' });
            execSync('fuser -k 54321/tcp 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' });
            execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' });
            execSync('sleep 15', { stdio: 'inherit' });
            execSync('docker network create supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' });
            execSync('npx supabase start --ignore-health-check', { stdio: 'inherit' });
          } catch(err){}
        }
     ```
   - Modify the lingering process cleanup block (lines 189-201) to use precise `pgrep` matching (`node.*run_e2e`, `tsx.*run_e2e`) and parent/grandparent PID filtering:
     ```typescript
    console.log('Building fresh Next.js production bundle...');
    try {
      const currentPid = process.pid;
      const parentPid = process.ppid;
      let grandParentPid = -1;
      try { grandParentPid = Number(execSync(`ps -o ppid= -p ${parentPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim()); } catch(e){}
      let greatGrandParentPid = -1;
      try { greatGrandParentPid = Number(execSync(`ps -o ppid= -p ${grandParentPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim()); } catch(e){}
      
      const nodePids = execSync('pgrep -f "node.*run_e2e" 2>/dev/null || true', { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
      const tsxPids = execSync('pgrep -f "tsx.*run_e2e" 2>/dev/null || true', { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
      const allPids = Array.from(new Set([...nodePids, ...tsxPids]));
      
      const pids = allPids.filter(pid => pid !== currentPid && pid !== parentPid && pid !== grandParentPid && pid !== greatGrandParentPid);
      if (pids.length > 0) {
        console.log(`Killing lingering run_e2e processes: ${pids.join(' ')}`);
        execSync(`kill -9 ${pids.join(' ')} 2>/dev/null || true`, { stdio: 'inherit' });
      }
    } catch (e) {}
     ```
2. Ensure `e2e/run_e2e.ts` retains `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, `docker volume ls -q | xargs -r docker volume rm -f`, `fuser -k 3000/tcp`, `rm -rf supabase/.temp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, and port `25432` migration.
3. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
4. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
5. Ensure `e2e/seed.ts` retains `schemaRetries = 50` and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop.
6. Ensure `e2e/init_db.ts` retains the 10s post-notification delay (`setTimeout(resolve, 10000)`).
7. Ensure `next.config.js` retains `outputFileTracing: false`.
8. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.
9. Execute the prerequisite process cleanup command to terminate all orphaned test runners, fully prune all containers, and purge all volumes:
    `fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true`
10. Verify TypeScript compilation and type safety:
    `npx tsc --noEmit`
11. Verify Unit Tests for Planner Business Logic Engines:
    `npm run test __tests__/planner`
12. Run the full test runner command specified in `TEST_READY.md`:
    `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
13. If any tests fail, investigate and implement the necessary fixes in the codebase, then re-verify until all tests pass successfully with exit code 0.
14. Document your commands, changes, and passing test results in `handoff.md` in your working directory, and send a completion message to me.
