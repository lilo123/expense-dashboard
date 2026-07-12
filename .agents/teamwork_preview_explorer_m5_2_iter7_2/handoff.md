# Handoff Report — Milestone 5.2 Iteration 7 Explorer 2

## 1. Observation
During our investigation of the M5.2 verification scripts, E2E test runner, and unit tests in `/usr/local/google/home/duynguyenn/expense-dashboard`, we observed the following teardown sequence implementations across the codebase using `awk` search and `view_file`:

### `e2e/run_e2e.ts` (lines 31-39)
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

### `__tests__/db/recurring_db.test.ts` (lines 30-35)
```typescript
        try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
```

### `e2e/adv_supabase_teardown_race.ts` (lines 16-22 and 50-56)
```typescript
  try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  // 4. Targeted pkill for remaining Supabase CLI/daemon processes BEFORE docker wait loop
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
  try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
```

### `e2e/test_fuser.ts`, `e2e/test_pkill.ts`, `e2e/test_supabase_pkill.ts` (lines 12-21)
```typescript
try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
console.log('4. docker volume rm...');
try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
console.log('5. pkill supabase-go...');
try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
console.log('6. pkill npx supabase...');
try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
console.log('7. pkill bin/supabase...');
try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
```

### `SCOPE.md` Contract Definition (line 15)
```markdown
- **Teardown Sequence**: Standardized bulletproof teardown sequence across all 9 locations (`npx supabase stop`, `pkill -9 -f supabase`, `pkill -9 -f supabase-go`, `pkill -9 -f npx supabase`, `docker rm -f`, `docker volume rm -f`, `while docker ps -aq`, `fuser -k 25432/tcp`, `rm -rf supabase/.temp`, `sleep 20`) ensuring `pkill` executes after `docker rm -f` to prevent `supabase-go` daemon corruption.
```

## 2. Logic Chain
1. **Contract Requirement**: `SCOPE.md` explicitly mandates `ensuring pkill executes after docker rm -f to prevent supabase-go daemon corruption`. If `pkill` executes before `docker rm -f`, Docker containers are left running without their managing daemons (`supabase-go`), which risks state corruption, orphaned containers, and test flakiness/race conditions.
2. **Contract Violations Identified**: In `e2e/run_e2e.ts` (lines 31-39) and `__tests__/db/recurring_db.test.ts` (lines 30-35), the `pkill` commands are executed BEFORE `docker rm -f` and `docker volume rm -f`. This directly violates the `SCOPE.md` contract and confirms the VETO findings from Reviewer 2 Gen 6.
3. **Compliant Locations Identified**: In `e2e/adv_supabase_teardown_race.ts`, `e2e/test_fuser.ts`, `e2e/test_pkill.ts`, and `e2e/test_supabase_pkill.ts`, `docker rm -f`, `docker volume rm -f`, and `docker network rm` correctly execute BEFORE `pkill`. These files already comply with the `SCOPE.md` contract.
4. **Fix Strategy Formulation**: To bring `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` into full compliance with `SCOPE.md`, we must invert the order of `docker rm -f`/`docker volume rm -f`/`docker network rm` and `pkill` in both files.

## 3. Caveats
- **Read-Only Scope**: As an Explorer agent, we operate strictly in read-only investigation mode. We have not implemented the recommended fixes; they must be applied by an Implementer/Worker agent in the next phase of the loop.
- **Scope of Search**: We searched all files in `e2e/`, `__tests__/`, `src/`, and the root directory for teardown commands (`pkill`, `docker rm`, `supabase stop`). We assume no other hidden teardown sequences exist outside these verified locations.

## 4. Conclusion
The VETO issued by Reviewer 2 Gen 6 is fully verified and correct. `e2e/run_e2e.ts` (lines 31-39) and `__tests__/db/recurring_db.test.ts` (lines 30-35) violate the `SCOPE.md` contract by executing `pkill` before `docker rm -f`.

### Concrete Fix Strategy (For Implementer)

#### 1. `e2e/run_e2e.ts` (lines 31-39)
Replace lines 31-39 with the following inverted sequence:
```typescript
  // Docker container and volume cleanup (targeted) BEFORE pkill
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  // Targeted pkill for Supabase CLI/daemon processes
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
```

#### 2. `__tests__/db/recurring_db.test.ts` (lines 30-35)
Replace lines 30-35 with the following inverted sequence:
```typescript
        try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
```

## 5. Verification Method
After the Implementer applies the fixes, verify compliance and test success using the following methods:
1. **Inspect File Contents**: Use `view_file` or `grep`/`awk` to verify that `docker rm -f` appears before `pkill` in `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts`.
2. **Run Unit Tests**: Execute `npm test` to verify `__tests__/db/recurring_db.test.ts` passes successfully with exit code 0.
3. **Run E2E Test Suite**: Execute the full E2E test runner command defined in `TEST_READY.md`:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
   ```
   All tests must pass with exit code 0.
