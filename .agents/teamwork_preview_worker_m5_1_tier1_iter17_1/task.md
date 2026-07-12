# Task: Worker 1 M5.1 Tier 1 E2E Test Fix Implementation (Iteration 17)
Implement the exact fix strategy formulated by the Explorers in Iteration 17 to resolve lingering supabase-go background daemon race conditions (`Conflict. The container name ... is already in use`, `supabase start is already running`, `removal of container ... is already in progress`) and Docker daemon asynchronous prune collisions (`a prune operation is already running`) in `e2e/run_e2e.ts`.
1. Update `e2e/run_e2e.ts` to replace all six teardown blocks (`setup()` initial cleanup lines 37-44, `setup()` loop start lines 51-58, `setup()` loop catch block lines 87-94, `run()` health check recovery lines 152-159, `run()` pre-seed health check recovery lines 211-218, `run()` post-build health check recovery lines 273-280) with the following exact robust teardown sequence:
   ```typescript
   try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('pkill -9 -f supabase-go 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('while docker ps -aq | grep -q .; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
   try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
   ```
2. Ensure `e2e/run_e2e.ts` retains `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering, `fuser -k 3000/tcp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, port `25432` migration, and `async setup()`.
3. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
4. Ensure `fuser -k 54321/tcp` remains removed from `e2e/run_e2e.ts` to prevent socket inheritance process suicides.
5. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
6. Ensure `e2e/seed.ts` retains `schemaRetries = 50` and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop.
7. Ensure `e2e/init_db.ts` retains the 10s post-notification delay (`setTimeout(resolve, 10000)`).
8. Ensure `next.config.js` retains `outputFileTracing: false`.
9. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.
10. Execute the prerequisite process cleanup command to terminate all orphaned test runners, fully prune all containers, and purge all volumes:
    `fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true`
11. Verify TypeScript compilation and type safety:
    `npx tsc --noEmit`
12. Verify Unit Tests for Planner Business Logic Engines:
    `npm run test __tests__/planner`
13. Run the full test runner command specified in `TEST_READY.md`:
    `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
14. Document your implementation and verification results in `handoff.md` in your working directory, and send a completion message to me.
