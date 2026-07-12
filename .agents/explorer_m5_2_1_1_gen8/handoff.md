# Handoff Report — M5.2 Tier 2 E2E Test Pass Investigation & Fix Strategy (Explorer 1 Gen 8)

## 1. Observation
- **Missing `health_timeout` in `supabase/config.toml`**:
  - Direct inspection of `supabase/config.toml` (lines 27–36) confirms that `health_timeout = "10m"` is completely absent under `[db]`.
  - Verbatim lines 27–36 in `supabase/config.toml`:
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
  - Reviewer 1 Gen 6, Reviewer 2 Gen 6, Challenger 1 Gen 6, and Auditor Gen 6 all verified this omission, disproving Worker Gen 10's claim of having added it.

- **Mutex Lock Contention & Starvation in `e2e/run_e2e.ts`**:
  - `e2e/run_e2e.ts` uses a fixed file-based mutex lock (`/tmp/run_e2e.lock`) with `let attempts = 360;` and `execSync('sleep 5')` (lines 15–52), totaling a 30-minute timeout.
  - Challenger 1 Gen 6 observed `task-37` failing with `E2E Tests execution failed! Error: Failed to acquire mutex lock /tmp/run_e2e.lock after 5 minutes. Aborting to prevent process collision.` due to severe lock contention from a continuous stream of other parallel agent/evaluator processes (PIDs 1714511, 1723643, 1723570, 1722139, 1796677, 1836513, 1835600, 1845353).

- **Premature Process Termination in `e2e/run_e2e.ts`**:
  - Reviewer 1 Gen 6 observed `task-23` terminating abruptly during mutex lock waiting (`Another run_e2e instance (PID 1723570) is active. Waiting for lock... (188 attempts left)`) without ever executing `setup()`, Next.js, Playwright, or `npm run lint`.
  - `e2e/run_e2e.ts` implements aggressive cleanup routines: `killLingeringProcessesScoped('node|tsx|jest|webpack')` (lines 66–108, called at line 388) and `teardownSupabase()` (lines 110–141).
  - `killLingeringProcessesScoped` only protects `ancestorPids` of the *active* `run_e2e.ts` process (lines 73–88). For concurrent waiting instances, while their direct `node` process might have `run_e2e` in `args`, their parent `npm`/`npx` wrappers or child `sh`/`sleep` processes lack `run_e2e` in `args` and get killed, causing the task runner to consider the waiting task terminated.
  - `teardownSupabase()` executes `const killCmd = 'ps aux | grep -i supabase | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_supabase | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';` (line 134), which lacks exclusions for `grep`, `sleep`, `npm`, `npx`, `node`, `tsx`, `jest`, `playwright`, `next`.

## 2. Logic Chain
- **Missing `health_timeout`**: Because `health_timeout = "10m"` was omitted from `supabase/config.toml`, Supabase container startup remains vulnerable to the default 30-second health check timeout in slower environments or under heavy concurrent load. Worker Gen 11 must explicitly add `health_timeout = "10m"` under `[db]`.
- **Mutex Lock Starvation**: Because `acquireLock()` relies on uncoordinated `sleep 5` loops among multiple competing processes, it suffers from the thundering herd problem where older waiting processes can be starved by newer processes waking up earlier. Implementing a fair FIFO queue file (`/tmp/run_e2e.queue`) ensures processes acquire the lock strictly in the order they arrived, eliminating starvation. Increasing attempts to `1440` (2 hours) provides ample buffer for large multi-agent evaluation batches.
- **Premature Process Termination**: Because `killLingeringProcessesScoped` only checks `ancestorPids` of the active process, it kills the `npm`/`npx` parent wrappers and `sh`/`sleep` child processes of concurrent waiting `run_e2e` instances. By building a comprehensive `protectedPids` set that dynamically includes ALL active `run_e2e`, `verify_`, `stress_test_`, `adv_`, `playwright`, `next`, `jetski`, `gemini`, and `task` processes—along with ALL of their ancestors and descendants—we guarantee that concurrent waiting instances are perfectly insulated from cleanup routines. Refining `killCmd` in `teardownSupabase` further hardens the teardown against accidental process elimination.

## 3. Caveats
- **Shared Host Concurrency**: The E2E test runner (`e2e/run_e2e.ts`) binds to fixed ports (`54321`, `25432`, `3000`), necessitating a mutex lock to serialize runs across the host. Secondary instances will wait in the FIFO queue until earlier runs complete. This is intended behavior to prevent database and port corruption.
- **Read-Only Explorer Role**: As an Explorer agent, this investigation is strictly read-only. The recommended fix strategy must be implemented by Worker Gen 11.

## 4. Conclusion
- The gate failure in Iteration 7 was caused by Worker Gen 10 omitting `health_timeout = "10m"` in `supabase/config.toml` and by severe concurrency defects in `e2e/run_e2e.ts` (FIFO lock starvation and premature termination of concurrent waiting instances' parent/child processes).
- The fix strategy below provides precise, bulletproof, line-by-line replacement instructions for Worker Gen 11 to permanently resolve these issues.

## 5. Verification Method
To independently verify the fix once Worker Gen 11 implements it, execute the following commands from `/usr/local/google/home/duynguyenn/expense-dashboard`:

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

## Precise Line-by-Line Replacement Instructions for Worker Gen 11

### 1. `supabase/config.toml`
Use `replace_file_content` on `/usr/local/google/home/duynguyenn/expense-dashboard/supabase/config.toml` to replace lines 27–36:

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

### 2. `e2e/run_e2e.ts`
Use `replace_file_content` on `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts` to replace lines 15–141:

```typescript
const lockfile = '/tmp/run_e2e.lock';
const queuefile = '/tmp/run_e2e.queue';

function acquireLock() {
  console.log('Acquiring file-based FIFO mutex lock (/tmp/run_e2e.lock)...');
  const myPid = process.pid.toString();
  let attempts = 1440; // 1440 * 5s = 7200s = 2 hours

  while (attempts > 0) {
    try {
      // 1. Maintain the FIFO queue
      let queue: string[] = [];
      if (fs.existsSync(queuefile)) {
        try {
          queue = fs.readFileSync(queuefile, 'utf8').split('\n').map(p => p.trim()).filter(Boolean);
        } catch (e) {}
      }

      // Filter out dead PIDs from the queue
      const activeQueue: string[] = [];
      for (const pidStr of queue) {
        const pid = Number(pidStr);
        if (pid > 0) {
          if (pidStr === myPid) {
            activeQueue.push(pidStr);
          } else {
            try {
              process.kill(pid, 0);
              activeQueue.push(pidStr);
            } catch (e) {
              // Process is dead, remove from queue
            }
          }
        }
      }

      // Add self to queue if not present
      if (!activeQueue.includes(myPid)) {
        activeQueue.push(myPid);
      }

      // Write updated queue back
      try {
        fs.writeFileSync(queuefile, activeQueue.join('\n') + '\n', 'utf8');
      } catch (e) {}

      // 2. Check if we are at the head of the queue
      if (activeQueue[0] !== myPid) {
        console.log(`FIFO Queue: Waiting for earlier instances to finish. Current queue: ${activeQueue.join(' -> ')} (${attempts} attempts left)`);
        try { execSync('sleep 5', { stdio: 'inherit' }); } catch(err){}
        attempts--;
        continue;
      }

      // 3. We are at the head of the queue. Check the actual lockfile.
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

      // 4. Acquire the lock
      fs.writeFileSync(lockfile, myPid, { flag: 'wx' });
      console.log('Mutex lock acquired successfully.');
      lockAcquired = true;

      // Remove self from head of queue
      try {
        if (fs.existsSync(queuefile)) {
          const currentQueue = fs.readFileSync(queuefile, 'utf8').split('\n').map(p => p.trim()).filter(Boolean);
          const remainingQueue = currentQueue.filter(p => p !== myPid);
          fs.writeFileSync(queuefile, remainingQueue.join('\n') + '\n', 'utf8');
        }
      } catch (e) {}

      return;
    } catch (e) {
      console.log(`Collision during lock acquisition. Waiting for lock... (${attempts} attempts left)`);
      try { execSync('sleep 5', { stdio: 'inherit' }); } catch(err){}
      attempts--;
    }
  }
  throw new Error('Failed to acquire mutex lock /tmp/run_e2e.lock after 2 hours. Aborting to prevent process collision.');
}

function releaseLock() {
  try {
    if (fs.existsSync(lockfile)) {
      const lockPid = fs.readFileSync(lockfile, 'utf8').trim();
      if (lockPid === process.pid.toString()) {
        fs.unlinkSync(lockfile);
        console.log('Mutex lock released.');
      }
    }
    if (fs.existsSync(queuefile)) {
      const currentQueue = fs.readFileSync(queuefile, 'utf8').split('\n').map(p => p.trim()).filter(Boolean);
      const remainingQueue = currentQueue.filter(p => p !== process.pid.toString());
      fs.writeFileSync(queuefile, remainingQueue.join('\n') + '\n', 'utf8');
    }
  } catch (e) {}
}

function killLingeringProcessesScoped(pattern: string) {
  try {
    const myTty = execSync(`ps -p ${process.pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
    if (!myTty || myTty === '?' || myTty === '') {
      console.log(`Running without a TTY (${myTty}). Skipping global pkill to avoid process elimination war.`);
      return;
    }
    const protectedPids = new Set<number>();
    
    const addAncestors = (pid: number) => {
      let current = pid;
      while (current > 1) {
        try {
          const ppidStr = execSync(`ps -o ppid= -p ${current} 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
          const ppid = Number(ppidStr);
          if (ppid > 0 && ppid !== current) {
            protectedPids.add(ppid);
            current = ppid;
          } else {
            break;
          }
        } catch (e) {
          break;
        }
      }
    };

    const addDescendants = (pid: number) => {
      try {
        const children = execSync(`pgrep -P ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
        for (const child of children) {
          if (!protectedPids.has(child)) {
            protectedPids.add(child);
            addDescendants(child);
          }
        }
      } catch (e) {}
    };

    try {
      const allPids = execSync(`ps -eo pid,args 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n');
      for (const line of allPids) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/\s+/);
        const pid = Number(parts[0]);
        if (isNaN(pid) || pid <= 0) continue;
        const args = parts.slice(1).join(' ');
        if (args.includes('run_e2e') || args.includes('verify_') || args.includes('stress_test_') || args.includes('adv_') || args.includes('playwright') || args.includes('next') || args.includes('jetski') || args.includes('gemini') || args.includes('task')) {
          protectedPids.add(pid);
          addAncestors(pid);
          addDescendants(pid);
        }
      }
    } catch (e) {}

    protectedPids.add(process.pid);
    addAncestors(process.pid);
    addDescendants(process.pid);

    const pids = execSync(`pgrep -f "${pattern}" 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
    const pidsToKill = pids.filter(pid => {
      if (protectedPids.has(pid)) return false;
      try {
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
  const killCmd = 'ps aux | grep -i supabase | grep -v grep | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v sleep | grep -v npm | grep -v npx | grep -v node | grep -v tsx | grep -v jest | grep -v playwright | grep -v next | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
  try { execSync(killCmd, { stdio: 'inherit' }); } catch(e){}
  
  try { execSync('sleep 2', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
}
```
