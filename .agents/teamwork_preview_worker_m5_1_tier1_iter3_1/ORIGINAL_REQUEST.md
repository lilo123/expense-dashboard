## 2026-07-04T08:19:11Z

You are the Worker (Iteration 3) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_tier1_iter3_1`.
Your identity/role is `teamwork_preview_worker`.

Load the Jetski skill at:
  `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, `.agents/ORIGINAL_REQUEST.md`, and the Explorer's handoff report at `.agents/teamwork_preview_explorer_m5_1_tier1_iter3_1/handoff.md`.

### Milestone Description & Explorer Findings
The previous iteration failed due to Supabase startup failures (`Starting database from backup...`, `supabase_db_expense-dashboard container is not running: removing`, `supabase start is already running`).
Explorer 1 has provided the exact, bulletproof code replacements for `setup()` in `e2e/run_e2e.ts` to eliminate all container conflicts, residual lock/pid files, and corrupted backup restorations.

### Tasks
1. Implement the exact code replacements in `e2e/run_e2e.ts` recommended by Explorer 1 in its handoff report (lines 30-38):
   ```typescript
     // START LOCAL SUPABASE & SEED DB
     console.log('Starting local Supabase Docker containers...');
     try { execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('fuser -k 54321/tcp 54322/tcp 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('mv supabase/migrations_bak supabase/migrations 2>/dev/null || true && mv supabase/seed.sql.bak supabase/seed.sql 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('docker rm -f $(docker ps -aq) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('rm -rf supabase/.temp ~/.supabase /tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('npx supabase start --ignore-health-check 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('docker start supabase_db_expense-dashboard supabase_rest_expense-dashboard supabase_auth_expense-dashboard supabase_kong_expense-dashboard $(docker ps -aq --filter name=supabase 2>/dev/null) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   ```
2. Ensure `pkill -9 -f next` remains absent (retaining `fuser -k 3000/tcp`) to prevent process suicide.
3. Ensure `npx playwright test` remains unwrapped by `try...catch` to allow genuine error propagation.
4. Execute the prerequisite process cleanup command to terminate all orphaned test runners and fully prune all containers:
   `fuser -k 3000/tcp 54321/tcp 54322/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true`
5. Run the full test runner command specified in `TEST_READY.md`:
   `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
6. If any tests fail, investigate and implement the necessary fixes in the codebase, then re-verify until all tests pass successfully with exit code 0.
7. Document your commands, changes, and passing test results in `handoff.md` in your working directory, and send a completion message to me.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
