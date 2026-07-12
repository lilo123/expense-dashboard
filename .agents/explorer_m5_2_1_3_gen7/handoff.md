# Investigation & Fix Strategy Report — Milestone 5.2 (Explorer 3 Gen 7)

## 1. Observation
- **Missing Configuration in `supabase/config.toml`**: Worker Gen 10 claimed in their handoff report to have added `health_timeout = "10m"` under `[db]` in `supabase/config.toml` to prevent Supabase container readiness timeouts. Direct inspection of `supabase/config.toml` (lines 27–36) confirms it is completely missing.
  ```toml
  [db]
  # Port to use for the local database URL.
  port = 25432
  # Port used by db diff command to initialize the shadow database.
  shadow_port = 54320
  # Maximum amount of time to wait for health check when starting the local database.
  # The database major version to use. This has to be the same as your remote database's. Run `SHOW
  # server_version;` on the remote database to check.
  major_version = 17
  ```
- **Mutex Lock Starvation in `e2e/run_e2e.ts`**: `acquireLock()` in `e2e/run_e2e.ts` configures `let attempts = 360;` with a 5-second sleep per attempt (30 minutes total). Under heavy multi-agent concurrency (e.g., PIDs 1714511, 1723643, 1723570, 1722139, 1796677, 1836513, 1835600, 1845353), where each E2E test run takes 3–5 minutes, waiting instances exhaust the 360 attempts before acquiring `/tmp/run_e2e.lock` and abort with `Failed to acquire mutex lock /tmp/run_e2e.lock after 5 minutes. Aborting to prevent process collision.`
- **Premature Termination in `e2e/run_e2e.ts`**: Active `run_e2e.ts` instances execute `killLingeringProcessesScoped('node|tsx|jest|webpack')` and `teardownSupabase()`. When `tsx` executes `run_e2e.ts`, it spawns a child `node` process to run the compiled file, which in turn spawns `sleep 5` during lock waiting. Because `killLingeringProcessesScoped` only checks if `args.includes('run_e2e')` for a specific PID and does not protect child `node` or `sleep` processes of waiting instances, active instances prematurely terminate concurrent waiting instances.
- **Forensic Auditor Verdict**: CLEAN. All implementations are genuine, with no hardcoded test results, facade logic, or fabricated verification artifacts.

## 2. Logic Chain
- **Missing `health_timeout`**: Because `health_timeout = "10m"` was omitted from `supabase/config.toml`, Supabase container startup remains vulnerable to the default 30-second health check timeout if container initialization is slow. Adding it explicitly under `[db]` ensures robust startup across all environments.
- **Mutex Lock Starvation**: Because multiple automated agent workflows run in parallel on the same host, the queue for `/tmp/run_e2e.lock` is long. Increasing `attempts` from 360 to 1440 (2 hours) provides sufficient headroom for all queued agent workflows to complete sequentially without throwing lock starvation errors.
- **Premature Termination**: To prevent `killLingeringProcessesScoped` and `teardownSupabase` from killing waiting `run_e2e` instances, we must protect the entire process tree (ancestors and descendants) of any `run_e2e`, `verify_`, `stress_test_`, `adv_`, `playwright`, `next`, `task`, `jetski`, or `gemini` process. By dynamically building a `protectedPids` Set that includes all parent and child processes (such as `tsx` child `node` processes and `sleep` processes), we guarantee that active test runners never terminate waiting test runners.

## 3. Caveats
- **Concurrent Execution Queue**: With the increased lock timeout (1440 attempts / 2 hours), concurrent `run_e2e.ts` instances will wait patiently in the background until the active instance finishes. This is the intended behavior to ensure clean, isolated E2E test runs without port or database collisions.
- **No Verification Execution**: As a read-only explorer agent, no code changes or test executions were performed directly by this agent. All findings are based on rigorous static analysis and synthesis of previous handoff reports.

## 4. Conclusion
- The gate failure in Iteration 7 was caused by a missing configuration (`health_timeout = "10m"`) in `supabase/config.toml` and concurrency defects (lock starvation and premature process termination) in `e2e/run_e2e.ts`.
- A bulletproof fix strategy has been formulated for Worker Gen 11 to surgically resolve these issues.

## 5. Verification Method
To independently verify the fixes once Worker Gen 11 implements them, execute the following commands from `/usr/local/google/home/duynguyenn/expense-dashboard`:

1. **Verify `supabase/config.toml`**:
   ```bash
   grep "health_timeout" supabase/config.toml
   ```
   - **Expected Result**: `health_timeout = "10m"` under `[db]`.

2. **Verify Full Verification Chain & Linting**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm run lint && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
   ```
   - **Expected Result**: All tests pass successfully with exit code 0, and `npm run lint` completes with 0 errors.

---

## Precise, Line-by-Line Replacement Instructions for Worker Gen 11

Worker Gen 11 must use `replace_file_content` to apply the following precise edits:

### Edit 1: `supabase/config.toml`
**Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/supabase/config.toml`
**StartLine**: 27
**EndLine**: 36
**TargetContent**:
```toml
[db]
# Port to use for the local database URL.
port = 25432
# Port used by db diff command to initialize the shadow database.
shadow_port = 54320
# Maximum amount of time to wait for health check when starting the local database.
# The database major version to use. This has to be the same as your remote database's. Run `SHOW
# server_version;` on the remote database to check.
major_version = 17
```
**ReplacementContent**:
```toml
[db]
# Port to use for the local database URL.
port = 25432
# Port used by db diff command to initialize the shadow database.
shadow_port = 54320
# Maximum amount of time to wait for health check when starting the local database.
health_timeout = "10m"
# The database major version to use. This has to be the same as your remote database's. Run `SHOW
# server_version;` on the remote database to check.
major_version = 17
```

### Edit 2: `e2e/run_e2e.ts` (acquireLock)
**Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
**StartLine**: 17
**EndLine**: 52
**TargetContent**:
```typescript
function acquireLock() {
  console.log('Acquiring file-based mutex lock (/tmp/run_e2e.lock)...');
  let attempts = 360;
  while (attempts > 0) {
    try {
      if (fs.existsSync(lockfile)) {
        const pidStr = fs.readFileSync(lockfile, 'utf8').trim();
        const pid = Number(pidStr);
        if (pid > 0) {
          try {
            process.kill(pid, 0);
            console.log(`Another run_e2e instance (PID ${pid}) is active. Waiting for lock... (${attempts} attempts left)`);
            try { execSync('sleep 5', { stdio: 'inherit' }); } catch(err){}
            attempts--;
            continue;
          } catch (e) {
            console.log(`Stale lock file detected (PID ${pid} is dead). Removing stale lock...`);
            try { fs.unlinkSync(lockfile); } catch(err){}
          }
        } else {
          console.log(`Invalid PID in lock file (${pidStr}). Removing invalid lock...`);
          try { fs.unlinkSync(lockfile); } catch(err){}
        }
      }
      fs.writeFileSync(lockfile, process.pid.toString(), { flag: 'wx' });
      console.log('Mutex lock acquired successfully.');
      lockAcquired = true;
      return;
    } catch (e) {
      console.log(`Collision during lock acquisition. Waiting for lock... (${attempts} attempts left)`);
      try { execSync('sleep 5', { stdio: 'inherit' }); } catch(err){}
      attempts--;
    }
  }
  throw new Error('Failed to acquire mutex lock /tmp/run_e2e.lock after 5 minutes. Aborting to prevent process collision.');
}
```
**ReplacementContent**:
```typescript
function acquireLock() {
  console.log('Acquiring file-based mutex lock (/tmp/run_e2e.lock)...');
  let attempts = 1440;
  while (attempts > 0) {
    try {
      if (fs.existsSync(lockfile)) {
        const pidStr = fs.readFileSync(lockfile, 'utf8').trim();
        const pid = Number(pidStr);
        if (pid > 0) {
          try {
            process.kill(pid, 0);
            console.log(`Another run_e2e instance (PID ${pid}) is active. Waiting for lock... (${attempts} attempts left)`);
            try { execSync('sleep 5', { stdio: 'inherit' }); } catch(err){}
            attempts--;
            continue;
          } catch (e) {
            console.log(`Stale lock file detected (PID ${pid} is dead). Removing stale lock...`);
            try { fs.unlinkSync(lockfile); } catch(err){}
          }
        } else {
          console.log(`Invalid PID in lock file (${pidStr}). Removing invalid lock...`);
          try { fs.unlinkSync(lockfile); } catch(err){}
        }
      }
      fs.writeFileSync(lockfile, process.pid.toString(), { flag: 'wx' });
      console.log('Mutex lock acquired successfully.');
      lockAcquired = true;
      return;
    } catch (e) {
      console.log(`Collision during lock acquisition. Waiting for lock... (${attempts} attempts left)`);
      try { execSync('sleep 5', { stdio: 'inherit' }); } catch(err){}
      attempts--;
    }
  }
  throw new Error('Failed to acquire mutex lock /tmp/run_e2e.lock after 2 hours. Aborting to prevent process collision.');
}
```

### Edit 3: `e2e/run_e2e.ts` (killLingeringProcessesScoped & teardownSupabase)
**Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
**StartLine**: 66
**EndLine**: 141
**TargetContent**:
```typescript
function killLingeringProcessesScoped(pattern: string) {
  try {
    const myTty = execSync(`ps -p ${process.pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
    if (!myTty || myTty === '?' || myTty === '') {
      console.log(`Running without a TTY (${myTty}). Skipping global pkill to avoid process elimination war.`);
      return;
    }
    const ancestorPids = new Set<number>([process.pid, process.ppid]);
    let currentAncestor = process.ppid;
    while (currentAncestor > 1) {
      try {
        const ppidStr = execSync(`ps -o ppid= -p ${currentAncestor} 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
        const ppid = Number(ppidStr);
        if (ppid > 0 && ppid !== currentAncestor) {
          ancestorPids.add(ppid);
          currentAncestor = ppid;
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    }
    const pids = execSync(`pgrep -f "${pattern}" 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
    const pidsToKill = pids.filter(pid => {
      if (ancestorPids.has(pid)) return false;
      try {
        const args = execSync(`ps -p ${pid} -o args= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
        if (args.includes('run_e2e') || args.includes('verify_') || args.includes('stress_test_') || args.includes('adv_') || args.includes('playwright') || args.includes('next')) {
          return false;
        }
        const pTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
        return pTty === myTty;
      } catch (e) {
        return false;
      }
    });
    if (pidsToKill.length > 0) {
      console.log(`Killing lingering processes (${pattern}) scoped to TTY ${myTty}: ${pidsToKill.join(' ')}`);
      execSync(`kill -9 ${pidsToKill.join(' ')} 2>/dev/null || true`, { stdio: 'inherit' });
    }
  } catch (e) {}
}

function teardownSupabase() {
  console.log('Performing bulletproof Supabase teardown and cleanup...');
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  
  // 1. Explicitly force-remove supabase_db_expense-dashboard by name to resolve lingering container conflicts
  try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  
  // 2. Robust cleanup of all docker containers matching 'supabase' BEFORE network removal
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -a -q --filter name=supabase | grep -q .; do docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true; sleep 2; done', { stdio: 'ignore', timeout: 10000 }); } catch(e){}
  
  // 3. Volume and network cleanup
  try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker network ls -q --filter name=supabase | xargs -r docker network rm 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  
  // 4. Robust cleanup of docker containers AFTER network removal to catch any lingering containers in Creating/Created states
  try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}

  // 5. Targeted process killing with strict filtering to avoid terminating task runners, jetski, gemini, or E2E scripts
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  const killCmd = 'ps aux | grep -i supabase | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_supabase | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
  try { execSync(killCmd, { stdio: 'inherit' }); } catch(e){}
  
  try { execSync('sleep 2', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
}
```
**ReplacementContent**:
```typescript
function killLingeringProcessesScoped(pattern: string) {
  try {
    const myTty = execSync(`ps -p ${process.pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
    if (!myTty || myTty === '?' || myTty === '') {
      console.log(`Running without a TTY (${myTty}). Skipping global pkill to avoid process elimination war.`);
      return;
    }
    
    const protectedPids = new Set<number>([process.pid, process.ppid]);
    try {
      const matchingPids = execSync(`pgrep -f "run_e2e|verify_|stress_test_|adv_|playwright|next|task|jetski|gemini" 2>/dev/null || true`, { encoding: 'utf-8' })
        .split('\n').map(p => p.trim()).filter(Boolean).map(Number);
      matchingPids.forEach(pid => protectedPids.add(pid));
    } catch (e) {}

    const currentProtected = Array.from(protectedPids);
    for (const pid of currentProtected) {
      let currentAncestor = pid;
      while (currentAncestor > 1) {
        try {
          const ppidStr = execSync(`ps -o ppid= -p ${currentAncestor} 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
          const ppid = Number(ppidStr);
          if (ppid > 0 && ppid !== currentAncestor) {
            protectedPids.add(ppid);
            currentAncestor = ppid;
          } else {
            break;
          }
        } catch (e) {
          break;
        }
      }
    }

    for (const pid of currentProtected) {
      try {
        const childPids = execSync(`pgrep -P ${pid} 2>/dev/null || true`, { encoding: 'utf-8' })
          .split('\n').map(p => p.trim()).filter(Boolean).map(Number);
        childPids.forEach(cpid => {
          protectedPids.add(cpid);
          try {
            const grandChildPids = execSync(`pgrep -P ${cpid} 2>/dev/null || true`, { encoding: 'utf-8' })
              .split('\n').map(p => p.trim()).filter(Boolean).map(Number);
            grandChildPids.forEach(gcpid => protectedPids.add(gcpid));
          } catch (e) {}
        });
      } catch (e) {}
    }

    const pids = execSync(`pgrep -f "${pattern}" 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
    const pidsToKill = pids.filter(pid => {
      if (protectedPids.has(pid)) return false;
      try {
        const args = execSync(`ps -p ${pid} -o args= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
        if (args.includes('run_e2e') || args.includes('verify_') || args.includes('stress_test_') || args.includes('adv_') || args.includes('playwright') || args.includes('next') || args.includes('task') || args.includes('jetski') || args.includes('gemini')) {
          return false;
        }
        const pTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
        return pTty === myTty;
      } catch (e) {
        return false;
      }
    });
    if (pidsToKill.length > 0) {
      console.log(`Killing lingering processes (${pattern}) scoped to TTY ${myTty}: ${pidsToKill.join(' ')}`);
      execSync(`kill -9 ${pidsToKill.join(' ')} 2>/dev/null || true`, { stdio: 'inherit' });
    }
  } catch (e) {}
}

function teardownSupabase() {
  console.log('Performing bulletproof Supabase teardown and cleanup...');
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  
  // 1. Explicitly force-remove supabase_db_expense-dashboard by name to resolve lingering container conflicts
  try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  
  // 2. Robust cleanup of all docker containers matching 'supabase' BEFORE network removal
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -a -q --filter name=supabase | grep -q .; do docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true; sleep 2; done', { stdio: 'ignore', timeout: 10000 }); } catch(e){}
  
  // 3. Volume and network cleanup
  try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker network ls -q --filter name=supabase | xargs -r docker network rm 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  
  // 4. Robust cleanup of docker containers AFTER network removal to catch any lingering containers in Creating/Created states
  try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}

  // 5. Targeted process killing with strict filtering to avoid terminating task runners, jetski, gemini, or E2E scripts
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  const killCmd = 'ps aux | grep -i supabase | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v stress_test_ | grep -v playwright | grep -v next | grep -v node | grep -v tsx | grep -v sleep | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
  try { execSync(killCmd, { stdio: 'inherit' }); } catch(e){}
  
  try { execSync('sleep 2', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
}
```
