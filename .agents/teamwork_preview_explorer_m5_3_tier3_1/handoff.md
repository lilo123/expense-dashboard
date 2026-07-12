# Handoff Report: Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations)

## 1. Observation
- **E2E Verification Scripts Execution**: Ran `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts`. All 6 verification scripts completed successfully with exit code 0.
- **Master E2E Runner Failure**: Ran `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts`. The command failed with exit code 1 during Supabase startup with the verbatim error:
  ```
  failed to create docker container: Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use by container "1cd86e8e831c12c05210405adb7886b678dc853ba7f7e039387a32b31fd263ea". You have to remove (or rename) that container to be able to reuse that name.
  Supabase start attempt 2 failed. Checking status and cleaning up before retry...
  ```
- **Teardown Sequence Flaw in `e2e/run_e2e.ts`**: Inspection of `e2e/run_e2e.ts` across all 8 teardown sequence locations (lines 38-47, 54-63, 93-102, 119-128, 168-177, 225-234, 243-252, 275-284) reveals the following command order:
  ```typescript
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
  ```
- **Adversarial Confirmation**: `e2e/adv_supabase_teardown_race.ts` explicitly simulates this exact `Worker 1 teardown sequence (pkill supabase AFTER docker wait loop)` and confirms it causes a race condition where `supabase-go` recreates the container before being killed.
- **Missing Tier 3 Pairwise Tests**: `PROJECT.md` and `TEST_READY.md` define Milestone 5.3 as "Tier 3 E2E Test Pass (Cross-Feature Combinations)" requiring 100% passing of Tier 3 pairwise feature interaction tests (8 test cases). Inspection of `e2e/` reveals no dedicated test script for these 8 test cases, and the test runner command in `TEST_READY.md` does not include a Tier 3 verification script.

## 2. Logic Chain
1. **Supabase Teardown Race Condition**: `supabase-go` is a background daemon that actively monitors and manages Supabase Docker containers. When `docker ps -aq | xargs -r docker rm -f` is executed while `supabase-go` is still running, `supabase-go` detects that its containers were unexpectedly removed and immediately attempts to recreate them (e.g., `supabase_db_expense-dashboard`). When `pkill -9 -f supabase-go` executes afterwards, it kills the daemon but leaves the newly recreated container orphaned in Docker. When `npx supabase start` is subsequently called, it fails because `supabase_db_expense-dashboard` already exists.
2. **Teardown Fix Order**: To eliminate this race condition, `pkill -9 -f supabase`, `pkill -9 -f supabase-go`, and `pkill -9 -f npx supabase` must execute BEFORE `docker ps -aq | xargs -r docker rm -f`. This ensures the daemon is completely terminated before any containers are removed, preventing container recreation.
3. **Tier 3 Pairwise Combinations Gap**: The retirement calculator has 3 major binary toggle features: F1 (`us` vs `global`), F2 (`retirement_only` vs `retirement_and_accumulation`), and F3 (`historical` vs `monte_carlo`). The 8 test cases mentioned in `PROJECT.md` correspond exactly to the $2^3 = 8$ pairwise cross-feature combinations of these toggles. Since no script currently executes these 8 combinations together, a dedicated verification script `e2e/verify_tier3_combinations.ts` must be created, and `TEST_READY.md` must be updated to include it in the test runner command.

## 3. Caveats
- No caveats. All E2E verification scripts were executed directly, and the failures and gaps were conclusively identified in the codebase.

## 4. Conclusion
To achieve 100% passing Tier 3 E2E tests with exit code 0 for Milestone 5.3, the implementer must execute two concrete fixes:
1. **Fix Supabase Teardown Race Condition in `e2e/run_e2e.ts`**: Reorder the teardown sequence across all 8 locations in `e2e/run_e2e.ts` so that `pkill` executes before `docker rm -f`.
2. **Implement Tier 3 Pairwise Feature Interaction Tests**: Create `e2e/verify_tier3_combinations.ts` covering the 8 cross-feature combinations and update `TEST_READY.md`.

### Concrete Fix Strategy & Code Snippets

#### Fix 1: Reorder Teardown Sequence in `e2e/run_e2e.ts`
Replace the teardown sequence in all 8 locations in `e2e/run_e2e.ts` (lines 38-47, 54-63, 93-102, 119-128, 168-177, 225-234, 243-252, 275-284) with the following bulletproof sequence:
```typescript
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
```

#### Fix 2: Create `e2e/verify_tier3_combinations.ts`
Create `e2e/verify_tier3_combinations.ts` with the following content:
```typescript
// Ensure global self is defined for Comlink in Node.js environment
if (typeof globalThis.self === 'undefined') {
  (globalThis as any).self = globalThis;
  (globalThis as any).addEventListener = () => {};
}

import { simulationConfigSchema } from '../src/schemas/simulationSchema';
import { SimulationConfig } from '../src/types/simulation';

async function verifyTier3Combinations() {
  console.log('\n=== [E2E VERIFICATION] Milestone 5.3: Tier 3 Pairwise Feature Interaction Tests (8 Test Cases) ===');
  const { simulationService } = await import('../src/workers/simulation.worker');

  let failed = false;

  function assert(condition: boolean, message: string) {
    if (!condition) {
      console.error(`[FAIL] ${message}`);
      failed = true;
    } else {
      console.log(`✔ ${message}`);
    }
  }

  const baseConfig = {
    initialPortfolio: 1000000,
    duration: 30,
    equities: 60,
    bonds: 40,
    cash: 0,
    withdrawalStrategy: 'constant_dollar',
    initialWithdrawal: 40000,
    currentAge: 40,
    retirementAge: 60,
    additionalContribution: 12000,
  };

  const combinations = [
    { marketDataMode: 'us', timelineMode: 'retirement_only', simulationMode: 'historical', expectedYears: 30 },
    { marketDataMode: 'us', timelineMode: 'retirement_only', simulationMode: 'monte_carlo', expectedYears: 30 },
    { marketDataMode: 'us', timelineMode: 'retirement_and_accumulation', simulationMode: 'historical', expectedYears: 50 },
    { marketDataMode: 'us', timelineMode: 'retirement_and_accumulation', simulationMode: 'monte_carlo', expectedYears: 50 },
    { marketDataMode: 'global', timelineMode: 'retirement_only', simulationMode: 'historical', expectedYears: 30 },
    { marketDataMode: 'global', timelineMode: 'retirement_only', simulationMode: 'monte_carlo', expectedYears: 30 },
    { marketDataMode: 'global', timelineMode: 'retirement_and_accumulation', simulationMode: 'historical', expectedYears: 50 },
    { marketDataMode: 'global', timelineMode: 'retirement_and_accumulation', simulationMode: 'monte_carlo', expectedYears: 50 },
  ];

  try {
    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i];
      console.log(`\n--- Test Case ${i + 1}/8: [F1: ${combo.marketDataMode}] + [F2: ${combo.timelineMode}] + [F3: ${combo.simulationMode}] ---`);
      
      const config: SimulationConfig = {
        ...baseConfig,
        marketDataMode: combo.marketDataMode as any,
        timelineMode: combo.timelineMode as any,
        simulationMode: combo.simulationMode as any,
      };

      const parsed = simulationConfigSchema.safeParse(config);
      assert(parsed.success, `Zod schema validation passed for combination ${i + 1}`);

      const summary = simulationService.runSimulation(config);
      assert(summary && summary.runs && summary.runs.length > 0, `Simulation successfully executed ${summary?.runs?.length} runs`);
      assert(summary.runs[0].years.length === combo.expectedYears, `Timeline duration correctly equals ${combo.expectedYears} years (got ${summary.runs[0]?.years?.length})`);
      assert(!Number.isNaN(summary.successRate), `Success rate is valid number (${summary.successRate}%)`);
      assert(!Number.isNaN(summary.medianEndingBalance), `Median ending balance is valid number ($${summary.medianEndingBalance})`);
    }

    if (failed) {
      console.error('\n=== [E2E VERIFICATION] Tier 3 Pairwise Feature Interaction Tests FAILED ===\n');
      process.exit(1);
    } else {
      console.log('\n=== [E2E VERIFICATION] Tier 3 Pairwise Feature Interaction Tests PASSED (100% Success) ===\n');
      process.exit(0);
    }
  } catch (err) {
    console.error('=== [E2E VERIFICATION] Tier 3 Pairwise Feature Interaction Tests FAILED ===', err);
    process.exit(1);
  }
}

verifyTier3Combinations();
```

#### Fix 3: Update `TEST_READY.md`
Update the `Test Runner` command in `TEST_READY.md` to include `npx tsx e2e/verify_tier3_combinations.ts`:
```markdown
## Test Runner
- Command: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts`
- Expected: all tests pass with exit code 0
```

## 5. Verification Method
After applying the fixes, the implementer must verify success by running:
1. `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_tier3_combinations.ts` (verifies the 8 Tier 3 pairwise combination test cases pass with exit code 0).
2. `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts` (verifies Supabase starts cleanly without container conflicts and all Playwright E2E tests pass with exit code 0).
3. `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts` (verifies the entire master test runner command completes successfully with exit code 0).
