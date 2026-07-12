# Milestone 5.1 Forensic Audit & Test Coverage Report

## Forensic Audit Report

**Work Product**: Expense Dashboard - Retirement Calculator Expansion & E2E Test Suite (`/usr/local/google/home/duynguyenn/expense-dashboard`)
**Profile**: General Project
**Verdict**: INTEGRITY VIOLATION

### Phase Results
- **Hardcoded output detection**: PASS — No hardcoded test results or `PASS/FAIL` strings found in the E2E test suite (`e2e/run_e2e.ts`, `e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`).
- **Facade detection**: PASS — All business logic engines (`taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`), Supabase migrations (`20260624000000_retirement_planner.sql`), and E2E tests are genuinely implemented without dummy facades or error swallowing `try...catch` blocks.
- **Pre-populated artifact detection**: PASS — No pre-populated logs or result artifacts predating the current iteration were found.
- **Build and run**: FAIL — The full test runner command `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts` failed with exit code 1 because `npx tsx e2e/init_db.ts` failed to connect to Postgres after 15 retries (due to Supabase containers failing to start/initialize properly).
- **Output verification**: FAIL — Standalone simulation engine `simulator.ts` hardcodes `netIncomeForOas` to `50000`, failing to apply OAS clawbacks; `drawdownEngine.ts` incorrectly taxes principal withdrawals from NonRegistered accounts.
- **Dependency audit**: PASS — No core logic is delegated to prohibited third-party packages; all implementations use standard libraries or allowed auxiliary packages (`zod`, `comlink`).

### Evidence
```
=== [DB INITIALIZER] Connecting to local Postgres ===
Waiting for Postgres to be ready... (15 retries left)
Waiting for Postgres to be ready... (14 retries left)
Waiting for Postgres to be ready... (13 retries left)
Waiting for Postgres to be ready... (12 retries left)
Waiting for Postgres to be ready... (11 retries left)
Waiting for Postgres to be ready... (10 retries left)
Waiting for Postgres to be ready... (9 retries left)
Waiting for Postgres to be ready... (8 retries left)
Waiting for Postgres to be ready... (7 retries left)
Waiting for Postgres to be ready... (6 retries left)
Waiting for Postgres to be ready... (5 retries left)
Waiting for Postgres to be ready... (4 retries left)
Waiting for Postgres to be ready... (3 retries left)
Waiting for Postgres to be ready... (2 retries left)
Waiting for Postgres to be ready... (1 retries left)
Failed to connect to Postgres after 15 retries.
E2E Tests execution failed! Error: Command failed: npx tsx e2e/init_db.ts

=== [ADVERSARIAL AUDIT] Executing Planner Business Logic Engine Stress Tests ===

--- Test 1: OAS Clawback in Simulator ---
Simulation completed with success rate: 0%
Standalone OAS at $150k income: $0
Simulator OAS (hardcoded $50k income): $8500
[BUG/GAP] Simulator hardcodes netIncomeForOas to $50,000, failing to apply OAS clawback of $8500.

--- Test 2: Taxable Account Drawdown Taxation ---
Withdrew $100,000 from NonRegistered account. Tax paid: $7500
[BUG/GAP] Drawdown engine incorrectly taxes principal withdrawals from NonRegistered accounts (assumes 50% capital gains inclusion on entire withdrawal amount).

=== [ADVERSARIAL AUDIT] Completed with 2 failures ===
```

---

## Coverage Audit Summary

- Features in matrix: 11
- Features covered by existing tests: 8 (8/11 = 72.7%)
- Uncovered features: 3
- Adversarial tests written: 1
- Adversarial tests that exposed failures: 1

## Feature Matrix

| Feature | Source | Category | Test File(s) | Covered? |
|---------|--------|----------|--------------|:--------:|
| F1: Global Market Data Toggle | Spec (2026-07-03) | Market Data | `e2e/verify_monte_carlo.ts` | ✅ Yes |
| F2: Accumulation Phase & Timeline Toggle | Spec (2026-07-03) | Simulation | `e2e/verify_accumulation.ts` | ✅ Yes |
| F3: Simulation Mode Toggle (Monte Carlo) | Spec (2026-07-03) | Simulation | `e2e/verify_monte_carlo.ts` | ✅ Yes |
| F4: Port Migration (54322 -> 25432) | Spec / Task | Configuration | `e2e/run_e2e.ts`, `e2e/init_db.ts` | ✅ Yes |
| F5: Supabase Connection Pooler | Spec / Task | Configuration | `e2e/run_e2e.ts` | ✅ Yes |
| F6: Offline Mutation Resilience | Spec / Task | E2E UI | `e2e/offline_mutation_resilience.spec.ts` | ✅ Yes |
| F7: Recent Tab Filters & Sorting | Spec / Task | E2E UI | `e2e/recent_filters.spec.ts` | ✅ Yes |
| F8: Modals UI & Text Width Calculation | Spec / Task | E2E UI | `e2e/modals_ui.spec.ts` | ✅ Yes |
| F9: Yearly Tab Fallback Login | Spec / Task | E2E UI | `e2e/yearly_master_toggle.spec.ts` | ✅ Yes |
| F10: OAS Clawback & Pension Adjustments | Spec (2026-06-23) | Business Logic | (none) | ❌ No |
| F11: Drawdown Sequencing & Taxation | Spec (2026-06-23) | Business Logic | (none) | ❌ No |

## Gap Report

| Feature | Severity | Why it matters |
|---------|:--------:|----------------|
| F10: OAS Clawback & Pension Adjustments | High | `simulator.ts` hardcodes `netIncomeForOas` to `$50,000`, meaning high-income retirees never experience OAS clawbacks in simulations. |
| F11: Drawdown Sequencing & Taxation | High | `drawdownEngine.ts` assumes a 50% capital gains inclusion rate on the entire withdrawal amount (principal + growth) for NonRegistered accounts, overcharging tax. |

## Adversarial Test Results

| Test File | Feature Targeted | Reference | Product | Verdict |
|-----------|------------------|-----------|---------|---------|
| `e2e/adv_planner_gaps.ts` | OAS Clawback & Drawdown Tax | PASS | FAIL | BUG |

## New Test Files

- `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/adv_planner_gaps.ts`

---

## 1. Observation
- The prerequisite process cleanup command `fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true` executed successfully.
- The full test runner command `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts` failed with exit code 1 (`task-44`).
- Specifically, `npx supabase start --ignore-health-check` failed during attempt 1, and subsequent retries encountered `supabase start is already running.` while the underlying containers were actually stopped (`Stopped services: [...]`). Consequently, `npx tsx e2e/init_db.ts` failed to connect to Postgres at `postgresql://postgres:postgres@127.0.0.1:25432/postgres` after 15 retries.
- Inspection of `e2e/run_e2e.ts` confirmed it correctly restores `--ignore-health-check`, explicitly kills lingering Supabase CLI daemons (`pkill -f supabase` / `fuser -k 54321/tcp 54322/tcp 25432/tcp`), and replaces synchronous `execSync('npx playwright test ...')` with asynchronous `child_process.spawn` wrapped in a Promise.
- Inspection of `e2e/init_db.ts` confirmed it correctly instantiates `new Client({ connectionString })` INSIDE the `while` retry loop on each attempt.
- Inspection of `supabase/config.toml`, `e2e/init_db.ts`, `e2e/run_e2e.ts`, `__tests__/db/recurring_db.test.ts`, `scripts/migrate.js`, and `scripts/run_hotfix.js` confirmed they correctly migrate the Supabase DB port from `54322` to `25432`.
- Inspection of `package.json` confirmed `build` script uses `rm -rf .next && next build --webpack`, and `next.config.js` includes `outputFileTracingRoot: __dirname`.
- Inspection of `supabase/config.toml` confirmed `[db.pooler] enabled = true` and `max_client_conn = 1000`.
- Inspection of `e2e/offline_mutation_resilience.spec.ts` confirmed `try...finally` and `test.afterEach` cleanup are present.
- Inspection of `e2e/recent_filters.spec.ts` confirmed it interacts with the user-facing sort popover button rather than `select#sort-select`.
- Inspection of `e2e/modals_ui.spec.ts` confirmed it calculates `actualTextWidth` via DOM font measurement.
- Inspection of `e2e/yearly_master_toggle.spec.ts` confirmed it includes a fallback login mechanism (`katherine-new@example.com`).
- Inspection of `src/lib/planner/types.ts`, `taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`, and `supabase/migrations/20260624000000_retirement_planner.sql` confirmed genuine implementation with strict RLS (`auth.uid() = user_id`) and Premium tier check trigger.
- Execution of adversarial test `e2e/adv_planner_gaps.ts` failed with exit code 1, proving that `simulator.ts` hardcodes `netIncomeForOas` to `$50,000` (failing to apply OAS clawbacks) and `drawdownEngine.ts` incorrectly taxes principal withdrawals from NonRegistered accounts.

## 2. Logic Chain
- **Behavioral Verification Failure**: Because `task-44` failed with exit code 1 during database initialization (`init_db.ts` failed to connect after 15 retries), the E2E test suite did not execute successfully. According to the Integrity Forensics procedure, a project whose tests fail to run must be flagged as an `INTEGRITY VIOLATION`.
- **Business Logic Gaps**: The pure TypeScript business logic engines contain significant gaps between the specification and implementation. `simulator.ts` hardcodes `netIncomeForOas` to `$50,000`, preventing the simulation of OAS clawbacks for high-income retirees. `drawdownEngine.ts` applies a 50% capital gains inclusion rate to the entire withdrawal amount (principal + growth) for NonRegistered accounts, resulting in incorrect tax calculations.
- **Task Verification Compliance**: Despite the runtime environment initialization failure and business logic gaps, the specific surgical fixes requested in tasks 4 through 13 were verified as correctly implemented in the source code.

## 3. Caveats
- No caveats. All implementations were audited empirically via direct file inspection and independent test execution.

## 4. Conclusion
- The work product is flagged with an **INTEGRITY VIOLATION** due to the failure of the full E2E test runner command (`task-44`) and confirmed business logic gaps in the retirement planner engines (`e2e/adv_planner_gaps.ts`). The work product must be rejected until the Supabase container initialization stability issues and planner engine gaps are resolved.

## 5. Verification Method
- To independently verify the E2E test runner failure, execute:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
- To independently verify the retirement planner business logic gaps, execute:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/adv_planner_gaps.ts
```
- Expected result: Both commands fail with exit code 1.
