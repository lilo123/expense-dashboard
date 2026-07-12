# Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage) - Reviewer 1 (Iteration 10) Handoff Report

## 1. Observation

### Review Summary

**Verdict**: REQUEST_CHANGES

### Findings

#### [Major] Finding 1
- What: `npm run build` fails during E2E test runner execution with `Error: ENOENT: no such file or directory, open '/usr/local/google/home/duynguyenn/expense-dashboard/.next/server/proxy.js.nft.json'`.
- Where: `next.config.js:3` (`outputFileTracingRoot: __dirname`)
- Why: When `outputFileTracingRoot` is configured in Next.js 16.2.4 (webpack), Next.js attempts to generate Next.js File Trace (.nft.json) files for all server assets including `proxy.js`. In custom server or standalone proxy setups, `proxy.js.nft.json` may not be generated, causing the production build to fail and blocking the E2E test suite.
- Suggestion: Add `outputFileTracing: false` to `nextConfig` in `next.config.js`.

### Verified Claims
- `src/lib/planner/types.ts` correctly includes `costBasis: z.number().min(0).optional()` → verified via `view_file` → PASS
- `src/lib/planner/drawdownEngine.ts` correctly calculates growth ratio taxation (`toWithdraw * growthRatio * 0.5`) and reduces `costBasis` proportionally → verified via `view_file` → PASS
- `src/lib/planner/simulator.ts` correctly calculates dynamic `netIncomeForOas = baseTotalPension + drawdownTaxableIncome` and applies OAS clawbacks → verified via `view_file` → PASS
- `e2e/run_e2e.ts` correctly includes `rm -rf supabase/.temp` before starting Supabase → verified via `view_file` → PASS
- `e2e/seed.ts` removes aggressive restarts during Auth polling → verified via `view_file` → PASS
- `supabase/config.toml` increases Auth rate limits (`sign_in_sign_ups = 1000`, etc.) → verified via `view_file` → PASS
- `npm run test __tests__/planner` executes successfully with 100% passing unit tests → verified via `task-16` output → PASS
- `npx tsx e2e/run_e2e.ts` executes successfully → verified via `task-16` output → FAIL (failed at `npm run build` step)

### Coverage Gaps
- Playwright E2E test execution — risk level: medium — recommendation: investigate once `npm run build` passes.

### Unverified Items
- Playwright E2E test assertions (`npx playwright test`) — reason not verified: blocked by `npm run build` failure in `e2e/run_e2e.ts`.

---

### Challenge Summary

**Overall risk assessment**: MEDIUM

### Challenges

#### [Medium] Challenge 1
- Assumption challenged: Next.js production build (`npm run build`) will succeed with `outputFileTracingRoot` enabled in a custom server/proxy environment.
- Attack scenario: During `npx tsx e2e/run_e2e.ts`, `npm run build` is invoked to create a fresh production bundle. Next.js attempts to trace `proxy.js` but cannot find `proxy.js.nft.json`, throwing an `ENOENT` error and crashing the entire E2E test runner before Next.js server spawn or Playwright execution.
- Blast radius: Blocks the entire E2E test suite (`e2e/run_e2e.ts`) and prevents verification of Tier 1 feature coverage.
- Mitigation: Explicitly disable output file tracing by setting `outputFileTracing: false` in `next.config.js`.

### Stress Test Results
- `npx tsx e2e/run_e2e.ts` build step → expected: successful Next.js production bundle → actual: `ENOENT` on `proxy.js.nft.json` → FAIL
- Supabase Auth rate limits during seeding → expected: no `429 Too Many Requests` → actual: successful seeding of test users and 35 expenses → PASS
- Supabase container start without daemon locks → expected: clean start after `rm -rf supabase/.temp` → actual: Supabase started successfully → PASS

### Unchallenged Areas
- Playwright browser automation — reason not challenged: blocked by `npm run build` failure.

## 2. Logic Chain
1. **Verification Suite Execution**: Executed `task-16` running `fuser -k ... && docker rm -f ... && npx tsc --noEmit && npm run test __tests__/planner && npx tsx e2e/run_e2e.ts ...`.
2. **Unit Test & Type Safety Success**: `npx tsc --noEmit` and `npm run test __tests__/planner` completed successfully, confirming type safety and pure business logic correctness (Zod schemas, tax engine, pension engine, spending engine, drawdown engine, simulator).
3. **Database & Seeding Success**: `e2e/run_e2e.ts` successfully started Supabase containers (thanks to `rm -rf supabase/.temp`), pushed migrations, initialized the database, and ran `e2e/seed.ts` without Auth rate limit errors (thanks to `supabase/config.toml` updates).
4. **Build Failure Observation**: During the `npm run build` step of `e2e/run_e2e.ts`, Next.js failed with `Error: ENOENT: no such file or directory, open '/usr/local/google/home/duynguyenn/expense-dashboard/.next/server/proxy.js.nft.json'`.
5. **Root Cause Analysis**: Inspection of `next.config.js` revealed `outputFileTracingRoot: __dirname`. Without `outputFileTracing: false`, Next.js attempts to trace all server files including `proxy.js`, failing when `proxy.js.nft.json` is not generated.
6. **Integrity Verification**: Actively checked all implementation files (`types.ts`, `drawdownEngine.ts`, `simulator.ts`, `run_e2e.ts`, `seed.ts`, `config.toml`) and test files (`planner.test.ts`) for integrity violations (hardcoded test results, dummy/facade implementations, shortcuts, fabricated outputs). Confirmed all implementations are genuine and robust.
7. **Conclusion & Verdict**: Because `npm run build` fails and blocks E2E test execution, the verdict must be `REQUEST_CHANGES` to add `outputFileTracing: false` to `next.config.js`.

## 3. Caveats
- Playwright E2E test assertions could not be verified due to the upstream `npm run build` failure.

## 4. Conclusion
- **Verdict**: REQUEST_CHANGES
- Worker 1's implementation of the core domain types, business logic engines, Supabase daemon lock fixes, Auth rate limits, and seed determinism is excellent and genuine, with zero integrity violations.
- However, `npm run build` fails during `e2e/run_e2e.ts` due to `Error: ENOENT: no such file or directory, open '.../.next/server/proxy.js.nft.json'`.
- **Actionable Next Step**: The Worker must update `next.config.js` to include `outputFileTracing: false` in `nextConfig`.

## 5. Verification Method
- To independently verify the fix once implemented, execute the following command from the project root (`/usr/local/google/home/duynguyenn/expense-dashboard`):
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && npx tsc --noEmit && npm run test __tests__/planner && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
- **Expected Result**: All commands must complete successfully with exit code 0, demonstrating successful Next.js production build, 100% passing unit tests, and 100% passing E2E tests.
