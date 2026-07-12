# Handoff Report — Milestone 5.2 (Tier 2 E2E Test Pass - Boundary & Corner Cases), Iteration 7

## Observation
During our comprehensive investigation of `e2e/run_e2e.ts`, `__tests__/db/recurring_db.test.ts`, and all other M5.2 verification scripts and unit tests, we directly observed the teardown sequence implementations across the codebase:

1. **`e2e/run_e2e.ts` (lines 31-39)**:
   ```typescript
   // Targeted pkill for Supabase CLI/daemon processes BEFORE docker cleanup
   try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   // Docker container and volume cleanup (targeted)
   try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   ```
   Here, `pkill` executes BEFORE `docker rm -f`.

2. **`__tests__/db/recurring_db.test.ts` (lines 30-35)**:
   ```typescript
   try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   ```
   Here, `pkill` executes BEFORE `docker rm -f`.

3. **`e2e/adv_supabase_teardown_race.ts` (lines 15-22 & 49-56)**:
   ```typescript
   // 3. Docker container, volume, and network cleanup
   try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
   try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
   try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
   // 4. Targeted pkill for remaining Supabase CLI/daemon processes BEFORE docker wait loop
   try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
   try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
   try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   ```
   Here, `docker rm -f` correctly executes BEFORE `pkill`.

4. **`e2e/test_fuser.ts`, `e2e/test_pkill.ts`, `e2e/test_supabase_pkill.ts` (lines 11-21 in each)**:
   In all three of these test scripts, `docker rm -f`, `docker volume rm -f`, and `docker network rm` correctly execute BEFORE `pkill`.

5. **Other M5.2 Verification Scripts & Unit Tests**:
   All other files (`e2e/stress_test_m4.ts`, `e2e/stress_test_m4_edge_cases.ts`, `e2e/adv_init_db_retry.ts`, `e2e/adv_planner_gaps.ts`, `e2e/adv_supabase_dns_nxdomain.ts`, `e2e/adv_supabase_lifecycle.ts`, `e2e/verify_accumulation.ts`, `e2e/verify_global_market_data.ts`, `e2e/verify_monte_carlo.ts`, `e2e/verify_tier3_combinations.ts`, `e2e/verify_tier3_interactions.ts`, `e2e/seed.ts`, `e2e/init_db.ts`, `__tests__/planner/planner.test.ts`, etc.) do not define or execute the Supabase teardown sequence directly.

## Logic Chain
1. `SCOPE.md` explicitly defines the Teardown Sequence contract: `"Standardized bulletproof teardown sequence across all 9 locations... ensuring pkill executes after docker rm -f to prevent supabase-go daemon corruption."`
2. Executing `pkill` before `docker rm -f` terminates the managing `supabase-go` daemon while Docker containers are still actively running. This leaves Docker containers orphaned without their managing daemons, risking state corruption, locked sockets, and race conditions upon subsequent startup attempts.
3. In `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts`, the current teardown sequence violates this contract by executing `pkill -9 -f ...` prior to `docker rm -f`.
4. In `e2e/adv_supabase_teardown_race.ts`, `e2e/test_fuser.ts`, `e2e/test_pkill.ts`, and `e2e/test_supabase_pkill.ts`, the teardown sequence correctly adheres to the contract by executing `docker rm -f` prior to `pkill`.
5. Therefore, a concrete fix strategy must be applied to `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` to invert the order of `pkill` and `docker rm -f`, bringing them into strict compliance with `SCOPE.md`.

## Caveats
- No caveats. All M5.2 verification scripts, unit tests, E2E tests, and helper scripts were exhaustively inspected to ensure complete coverage of all teardown sequence locations.

## Conclusion
To resolve the VETO issued by Reviewer 2 Gen 6 and adhere strictly to the `SCOPE.md` contract, the implementer must invert the teardown sequence order in `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts`.

### Recommended Concrete Fix Strategy

#### 1. `e2e/run_e2e.ts` (lines 31-39)
Replace the existing teardown block with:
```typescript
  // Docker container and volume cleanup (targeted) BEFORE pkill
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  // Targeted pkill for Supabase CLI/daemon processes AFTER docker cleanup
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
```

#### 2. `__tests__/db/recurring_db.test.ts` (lines 30-35)
Replace the existing teardown block with:
```typescript
        try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
```

## Verification Method
After implementing the recommended fixes, verify the correctness and stability of the teardown sequence by executing the following commands:

1. **Verify Unit Tests**:
   ```bash
   npm test __tests__/db/recurring_db.test.ts
   npm test __tests__/planner/planner.test.ts
   ```
2. **Verify E2E Test Runner & Verification Scripts** (as defined in `TEST_READY.md`):
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
   ```
   All tests must pass successfully with exit code 0.
