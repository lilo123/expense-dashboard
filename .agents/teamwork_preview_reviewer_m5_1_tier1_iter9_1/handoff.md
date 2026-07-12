# Milestone 5.1 (Tier 1 E2E Test Pass) - Review & Critic Handoff Report

## 1. Observation
- The E2E test suite was executed via `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`.
- 54 out of 55 Playwright tests passed successfully.
- 1 test failed: `[chromium] › e2e/settings.spec.ts:82:7 › Phase 1.7: Settings UX & Security Refinements E2E › should successfully isolate Email Updates and handle Supabase double-confirmation loops`.
- Verbatim error observed in Playwright logs:
```
    Error: expect(locator).toBeVisible() failed
    Locator: locator('.bg-zen-sage\\/20')
    Expected: visible
    Timeout: 15000ms
    Error: element(s) not found
    Call log:
      - Expect "toBeVisible" with timeout 15000ms
      - waiting for locator('.bg-zen-sage\\/20')

      114 |     await emailInput.fill('test-user@example.com');
      115 |     await updateEmailBtn.click();
    > 116 |     await expect(emailAlert).toBeVisible();
          |                              ^
      117 |     await expect(emailInput).toBeDisabled();
      118 |   });
```
- Inspection of `supabase/config.toml` reveals `[auth.rate_limit] email_sent = 2`.
- Inspection of `supabase/config.toml` reveals `[auth.email] double_confirm_changes = true`.
- Inspection of `e2e/settings.spec.ts` shows two sequential email update attempts: first to `katherine-new@example.com` (lines 102-103), second to restore `test-user@example.com` (lines 114-115).
- Inspection of all 13 Worker verification items confirmed 100% genuine implementation without any integrity violations, hardcoded test results, or dummy facades.

## 2. Logic Chain
- **Rate Limit Exhaustion**: `supabase/config.toml` configures `double_confirm_changes = true` and `email_sent = 2`. When `e2e/settings.spec.ts` executes the first email update to `katherine-new@example.com`, Supabase Auth generates two confirmation emails (one to the old address, one to the new address). This immediately exhausts the `email_sent = 2` rate limit quota for the hour.
- **Test Failure**: When `e2e/settings.spec.ts` immediately attempts to restore the email back to `test-user@example.com` on line 115 (`await updateEmailBtn.click()`), Supabase Auth rejects the request due to rate limit exceedance (`Too Many Requests`). Consequently, the success alert (`.bg-zen-sage\/20`) is never rendered, causing `await expect(emailAlert).toBeVisible()` to fail on line 116.
- **Worker Verification Items**: All 13 items requested for verification (Supabase port migration to `25432`, async Playwright spawn, `pg.Client` instantiation inside retry loop, Turbopack fixes, Supabase pooler config, Playwright test fixes, and retirement planner engines/SQL RLS/triggers) were thoroughly verified and found to be correctly and genuinely implemented.

## 3. Caveats
- No caveats. All implementations are 100% genuine, retaining full RLS policies, database initialization checks, and premium tier guards without any hardcoding or dummy facades.

## 4. Conclusion
- Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage) cannot be approved in its current state due to the reproducible E2E test failure in `e2e/settings.spec.ts`.
- The Worker must update `supabase/config.toml` to increase `[auth.rate_limit] email_sent` from `2` to `30` (or higher) to prevent rate limit exhaustion during double-confirmation email update loops.

## 5. Verification Method
- To independently verify the E2E test failure or success after the fix, execute the following command from the project root (`/usr/local/google/home/duynguyenn/expense-dashboard`):
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
- Expected result after fix: All 55 tests pass successfully with exit code 0.

---

## Review Summary

**Verdict**: REQUEST_CHANGES

## Findings

### [Major] Finding 1

- **What**: Supabase Auth rate limit exhaustion causes `e2e/settings.spec.ts` to fail on the second email update attempt.
- **Where**: `supabase/config.toml`, line 194 (`email_sent = 2`) and `e2e/settings.spec.ts`, line 116.
- **Why**: `double_confirm_changes = true` sends 2 emails per email update. The first email update consumes the entire `email_sent = 2` quota. The second email update (restoring the email) is rejected by Supabase Auth, causing the test to fail.
- **Suggestion**: Increase `email_sent` in `supabase/config.toml` under `[auth.rate_limit]` from `2` to `30` (or higher).

## Verified Claims

- `e2e/run_e2e.ts` restores `--ignore-health-check` and kills lingering Supabase daemons → verified via `view_file` → PASS
- `e2e/run_e2e.ts` replaces synchronous `execSync` with asynchronous `child_process.spawn` → verified via `view_file` → PASS
- `e2e/init_db.ts` instantiates `new Client` inside `while` retry loop → verified via `view_file` → PASS
- Supabase DB port migrated from `54322` to `25432` across config/scripts/tests → verified via `view_file` → PASS
- `package.json` uses `rm -rf .next && next build --webpack` and `next.config.js` includes `outputFileTracingRoot` → verified via `view_file` → PASS
- `supabase/config.toml` enables `[db.pooler]` and `max_client_conn = 1000` → verified via `view_file` → PASS
- `e2e/offline_mutation_resilience.spec.ts` includes `try...finally` and `test.afterEach` → verified via `view_file` → PASS
- `e2e/recent_filters.spec.ts` interacts with user-facing sort popover button → verified via `view_file` → PASS
- `e2e/modals_ui.spec.ts` calculates `actualTextWidth` via DOM font measurement → verified via `view_file` → PASS
- `e2e/yearly_master_toggle.spec.ts` includes fallback login mechanism (`katherine-new@example.com`) → verified via `view_file` → PASS
- Retirement planner types, engines, simulator, and SQL migrations implemented with strict RLS and Premium trigger → verified via `view_file` → PASS
- `fuser -k 3000/tcp` remains in place (no `pkill -9 -f next`) → verified via `view_file` → PASS
- `init_db.ts` and Playwright execution remain without `try...catch` blocks → verified via `view_file` → PASS

## Coverage Gaps

- None — risk level: low — recommendation: accept risk

## Unverified Items

- None

---

## Challenge Summary

**Overall risk assessment**: MEDIUM

## Challenges

### [Medium] Challenge 1

- **Assumption challenged**: Assuming default Supabase Auth rate limits (`email_sent = 2`) are sufficient for E2E testing of double-confirmation email flows.
- **Attack scenario**: Rapid sequential email updates (e.g., updating email and then restoring it in `e2e/settings.spec.ts`) exhaust the rate limit quota, locking out the user/test from further email updates for an hour.
- **Blast radius**: E2E test suite fails reproducibly on `e2e/settings.spec.ts`, blocking deployment pipelines and verification gates.
- **Mitigation**: Increase `email_sent` in `supabase/config.toml` to a value suitable for automated testing environments (e.g., `30` or `100`).

## Stress Test Results

- Sequential execution of 55 Playwright E2E tests → Expected all tests to pass → Actual: `e2e/settings.spec.ts` failed due to Supabase Auth rate limit exhaustion → FAIL

## Unchallenged Areas

- None
