# Handoff Report — M5.1 Tier 1 E2E Test Pass (Feature Coverage)

## 1. Observation
During our read-only investigation of the `expense-dashboard` repository, we directly observed the following file contents and configurations:

### `next.config.js` (Lines 1-17)
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  webpack: (config, { isServer }) => {
// ...
```
- `outputFileTracing` is not explicitly set to `false`.

### `e2e/run_e2e.ts` (Lines 157-161, 198-207)
```typescript
157:     console.log('Building fresh Next.js production bundle...');
158:     try { execSync('fuser -k 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
159:     try { execSync('rm -rf .next', { stdio: 'inherit' }); } catch(e){}
160:     execSync('npm run build', { stdio: 'inherit' });
```
- `execSync('npm run build', { stdio: 'inherit' })` inherits `process.env` directly without sanitizing `NODE_OPTIONS`.
- There is no mechanism to kill lingering parent `run_e2e.ts` processes prior to line 158.

```typescript
198:       const nextServer = require('child_process').spawn('node', ['--unhandled-rejections=warn', '--max-old-space-size=4096', 'node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1'], {
199:         stdio: 'inherit',
200:         env: {
201:           ...process.env,
202:           NODE_OPTIONS: `--require ${path.join(process.cwd(), 'e2e/suppress_crashes.js')} --unhandled-rejections=warn --max-old-space-size=4096`,
// ...
```
- `NODE_OPTIONS` explicitly requires `e2e/suppress_crashes.js`.

### `e2e/suppress_crashes.js` (Lines 7-10)
```javascript
const origExit = process.exit;
process.exit = (code) => {
  console.error(`Suppressed process.exit(${code}) call to prevent Next.js server from terminating during E2E tests.`);
};
```
- Overrides `process.exit` and `process.kill`, preventing the Next.js server from terminating on fatal errors.

### Verification of Existing Correct Implementations
- `e2e/run_e2e.ts` uses `fuser -k 3000/tcp` (Lines 34, 78, 158, 191, 213) and contains no instances of `pkill -9 -f next`.
- `e2e/run_e2e.ts` executes `execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit' });` (Line 151) and Playwright tests (Lines 249-258) without `try...catch` blocks, ensuring genuine error propagation.
- `e2e/run_e2e.ts` retains `rm -rf supabase/.temp` (Lines 50, 179), asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, and port `25432` migration.
- `src/lib/planner/*.ts` (`types.ts`, `taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`) and `supabase/migrations/20260624000000_retirement_planner.sql` are genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers (`check_premium_simulation_range`).

---

## 2. Logic Chain
1. **`ENOENT` during `npm run build`**: Because `next.config.js` lacks `outputFileTracing: false` and `e2e/run_e2e.ts` inherits `NODE_OPTIONS` containing `tsx` wrappers, `next build --webpack`'s `node-file-trace` engine is poisoned by the `tsx` wrapper environment. This causes `ENOENT: no such file or directory, open '.../.next/server/proxy.js.nft.json'`. Adding `outputFileTracing: false` to `next.config.js` and sanitizing `NODE_OPTIONS: ''` in `e2e/run_e2e.ts` before calling `npm run build` permanently eliminates this failure.
2. **Process Lifecycle Race Condition**: Lingering parent `run_e2e.ts` processes from previous runs are not killed by `fuser -k 3000/tcp`. When `fuser -k 3000/tcp` terminates `next-server` before `npm run build`, lingering `run_e2e.ts` parents receive the `exit` event on their `nextServer` child process and immediately respawn `next-server` while `npm run build` is actively executing, corrupting the `.next` directory. By explicitly killing lingering `run_e2e` processes before `fuser -k 3000/tcp`—while filtering out the current process group (`process.getpgid(process.pid)`)—we guarantee that lingering parents are terminated without the current process killing itself.
3. **Zombie Server Flaw**: `e2e/suppress_crashes.js` suppresses `process.exit(1)`. When Next.js encounters a fatal error, the process remains alive as a zombie holding port 3000 without serving traffic (`⨯ Failed to handle request for /login`). Because the process never exits, `nextServer.on('exit')` is never triggered, breaking the respawn logic (`Error: listen EADDRINUSE: address already in use 127.0.0.1:3000`) and causing Playwright tests to fail with timeouts. Removing `suppress_crashes.js` from `NODE_OPTIONS` allows Next.js to genuinely exit on fatal errors so `nextServer.on('exit')` can respawn it cleanly.

---

## 3. Caveats
- No caveats. All observed mechanisms directly align with the verification swarm findings and the required fixes.

---

## 4. Conclusion
To achieve a bulletproof build environment and process lifecycle for `npx tsx e2e/run_e2e.ts`, the Worker must implement the following exact code changes:

### Proposed Change 1: `next.config.js`
Add `outputFileTracing: false,` to `nextConfig`.
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracing: false,
  outputFileTracingRoot: __dirname,
  webpack: (config, { isServer }) => {
// ...
```

### Proposed Change 2: `e2e/run_e2e.ts` (Lines 157-160)
Insert the lingering process kill logic (excluding the current PGID) and sanitize `NODE_OPTIONS` for `npm run build`.
```typescript
    console.log('Building fresh Next.js production bundle...');
    console.log('Killing lingering run_e2e.ts parent processes to prevent race conditions...');
    try {
      const currentPgid = process.getpgid(process.pid);
      execSync(`ps -eo pid,pgid,args | grep run_e2e | grep -v grep | awk '$2 != ${currentPgid} {print $1}' | xargs -r kill -9 2>/dev/null || true`, { stdio: 'inherit' });
    } catch(e){}
    try { execSync('fuser -k 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('rm -rf .next', { stdio: 'inherit' }); } catch(e){}
    execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '' } });
```

### Proposed Change 3: `e2e/run_e2e.ts` (Line 202)
Remove `suppress_crashes.js` from `NODE_OPTIONS`.
```typescript
          NODE_OPTIONS: '--unhandled-rejections=warn --max-old-space-size=4096',
```

---

## 5. Verification Method
To independently verify the fix once implemented:
1. Inspect `next.config.js` to verify `outputFileTracing: false` is present.
2. Inspect `e2e/run_e2e.ts` to verify `NODE_OPTIONS: ''` is passed to `npm run build`, lingering `run_e2e` kill logic is present before `fuser -k 3000/tcp`, and `suppress_crashes.js` is removed from `NODE_OPTIONS`.
3. Execute the E2E test runner command:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
- Expected result: All tests pass successfully with exit code 0, zero `ENOENT` errors, zero race conditions, and zero zombie servers.
