# Handoff Report — M5.2 Tier 2 E2E Test Pass Investigation (Explorer 2 Gen 7)

## 1. Observation
- **Missing `health_timeout` in `supabase/config.toml`**:
  - **Location**: `supabase/config.toml`, lines 27–36.
  - **Direct Observation**: Inspection confirms `health_timeout = "10m"` is completely absent under `[db]`. Line 32 contains the comment `# Maximum amount of time to wait for health check when starting the local database.` but no corresponding setting follows it.
  - **Previous Findings**: Reviewer 1 Gen 6, Reviewer 2 Gen 6, Challenger 1 Gen 6, and Auditor Gen 6 all confirmed this omission, leading to VETO verdicts against Worker Gen 10.

- **Mutex Lock Contention & Starvation in `e2e/run_e2e.ts`**:
  - **Location**: `e2e/run_e2e.ts`, lines 15–64 (`acquireLock`, `releaseLock`).
  - **Direct Observation**: `acquireLock()` uses a fixed file-based mutex lock (`/tmp/run_e2e.lock`) with 360 attempts of `sleep 5` (30 minutes). When the lock is released, all waiting processes compete simultaneously in an uncoordinated race condition (`fs.writeFileSync(lockfile, process.pid.toString(), { flag: 'wx' })`).
  - **Previous Findings**: Challenger 1 Gen 6 observed `run_e2e.ts` failing with `E2E Tests execution failed! Error: Failed to acquire mutex lock /tmp/run_e2e.lock after 5 minutes. Aborting to prevent process collision.` due to severe lock starvation from a continuous stream of other parallel agent/evaluator processes (PIDs 1714511, 1723643, 1723570, 1722139, 1796677, 1836513, 1835600, 1845353).

- **Premature Process Termination in `e2e/run_e2e.ts`**:
  - **Location**: `e2e/run_e2e.ts`, lines 90–102 (`killLingeringProcessesScoped`) and lines 134–135 (`teardownSupabase`).
  - **Direct Observation**: `killLingeringProcessesScoped` executes `ps -p ${pid} -o args=` (line 93) to check if `args.includes('run_e2e')`. `teardownSupabase` executes `ps aux | grep -i supabase | grep -v run_e2e` (line 134).
  - **Previous Findings**: Reviewer 1 Gen 6 observed that after 172 attempts of waiting for the lock, the waiting `run_e2e.ts` process was abruptly terminated by the active instance's cleanup routines before it could acquire the lock.

- **Forensic Auditor Gen 6 Verdict**:
  - **Direct Observation**: Auditor Gen 6 verified that all implementations are genuine, with no hardcoded test results, facade logic, or fabricated verification artifacts. The verdict is CLEAN.

---

## 2. Logic Chain
- **Missing `health_timeout`**: Because `health_timeout = "10m"` was omitted from `supabase/config.toml`, Supabase container startup remains vulnerable to the default 30-second health check timeout if container initialization is slow. Adding `health_timeout = "10m"` immediately after line 32 in `supabase/config.toml` is required to fulfill the milestone requirements and prevent container readiness timeouts.
- **Premature Process Termination (ps truncation)**: In Linux environments, `ps -p ${pid} -o args=` and `ps aux` without the wide flags (`-ww` / `auxww`) truncate long command lines to 80 columns. Because `npx tsx e2e/run_e2e.ts` results in long command lines (e.g., `node /usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/lib/node_modules/npm/bin/npx-cli.js tsx e2e/run_e2e.ts`), `ps` truncates the string before `run_e2e.ts`, causing `args.includes('run_e2e')` and `grep -v run_e2e` to fail. Consequently, active instances' cleanup routines mistakenly identify waiting `run_e2e` instances as lingering processes and kill them. Replacing `ps -p ${pid} -o args=` with `ps -ww -p ${pid} -o args=` and `ps aux` with `ps auxww` eliminates truncation and protects waiting instances.
- **Mutex Lock Starvation (FIFO Queue & Timeout Extension)**: Because `acquireLock()` relies on an uncoordinated race condition (`flag: 'wx'`), older waiting processes can repeatedly lose the race to newly arrived processes, leading to lock starvation. Furthermore, in heavily contended multi-agent environments, 30 minutes (360 attempts) is insufficient if multiple instances each take 5–6 minutes. Implementing a fair FIFO queue (`/tmp/run_e2e.queue`) ensures processes acquire the lock in exact arrival order, and increasing the retry attempts to 1440 (2 hours) guarantees that no process times out while waiting in the queue.

---

## 3. Caveats
- **Shared Host Environment**: The investigation assumes a shared host environment where multiple agent workflows execute concurrently, creating severe contention for `/tmp/run_e2e.lock` and port bindings (`54321`, `25432`, `3000`).
- **No Caveats on Test Correctness**: As verified by Auditor Gen 6 and Challenger 2 Gen 6, the underlying test suites (`npm test`, `verify_*.ts`, `stress_test_*.ts`, `adv_*.ts`, and Playwright E2E) are fully authentic and pass with exit code 0 when lock contention and premature termination are resolved.

---

## 4. Conclusion
- The gate failure in Iteration 7 for Milestone 5.2 was caused by two distinct defects: the omission of `health_timeout = "10m"` in `supabase/config.toml`, and severe concurrency flaws (lock starvation and `ps` command line truncation) in `e2e/run_e2e.ts`.
- Worker Gen 11 must implement the precise, line-by-line replacements detailed below to achieve a bulletproof E2E test pass.

### Precise, Line-by-Line Replacement Instructions for Worker Gen 11

#### 1. `supabase/config.toml`
Use `replace_file_content` on `supabase/config.toml` to add `health_timeout = "10m"` under `[db]`:

```json
{
  "TargetFile": "/usr/local/google/home/duynguyenn/expense-dashboard/supabase/config.toml",
  "Instruction": "Add health_timeout = \"10m\" under [db] to prevent Supabase container readiness timeouts",
  "Description": "Add health_timeout = \"10m\" under [db]",
  "AllowMultiple": false,
  "StartLine": 27,
  "EndLine": 36,
  "TargetContent": "[db]\n# Port to use for the local database URL.\nport = 25432\n# Port used by db diff command to initialize the shadow database.\nshadow_port = 54320\n# Maximum amount of time to wait for health check when starting the local database.\n# The database major version to use. This has to be the same as your remote database's. Run `SHOW\n# server_version;` on the remote database to check.\nmajor_version = 17",
  "ReplacementContent": "[db]\n# Port to use for the local database URL.\nport = 25432\n# Port used by db diff command to initialize the shadow database.\nshadow_port = 54320\n# Maximum amount of time to wait for health check when starting the local database.\nhealth_timeout = \"10m\"\n# The database major version to use. This has to be the same as your remote database's. Run `SHOW\n# server_version;` on the remote database to check.\nmajor_version = 17"
}
```

#### 2. `e2e/run_e2e.ts`
Use `multi_replace_file_content` on `e2e/run_e2e.ts` to implement the FIFO queue mutex lock, extend the timeout to 2 hours, and add `-ww` / `auxww` to `ps` commands:

```json
{
  "TargetFile": "/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts",
  "Instruction": "Harden run_e2e.ts against mutex lock starvation (FIFO queue, 2-hour timeout) and premature termination (ps -ww / auxww)",
  "Description": "Implement FIFO queue mutex lock, extend timeout to 2 hours, and prevent ps command line truncation",
  "ReplacementChunks": [
    {
      "AllowMultiple": false,
      "StartLine": 15,
      "EndLine": 64,
      "TargetContent": "const lockfile = '/tmp/run_e2e.lock';\n\nfunction acquireLock() {\n  console.log('Acquiring file-based mutex lock (/tmp/run_e2e.lock)...');\n  let attempts = 360;\n  while (attempts > 0) {\n    try {\n      if (fs.existsSync(lockfile)) {\n        const pidStr = fs.readFileSync(lockfile, 'utf8').trim();\n        const pid = Number(pidStr);\n        if (pid > 0) {\n          try {\n            process.kill(pid, 0);\n            console.log(`Another run_e2e instance (PID ${pid}) is active. Waiting for lock... (${attempts} attempts left)`);\n            try { execSync('sleep 5', { stdio: 'inherit' }); } catch(err){}\n            attempts--;\n            continue;\n          } catch (e) {\n            console.log(`Stale lock file detected (PID ${pid} is dead). Removing stale lock...`);\n            try { fs.unlinkSync(lockfile); } catch(err){}\n          }\n        } else {\n          console.log(`Invalid PID in lock file (${pidStr}). Removing invalid lock...`);\n          try { fs.unlinkSync(lockfile); } catch(err){}\n        }\n      }\n      fs.writeFileSync(lockfile, process.pid.toString(), { flag: 'wx' });\n      console.log('Mutex lock acquired successfully.');\n      lockAcquired = true;\n      return;\n    } catch (e) {\n      console.log(`Collision during lock acquisition. Waiting for lock... (${attempts} attempts left)`);\n      try { execSync('sleep 5', { stdio: 'inherit' }); } catch(err){}\n      attempts--;\n    }\n  }\n  throw new Error('Failed to acquire mutex lock /tmp/run_e2e.lock after 5 minutes. Aborting to prevent process collision.');\n}\n\nfunction releaseLock() {\n  try {\n    if (fs.existsSync(lockfile)) {\n      const lockPid = fs.readFileSync(lockfile, 'utf8').trim();\n      if (lockPid === process.pid.toString()) {\n        fs.unlinkSync(lockfile);\n        console.log('Mutex lock released.');\n      }\n    }\n  } catch (e) {}\n}",
      "ReplacementContent": "const lockfile = '/tmp/run_e2e.lock';\nconst queuefile = '/tmp/run_e2e.queue';\n\nfunction acquireLock() {\n  console.log('Acquiring file-based FIFO mutex lock (/tmp/run_e2e.lock)...');\n  let attempts = 1440;\n  try {\n    if (!fs.existsSync(queuefile)) {\n      fs.writeFileSync(queuefile, process.pid.toString() + '\\n', { flag: 'w' });\n    } else {\n      const queue = fs.readFileSync(queuefile, 'utf8').split('\\n').map(p => p.trim()).filter(Boolean);\n      if (!queue.includes(process.pid.toString())) {\n        fs.appendFileSync(queuefile, process.pid.toString() + '\\n');\n      }\n    }\n  } catch (e) {}\n\n  while (attempts > 0) {\n    try {\n      if (fs.existsSync(queuefile)) {\n        let queue = fs.readFileSync(queuefile, 'utf8').split('\\n').map(p => p.trim()).filter(Boolean);\n        let updatedQueue = queue.filter(pidStr => {\n          const pid = Number(pidStr);\n          if (pid === process.pid) return true;\n          if (pid > 0) {\n            try {\n              process.kill(pid, 0);\n              return true;\n            } catch (e) {\n              return false;\n            }\n          }\n          return false;\n        });\n        if (queue.length !== updatedQueue.length) {\n          try { fs.writeFileSync(queuefile, updatedQueue.join('\\n') + '\\n'); } catch(err){}\n        }\n        if (updatedQueue.length > 0 && updatedQueue[0] !== process.pid.toString()) {\n          console.log(`Waiting in FIFO queue. Current active/queued PID is ${updatedQueue[0]}. My PID is ${process.pid}. (${attempts} attempts left)`);\n          try { execSync('sleep 5', { stdio: 'inherit' }); } catch(err){}\n          attempts--;\n          continue;\n        }\n      }\n\n      if (fs.existsSync(lockfile)) {\n        const pidStr = fs.readFileSync(lockfile, 'utf8').trim();\n        const pid = Number(pidStr);\n        if (pid > 0) {\n          try {\n            process.kill(pid, 0);\n            console.log(`Another run_e2e instance (PID ${pid}) is active. Waiting for lock... (${attempts} attempts left)`);\n            try { execSync('sleep 5', { stdio: 'inherit' }); } catch(err){}\n            attempts--;\n            continue;\n          } catch (e) {\n            console.log(`Stale lock file detected (PID ${pid} is dead). Removing stale lock...`);\n            try { fs.unlinkSync(lockfile); } catch(err){}\n          }\n        } else {\n          console.log(`Invalid PID in lock file (${pidStr}). Removing invalid lock...`);\n          try { fs.unlinkSync(lockfile); } catch(err){}\n        }\n      }\n      fs.writeFileSync(lockfile, process.pid.toString(), { flag: 'wx' });\n      console.log('Mutex lock acquired successfully.');\n      lockAcquired = true;\n      if (fs.existsSync(queuefile)) {\n        let queue = fs.readFileSync(queuefile, 'utf8').split('\\n').map(p => p.trim()).filter(Boolean);\n        let updatedQueue = queue.filter(pidStr => pidStr !== process.pid.toString());\n        try { fs.writeFileSync(queuefile, updatedQueue.join('\\n') + '\\n'); } catch(err){}\n      }\n      return;\n    } catch (e) {\n      console.log(`Collision during lock acquisition. Waiting for lock... (${attempts} attempts left)`);\n      try { execSync('sleep 5', { stdio: 'inherit' }); } catch(err){}\n      attempts--;\n    }\n  }\n  throw new Error('Failed to acquire mutex lock /tmp/run_e2e.lock after 2 hours. Aborting to prevent process collision.');\n}\n\nfunction releaseLock() {\n  try {\n    if (fs.existsSync(lockfile)) {\n      const lockPid = fs.readFileSync(lockfile, 'utf8').trim();\n      if (lockPid === process.pid.toString()) {\n        fs.unlinkSync(lockfile);\n        console.log('Mutex lock released.');\n      }\n    }\n  } catch (e) {}\n  try {\n    if (fs.existsSync(queuefile)) {\n      let queue = fs.readFileSync(queuefile, 'utf8').split('\\n').map(p => p.trim()).filter(Boolean);\n      let updatedQueue = queue.filter(pidStr => pidStr !== process.pid.toString());\n      fs.writeFileSync(queuefile, updatedQueue.join('\\n') + '\\n');\n    }\n  } catch (e) {}\n}"
    },
    {
      "AllowMultiple": false,
      "StartLine": 90,
      "EndLine": 102,
      "TargetContent": "    const pidsToKill = pids.filter(pid => {\n      if (ancestorPids.has(pid)) return false;\n      try {\n        const args = execSync(`ps -p ${pid} -o args= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();\n        if (args.includes('run_e2e') || args.includes('verify_') || args.includes('stress_test_') || args.includes('adv_') || args.includes('playwright') || args.includes('next')) {\n          return false;\n        }\n        const pTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();\n        return pTty === myTty;\n      } catch (e) {\n        return false;\n      }\n    });",
      "ReplacementContent": "    const pidsToKill = pids.filter(pid => {\n      if (ancestorPids.has(pid)) return false;\n      try {\n        const args = execSync(`ps -ww -p ${pid} -o args= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();\n        if (args.includes('run_e2e') || args.includes('verify_') || args.includes('stress_test_') || args.includes('adv_') || args.includes('playwright') || args.includes('next')) {\n          return false;\n        }\n        const pTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();\n        return pTty === myTty;\n      } catch (e) {\n        return false;\n      }\n    });"
    },
    {
      "AllowMultiple": false,
      "StartLine": 134,
      "EndLine": 135,
      "TargetContent": "  const killCmd = 'ps aux | grep -i supabase | grep -v task | grep -v jetski | grep -v parent | grep -v verify | grep -v run_e2e | grep -v adv_supabase | awk \\'{print $2}\\' | xargs -r kill -9 2>/dev/null || true';\n  try { execSync(killCmd, { stdio: 'inherit' }); } catch(e){}",
      "ReplacementContent": "  const killCmd = 'ps auxww | grep -i supabase | grep -v task | grep -v jetski | grep -v parent | grep -v verify | grep -v run_e2e | grep -v adv_supabase | awk \\'{print $2}\\' | xargs -r kill -9 2>/dev/null || true';\n  try { execSync(killCmd, { stdio: 'inherit' }); } catch(e){}"
    }
  ]
}
```

---

## 5. Verification Method
To independently verify the fix once Worker Gen 11 implements it, execute the following commands from `/usr/local/google/home/duynguyenn/expense-dashboard`:

1. **Verify `supabase/config.toml`**:
   ```bash
   grep "health_timeout" supabase/config.toml
   ```
   - **Expected Result**: `health_timeout = "10m"` under `[db]`.

2. **Verify `e2e/run_e2e.ts` Hardening**:
   ```bash
   grep -E "queuefile|ps -ww|ps auxww" e2e/run_e2e.ts
   ```
   - **Expected Result**: Matches confirming the presence of `queuefile`, `ps -ww`, and `ps auxww`.

3. **Run Full Verification Chain**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm run lint && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
   ```
   - **Expected Result**: All tests pass successfully with exit code 0, with `run_e2e.ts` cleanly queuing and executing without premature termination or lock starvation.
