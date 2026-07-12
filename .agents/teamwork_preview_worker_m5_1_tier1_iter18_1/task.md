# Task: Worker 1 M5.1 Tier 1 E2E Test Fix Implementation (Iteration 18)
Implement the exact fix strategy formulated by the Explorers in Iteration 18 to resolve transient HTTP 502 Bad Gateway errors (`An invalid response was received from the upstream server`), `Failed to create test user: Database error creating new user`, `supabase start is already running`, and `a prune operation is already running` in `e2e/run_e2e.ts` and `e2e/seed.ts`.
1. Update `e2e/run_e2e.ts` to replace all six teardown blocks (`setup()` initial cleanup lines 37-45, `setup()` loop start lines 52-61, `setup()` loop catch block lines 88-98, `run()` health check recovery lines 155-163, `run()` pre-seed health check recovery lines 215-223, `run()` post-build health check recovery lines 278-286) with the following exact standardized block:
   ```typescript
   try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
   try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('npx supabase status 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
   ```
2. Update `e2e/seed.ts` to replace lines 111-148 with the following robust retry loops:
   ```typescript
       const existingUser = usersData.users.find((u: any) => u.email === TARGET_EMAIL);
       if (existingUser) {
         console.log(`User already exists (ID: ${existingUser.id}). Cleaning up existing user data with robust retry loops...`);
         
         // Delete user's expenses with retry loop
         let expRetries = 10;
         while (expRetries > 0) {
           const { error: expDelError } = await supabase.from('expenses').delete().eq('user_id', existingUser.id);
           if (!expDelError) {
             console.log('Successfully cleaned expenses.');
             break;
           }
           console.warn(`Warning: failed to clean expenses (${expDelError.message}). Retrying... (${expRetries - 1} retries left)`);
           await new Promise(resolve => setTimeout(resolve, 3000));
           expRetries--;
         }
         
         // Delete user's categories with retry loop
         let catDelRetries = 10;
         while (catDelRetries > 0) {
           const { error: catDelError } = await supabase.from('categories').delete().eq('user_id', existingUser.id);
           if (!catDelError) {
             console.log('Successfully cleaned categories.');
             break;
           }
           console.warn(`Warning: failed to clean categories (${catDelError.message}). Retrying... (${catDelRetries - 1} retries left)`);
           await new Promise(resolve => setTimeout(resolve, 3000));
           catDelRetries--;
         }

         // Delete user's recurring_expenses with retry loop
         let recurDelRetries = 10;
         while (recurDelRetries > 0) {
           const { error: recurDelError } = await supabase.from('recurring_expenses').delete().eq('user_id', existingUser.id);
           if (!recurDelError) {
             console.log('Successfully cleaned recurring_expenses.');
             break;
           }
           console.warn(`Warning: failed to clean recurring_expenses (${recurDelError.message}). Retrying... (${recurDelRetries - 1} retries left)`);
           await new Promise(resolve => setTimeout(resolve, 3000));
           recurDelRetries--;
         }

         // Delete the auth user with retry loop
         let deleteRetries = 15;
         let deleteSuccess = false;
         let lastDeleteError: any = null;
         while (deleteRetries > 0 && !deleteSuccess) {
           const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id);
           if (!deleteError) {
             deleteSuccess = true;
             console.log('Deleted existing auth user.');
             break;
           }
           lastDeleteError = deleteError;
           console.warn(`Warning: failed to delete existing auth user (${deleteError.message}). Retrying... (${deleteRetries - 1} retries left)`);
           await new Promise(resolve => setTimeout(resolve, 3000));
           deleteRetries--;
         }

         if (!deleteSuccess) {
           console.error('Failed to delete existing auth user after retries:', lastDeleteError?.message || lastDeleteError);
           process.exit(1);
         }
       }

       // 2. Create fresh test user with retry loop
       console.log('Creating fresh test user with robust retry loop...');
       let createRetries = 15;
       let createData: any = null;
       let lastCreateError: any = null;
       while (createRetries > 0 && !createData) {
         const res = await supabase.auth.admin.createUser({
           email: TARGET_EMAIL,
           password: TARGET_PASSWORD,
           email_confirm: true // Auto-confirm email so they can log in immediately
         });
         if (!res.error && res.data?.user) {
           createData = res.data;
           break;
         }
         lastCreateError = res.error;
         console.warn(`Warning: failed to create test user (${res.error?.message || res.error}). Retrying... (${createRetries - 1} retries left)`);
         await new Promise(resolve => setTimeout(resolve, 3000));
         createRetries--;
       }

       if (!createData || (lastCreateError && !createData)) {
         console.error('Failed to create test user after retries:', lastCreateError?.message || lastCreateError);
         process.exit(1);
       }

       const userId = createData.user.id;
       console.log(`Created fresh test user. ID: ${userId}`);
   ```
3. Ensure `e2e/run_e2e.ts` retains `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering, `fuser -k 3000/tcp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, port `25432` migration, and `async setup()`.
4. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
5. Ensure `fuser -k 54321/tcp` remains removed from `e2e/run_e2e.ts` to prevent socket inheritance process suicides.
6. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
7. Ensure `e2e/seed.ts` retains `schemaRetries = 50` and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop.
8. Ensure `e2e/init_db.ts` retains the 10s post-notification delay (`setTimeout(resolve, 10000)`).
9. Ensure `next.config.js` retains `outputFileTracing: false`.
10. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.
11. Execute the prerequisite process cleanup command to terminate all orphaned test runners, fully prune all containers, and purge all volumes:
    `fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true`
12. Verify TypeScript compilation and type safety:
    `npx tsc --noEmit`
13. Verify Unit Tests for Planner Business Logic Engines:
    `npm run test __tests__/planner`
14. Run the full test runner command specified in `TEST_READY.md`:
    `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
15. Document your implementation and verification results in `handoff.md` in your working directory, and send a completion message to me.
