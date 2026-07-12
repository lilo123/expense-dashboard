# Handoff Report — Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage)

## 1. Observation
- **Critical Deadlock in `e2e/run_e2e.ts`**: Across all Supabase teardown and recovery blocks in `e2e/run_e2e.ts` (9 instances total across `setup()` initial cleanup, `setup()` loop start, `setup()` loop catch block, `cleanup()`, `run()` health check recovery, `run()` db push recovery loop, `run()` db push recovery fallback, `run()` pre-seed health check recovery, `run()` post-build health check recovery), the script executes:
  ```typescript
  try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  ```
  (Note: lines 227-228 and 245-246 use `catch(err){}` instead of `catch(e){}`).
- **Verification of Invariants in `e2e/run_e2e.ts`**:
  - `5000` ms polling intervals (`await new Promise(resolve => setTimeout(resolve, 5000))`) are present at lines 79, 181, 205, 288, 353, 405.
  - Post-start stabilization delays (`sleep 20`) after `npx supabase start --ignore-health-check` are present at lines 66, 179, 236, 254, 286, 351.
  - Explicit `pg.Client` Postgres database readiness verification at port `25432` is present at lines 190-212.
  - Full stop/start recovery on migration failure is present at lines 224-256.
  - `npx supabase migration up --include-all` is present at lines 220, 255.
  - `NODE_OPTIONS: ''` sanitization is present at line 321.
  - Precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering is present at lines 301-318.
  - `fuser -k 3000/tcp` is present at lines 35, 115, 319, 362, 384. `pkill -9 -f next` and `fuser -k 54321/tcp` are confirmed absent.
  - Asynchronous `child_process.spawn` for Playwright tests is present at lines 420-429.
  - `sleep 10` decoupling / warmup delays are present at lines 414-418.
  - Next.js keep-alive/respawn mechanism is present at lines 365-391.
  - `execSync('npx tsx e2e/init_db.ts', ...)` (line 257) and Playwright test execution (lines 420-429) remain without `try...catch` blocks.
- **Verification of Invariants in Other Files**:
  - `e2e/seed.ts`: Retains robust retry loops around data deletion and user creation/deletion (lines 115-201), `schemaRetries = 50` (lines 89-103), and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop (line 260).
  - `e2e/init_db.ts`: Retains the 10s post-notification delay (`setTimeout(resolve, 10000)`) at lines 85-86.
  - `next.config.js`: Retains `outputFileTracing: false` at line 3.
  - `src/lib/planner/*.ts` & `supabase/migrations/20260624000000_retirement_planner.sql`: Remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers (`check_premium_simulation_range()`).

## 2. Logic Chain
1. When `npx supabase start` fails or during teardown blocks, if a Supabase Docker volume exists (e.g., `expense-dashboard_supabase_db_expense-dashboard`), `docker volume ls -q | grep -q "supabase"` evaluates to true (`0`).
2. Because the volume removal command (`docker volume rm -f`) is placed AFTER the `while` loop, the volume is never removed while the loop is running.
3. Consequently, the `while` loop hangs infinitely (`while true; do sleep 2; done`), permanently deadlocking the E2E test runner.
4. Reordering `docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true` BEFORE `while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done` ensures that existing volumes are forcibly removed before entering the lock wait loop, preventing the deadlock while preserving robust cleanup.
5. All other invariants in `e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/init_db.ts`, `next.config.js`, `src/lib/planner/*.ts`, and `supabase/migrations/20260624000000_retirement_planner.sql` are already perfectly compliant and must remain untouched.

## 3. Caveats
- No caveats. All files and invariants were thoroughly inspected and verified.

## 4. Conclusion
- The root cause of the E2E test runner hang is the incorrect ordering of the `while` loop and `docker volume rm` command across the 9 teardown blocks in `e2e/run_e2e.ts`.
- **Actionable Fix Strategy**: An implementer must update `e2e/run_e2e.ts` across all 9 locations to place `docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true` before the `while` loop.

### Exact Replacement Chunks for `e2e/run_e2e.ts`

#### Chunk 1 (`setup()` initial cleanup, lines 38-47)
```typescript
// Before (lines 38-47)
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}

// After
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
```

#### Chunk 2 (`setup()` loop start, lines 54-63)
```typescript
// Before (lines 54-63)
      try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
      try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}

// After
      try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
      try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
```

#### Chunk 3 (`setup()` loop catch block, lines 93-102)
```typescript
// Before (lines 93-102)
      try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
      try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}

// After
      try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
      try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
```

#### Chunk 4 (`cleanup()`, lines 119-128)
```typescript
// Before (lines 119-128)
    try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}

// After
    try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
    try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
```

#### Chunk 5 (`run()` health check recovery, lines 168-177)
```typescript
// Before (lines 168-177)
          try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
          try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}

// After
          try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
```

#### Chunk 6 (`run()` db push recovery loop, lines 225-234)
```typescript
// Before (lines 225-234)
        try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(err){}
        try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('sleep 20', { stdio: 'inherit' }); } catch(err){}

// After
        try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(err){}
        try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('sleep 20', { stdio: 'inherit' }); } catch(err){}
```

#### Chunk 7 (`run()` db push recovery fallback, lines 243-252)
```typescript
// Before (lines 243-252)
      try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(err){}
      try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('sleep 20', { stdio: 'inherit' }); } catch(err){}

// After
      try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(err){}
      try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
      try { execSync('sleep 20', { stdio: 'inherit' }); } catch(err){}
```

#### Chunk 8 (`run()` pre-seed health check recovery, lines 275-284)
```typescript
// Before (lines 275-284)
          try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
          try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}

// After
          try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
```

#### Chunk 9 (`run()` post-build health check recovery, lines 340-349)
```typescript
// Before (lines 340-349)
          try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
          try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}

// After
          try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
          try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
```

## 5. Verification Method
- **Command**: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
- **Expected Result**: All tests pass with exit code 0, and Supabase teardown/restart executes cleanly without infinite `while` loop deadlocks.
