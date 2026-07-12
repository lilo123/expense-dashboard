# Handoff Report — Milestone 5.3 Supabase DNS Resolution Fix Strategy

## 1. Observation
- **Verbatim Error Log**: The Forensic Auditor gen2 report documents a fatal failure during `npx supabase start --debug` in `e2e/run_e2e.ts:75:7`. The error log verbatim states:
  ```
  ERROR! Config provider Config.Reader failed with:
  ** (RuntimeError) Failed to detect IP version for DB_HOST: nxdomain
      /app/releases/2.112.1/runtime.exs:161: (file)
  ...
  Runtime terminating during boot ({#{message=><<"Failed to detect IP version for DB_HOST: nxdomain">>,'__struct__'=>'Elixir.RuntimeError','__exception__'=>true}
  ...
  error running container: exit 1
  ```
- **Failing Files & Lines**:
  - `e2e/run_e2e.ts`: Lines 70 and 75 execute `execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });`.
  - `e2e/run_e2e.ts`: Lines 127 and 131 execute `execSync('npx supabase start --debug', ...)` inside `robustSupabaseRestart()`.
  - `e2e/adv_supabase_dns_nxdomain.ts`: Line 8 executes `execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });`.
- **Supabase Configuration (`supabase/config.toml`)**:
  - Lines 81-86 define the `[realtime]` configuration:
    ```toml
    [realtime]
    enabled = true
    # Bind realtime via either IPv4 or IPv6. (default: IPv4)
    # ip_version = "IPv6"
    # The maximum length in bytes of HTTP request headers. (default: 4096)
    # max_header_length = 4096
    ```
  - Lines 7-19 define `[api]` with `port = 54321`.
  - Lines 27-37 define `[db]` with `port = 25432`, `shadow_port = 54320`, `major_version = 17`.
- **E2E Test Supabase Realtime Health Check (`e2e/run_e2e.ts`)**:
  - Lines 318-339 perform a health check on Supabase Realtime (`http://127.0.0.1:54321/realtime/v1/health`).
  - Line 324 explicitly accepts `res.status === 404`, `503`, `502` as healthy: `if (res.ok || res.status === 200 || res.status === 404 || res.status === 503 || res.status === 502)`.
  - Lines 336-338 explicitly allow the test runner to proceed even if the Realtime health check times out: `if (!realtimeHealthy) { console.warn('Warning: Supabase Realtime health check timed out, proceeding anyway...'); }`.
- **Application & E2E Test Characteristics (`e2e/calculator_tier3.spec.ts`, `e2e/verify_tier3_interactions.ts`)**:
  - Inspection of `e2e/calculator_tier3.spec.ts` (lines 1-69) confirms the tests focus on Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations) such as QuickCheckWidget, Scrambled Monte Carlo, Drawdown Engine, Global Market Data, and Premium Entitlement Checks.
  - The application relies on Postgres/PostgREST/Auth but does not require Supabase Realtime WebSocket subscriptions for these E2E test flows.

## 2. Logic Chain
- **Root Cause of `DB_HOST: nxdomain`**:
  - When `npx supabase start` is invoked, the Supabase CLI spins up several Docker containers, including `supabase-realtime`, which is an Elixir application.
  - During container boot, `supabase-realtime` executes `/app/bin/migrate`, which evaluates `/app/releases/2.112.1/runtime.exs`.
  - `runtime.exs` at line 161 attempts to resolve the hostname in `DB_HOST` (configured by Supabase CLI to the database container's name, e.g., `supabase_db_expense-dashboard`) to determine the IP version (IPv4 vs IPv6).
  - In isolated container/capsule networks where user-defined Docker bridge network DNS behaves differently or is restricted, the DNS lookup for `supabase_db_expense-dashboard` fails with `nxdomain` (Non-Existent Domain).
  - This causes an unhandled `RuntimeError` in Elixir, crashing the `supabase-realtime` container with exit code 1.
- **Impact on E2E Test Runner**:
  - Because `supabase-realtime` fails to boot, `npx supabase start --debug` aborts with exit code 1.
  - `e2e/run_e2e.ts` catches this error at line 72, attempts a teardown and retry at line 75, which fails again for the same DNS reason, causing `run_e2e.ts` to throw an unhandled error and exit with code 1 before running migrations, seeding, or Playwright tests.
- **Formulating a Bulletproof Fix Strategy**:
  - **Layer 1 (The Cleanest & Most Direct Fix - Disable Realtime)**: Since `e2e/run_e2e.ts` (lines 324, 336-338) explicitly tolerates `404` or timeouts for the Realtime health check and the M5.3 E2E tests do not use Realtime, setting `enabled = false` under `[realtime]` in `supabase/config.toml` prevents the Supabase CLI from spawning the `supabase-realtime` container entirely. This completely eliminates the Elixir `DB_HOST: nxdomain` boot failure.
  - **Layer 2 (Explicit Container IP/Host & Network Variable Overrides)**: To ensure absolute resilience for all Supabase containers (such as `auth`, `rest`, `kong`) in isolated networks where Docker DNS is unreliable, `e2e/run_e2e.ts` and `e2e/adv_supabase_dns_nxdomain.ts` should pass explicit environment variable overrides to `npx supabase start`. Setting `SUPABASE_DB_HOST=127.0.0.1`, `SUPABASE_INTERNAL_DB_HOST=127.0.0.1`, `DB_HOST=127.0.0.1`, and `SUPABASE_DAEMON_ENABLE=false` forces containers to bypass Docker bridge DNS and connect directly via localhost/loopback or explicit IP.
  - **Layer 3 (Docker Network & Hosts Fallback)**: If Supabase CLI attempts to recreate the network, passing `--debug` along with explicit environment configurations ensures clean initialization regardless of bridge DNS quirks.

## 3. Caveats
- **Read-Only Constraint**: As an explorer agent, no code changes were implemented. The proposed changes must be applied by an implementer agent.
- **Isolated Network Behavior**: The `nxdomain` error is specific to isolated container/capsule networks where Docker's embedded DNS (`127.0.0.11`) does not resolve user-defined bridge container names. In standard local development environments, `npx supabase start` would resolve `DB_HOST` without issue.
- **Realtime Feature Scope**: Disabling `[realtime]` assumes no future E2E tests will be added that rely on Supabase Realtime WebSocket broadcasting. If Realtime is needed in the future, Layer 2 (explicit `DB_HOST=127.0.0.1` env vars) or custom Docker network `--add-host` flags must be used.

## 4. Conclusion
- **Verdict & Assessment**: The Forensic Auditor gen2's finding of an INTEGRITY VIOLATION is confirmed. `e2e/run_e2e.ts` fails reproducibly in isolated container networks due to the Supabase Realtime Elixir runtime failing to resolve `DB_HOST` via Docker DNS (`nxdomain`).
- **Actionable Fix Strategy**:
  1. **Modify `supabase/config.toml`**: Change `enabled = true` to `enabled = false` under `[realtime]` (line 82).
  2. **Modify `e2e/run_e2e.ts`**: Update `execSync('npx supabase start --debug', ...)` at lines 70, 75, 127, and 131 to include `SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', DB_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false'` in the `env` object.
  3. **Modify `e2e/adv_supabase_dns_nxdomain.ts`**: Update `execSync('npx supabase start --debug', ...)` at line 8 to include the same explicit DNS/IP environment variables.

## 5. Verification Method
To independently verify the fix once implemented, execute the following commands in the project root (`/usr/local/google/home/duynguyenn/expense-dashboard`):

1. **Verify E2E Test Runner Initializes Cleanly**:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && export NODE_OPTIONS=--max-old-space-size=256 && npx tsx e2e/run_e2e.ts
```
*Expected result*: Supabase starts successfully without `DB_HOST: nxdomain` errors, migrations run cleanly, Next.js builds, and Playwright tests execute and pass with exit code 0.

2. **Verify Adversarial Test Case Passes**:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/adv_supabase_dns_nxdomain.ts
```
*Expected result*: Outputs `✔ Supabase started successfully without DNS nxdomain errors.` and exits with code 0.
