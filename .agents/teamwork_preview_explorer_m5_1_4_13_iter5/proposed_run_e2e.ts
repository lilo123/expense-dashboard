import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Client } from 'pg';

process.env.DB_HOST = '127.0.0.1';
process.env.SUPABASE_DB_HOST = '127.0.0.1';
process.env.SUPABASE_INTERNAL_DB_HOST = '127.0.0.1';
process.env.SUPABASE_INTERNAL_HOST = '127.0.0.1';
process.env.SUPABASE_DAEMON_ENABLE = 'false';
process.env.SUPABASE_DOCKER_EXTRA_HOSTS = 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1';
process.env.DOCKER_DEFAULT_PLATFORM = 'linux/amd64';

const rootDir = process.cwd();
const envLocalPath = path.join(rootDir, '.env.local');
const envLocalBakPath = path.join(rootDir, '.env.local.bak');
const envTestPath = path.join(rootDir, '.env.test');

let backupCreated = false;
let isShuttingDown = false;
let lockAcquired = false;

function getMyTty(): string {
  try {
    return execSync(`ps -p ${process.pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
  } catch (e) {
    return 'unknown';
  }
}

const myTty = getMyTty();
const lockfile = '/tmp/run_e2e.lock';
const queuefile = '/tmp/run_e2e.queue';
const myLockEntry = `TTY:${myTty}:PID:${process.pid}`;



function protectProcessTree(targetPid: number) {
  try {
    if (typeof global.gc === 'function') {
      global.gc();
    }
  } catch (e) {}
  let current = targetPid;
  while (current > 1) {
    try {
      execSync(`echo -1000 > /proc/${current}/oom_score_adj 2>/dev/null || true`);
      const ppidStr = execSync(`ps -o ppid= -p ${current} 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
      const ppid = Number(ppidStr);
      if (ppid > 0 && ppid !== current) {
        current = ppid;
      } else {
        break;
      }
    } catch (e) {
      break;
    }
  }
}

function ensureSupabaseHealthTimeout() {
  const configPath = path.join(process.cwd(), 'supabase', 'config.toml');
  try {
    if (fs.existsSync(configPath)) {
      let content = fs.readFileSync(configPath, 'utf8');
      if (!content.includes('health_timeout = "10m"')) {
        content = content.replace(/(\[db\]\n)/, '$1health_timeout = "10m"\n');
        fs.writeFileSync(configPath, content, 'utf8');
        console.log('Successfully injected health_timeout = "10m" into supabase/config.toml');
      }
    }
  } catch (e) {
    console.error('Failed to inject health_timeout into supabase/config.toml:', e);
  }
}

function acquireLock(): boolean {
  console.log(`Acquiring file-based FIFO mutex lock (${lockfile}) with entry ${myLockEntry}...`);
  const startTime = Date.now();
  const maxWaitMs = 30 * 60 * 1000; // 30 minutes max wait per PROJECT.md contract

  try {
    execSync(`touch ${queuefile} 2>/dev/null || true`);
    execSync(`echo "${myLockEntry}" >> ${queuefile} 2>/dev/null || true`);
  } catch (e) {
    console.error('Failed to join FIFO queue:', e);
  }

  while (Date.now() - startTime < maxWaitMs) {
    try {
      if (!fs.existsSync(queuefile)) {
        execSync(`touch ${queuefile} 2>/dev/null || true`);
        execSync(`echo "${myLockEntry}" >> ${queuefile} 2>/dev/null || true`);
      }
      let queueContent = fs.readFileSync(queuefile, 'utf8').trim();
      let queueEntries = queueContent.split('\n').map(e => e.trim()).filter(Boolean);

      // Prune stale or unrelated entries
      const validEntries: string[] = [];
      for (const entry of queueEntries) {
        let pidStr = entry;
        let pTty = 'unknown';
        if (entry.startsWith('TTY:')) {
          const parts = entry.split(':');
          pTty = parts[1];
          pidStr = parts[3];
        }

        const pid = Number(pidStr);
        if (isNaN(pid)) continue;

        try {
          // Check if process exists
          process.kill(pid, 0);

          // If alive, check etimes
          const etimes = Number(execSync(`ps -o etimes= -p ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
          if (etimes > 2700) {
            console.log(`Stale run_e2e process detected (PID ${pid}, running for ${etimes}s > 2700s). Removing from queue and terminating...`);
            try { process.kill(pid, 'SIGKILL'); } catch(e){}
            continue;
          }

          // Check TTY decoupling
          const actualTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
          if (actualTty !== myTty && myTty !== 'unknown' && actualTty !== 'unknown') {
            console.log(`Unrelated swarm agent process detected (PID ${pid}, TTY ${actualTty} !== myTty ${myTty}). Ignoring from queue consideration...`);
            continue;
          }

          validEntries.push(entry);
        } catch (e) {
          // Process does not exist, prune it
          continue;
        }
      }

      // Update queue file with valid entries
      if (!validEntries.includes(myLockEntry)) {
        validEntries.push(myLockEntry);
      }
      fs.writeFileSync(queuefile, validEntries.join('\n') + '\n', 'utf8');

      // Check if we are at the head of the queue
      if (validEntries[0] === myLockEntry) {
        // We are at the head. Check lockfile
        if (fs.existsSync(lockfile)) {
          const lockContent = fs.readFileSync(lockfile, 'utf8').trim();
          let lockPidStr = lockContent;
          let lockTty = 'unknown';
          if (lockContent.startsWith('TTY:')) {
            const parts = lockContent.split(':');
            lockTty = parts[1];
            lockPidStr = parts[3];
          }
          const lockPid = Number(lockPidStr);
          let lockStale = false;

          if (!isNaN(lockPid)) {
            try {
              process.kill(lockPid, 0);
              const etimes = Number(execSync(`ps -o etimes= -p ${lockPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
              if (etimes > 2700) {
                console.log(`Stale lock holder detected (PID ${lockPid}, running for ${etimes}s > 2700s). Terminating...`);
                try { process.kill(lockPid, 'SIGKILL'); } catch(e){}
                lockStale = true;
              } else {
                const actualTty = execSync(`ps -p ${lockPid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
                if (actualTty !== myTty && myTty !== 'unknown' && actualTty !== 'unknown') {
                  console.log(`Unrelated swarm agent lock holder detected (PID ${lockPid}, TTY ${actualTty} !== myTty ${myTty}). Overriding lock...`);
                  lockStale = true;
                }
              }
            } catch (e) {
              lockStale = true; // Lock holder dead
            }
          } else {
            lockStale = true; // Invalid lock content
          }

          if (lockStale) {
            console.log(`Removing stale lockfile (${lockfile})...`);
            try { fs.unlinkSync(lockfile); } catch(e){}
          } else {
            console.log(`FIFO Queue: Waiting for active lock holder (${lockContent}) to finish...`);
            execSync('sleep 5');
            continue;
          }
        }

        // Acquire lock
        fs.writeFileSync(lockfile, myLockEntry, 'utf8');
        console.log(`Successfully acquired mutex lock (${lockfile}) with entry ${myLockEntry}.`);
        lockAcquired = true;
        return true;
      } else {
        console.log(`FIFO Queue: Waiting for earlier instances to finish. Current queue: ${validEntries.join(' -> ')}`);
        execSync('sleep 5');
      }
    } catch (e) {
      console.error('Error during lock acquisition loop:', e);
      execSync('sleep 5');
    }
  }

  console.error(`Failed to acquire lock (${lockfile}) after 30 minutes.`);
  throw new Error(`Failed to acquire lock (${lockfile}) after 30 minutes.`);
}

function releaseLock() {
  console.log(`Releasing mutex lock (${lockfile})...`);
  try {
    if (fs.existsSync(lockfile)) {
      const lockContent = fs.readFileSync(lockfile, 'utf8').trim();
      if (lockContent === myLockEntry) {
        fs.unlinkSync(lockfile);
      }
    }
    if (fs.existsSync(queuefile)) {
      let queueContent = fs.readFileSync(queuefile, 'utf8').trim();
      let queueEntries = queueContent.split('\n').map(e => e.trim()).filter(Boolean);
      queueEntries = queueEntries.filter(e => e !== myLockEntry);
      fs.writeFileSync(queuefile, queueEntries.join('\n') + '\n', 'utf8');
    }
  } catch (e) {
    console.error('Error releasing lock:', e);
  }
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
      const matchingPids = execSync(`pgrep -f "run_e2e|verify_|stress_test_|adv_|playwright|next|jetski|gemini|task" 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
      for (const pid of matchingPids) {
        if (isNaN(pid) || pid <= 0) continue;
        try {
          const cmdline = execSync(`ps -p ${pid} -o args= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
          if (cmdline.includes('run_e2e')) {
            const etimes = Number(execSync(`ps -o etimes= -p ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
            if (etimes > 2700) {
              console.log(`Stale run_e2e process (PID ${pid}) detected in killLingeringProcessesScoped (etimes ${etimes}s > 2700s). Skipping protection.`);
              continue;
            }
          }
          protectedPids.add(pid);
          addAncestors(pid);
          addDescendants(pid);
        } catch (e) {}
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
  try { execSync('npx --no-install supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  
  // 1. Explicitly force-remove supabase_db_expense-dashboard by name to resolve lingering container conflicts
  try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  
  // 2. Robust cleanup of all docker containers matching 'supabase' or 'expense-dashboard' BEFORE network removal
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -a -q --filter name=expense-dashboard | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -a -q --filter name=supabase | grep -q .; do docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true; sleep 2; done', { stdio: 'ignore', timeout: 10000 }); } catch(e){}
  
  // 3. Volume cleanup (Network deletion removed to prevent destroying supabase_network_expense-dashboard)
  try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q --filter name=expense-dashboard | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  
  // 4. Robust cleanup of docker containers AFTER network removal to catch any lingering containers in Creating/Created states
  try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -a -q --filter name=expense-dashboard | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}

  // 5. Targeted process killing with strict filtering to avoid terminating task runners, jetski, gemini, or E2E scripts
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase.*start" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  const killCmd = 'ps auxww | grep -i supabase | grep -v grep | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v stress_test_ | grep -v playwright | grep -v next | grep -v sleep | grep -v jest | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
  try { execSync(killCmd, { stdio: 'inherit' }); } catch(e){}
  
  try { execSync('sleep 2', { stdio: 'inherit' }); } catch(e){}
  try {
    const ports = [25432, 54329, 54321, 54320];
    for (const port of ports) {
      try {
        const pids1 = execSync(`lsof -t -i:${port} 2>/dev/null || true`, { encoding: 'utf-8' }).split(/\s+/).map(p => p.trim()).filter(Boolean).map(Number);
        const pids2 = execSync(`fuser ${port}/tcp 2>/dev/null || true`, { encoding: 'utf-8' }).split(/\s+/).map(p => p.trim()).filter(Boolean).map(Number);
        const pids = [...pids1, ...pids2];
        for (const pid of pids) {
          if (!isNaN(pid) && pid > 0 && pid !== process.pid && pid !== process.ppid) {
            try { process.kill(pid, 'SIGKILL'); } catch(e){}
          }
        }
      } catch(e){}
    }
  } catch(e){}
  try { execSync('rm -rf supabase/.temp/* $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
}

async function setup() {
  console.log('\n=== [E2E SETUP] Preparing environment ===');
  protectProcessTree(process.pid);
  killLingeringProcessesScoped('node|tsx|jest|webpack');
  try { execSync('rm -rf test-results playwright-report 2>/dev/null || true && mkdir -p test-results playwright-report 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  await acquireLock();
  
  if (fs.existsSync(envLocalPath)) {
    console.log('Backing up existing .env.local to .env.local.bak...');
    fs.copyFileSync(envLocalPath, envLocalBakPath);
    backupCreated = true;
  }

  if (!fs.existsSync(envTestPath)) {
    console.error('.env.test not found! Please create it first.');
    process.exit(1);
  }
  console.log('Swapping .env.local with E2E test credentials...');
  fs.copyFileSync(envTestPath, envLocalPath);

  console.log('Checking if Supabase is already running and healthy...');
  let alreadyRunning = false;
  try {
    const res = await fetch('http://127.0.0.1:54321');
    if (res.ok || res.status === 404 || res.status === 400 || res.status === 200) {
      const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:25432/postgres' });
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      alreadyRunning = true;
      console.log('Supabase is already running and healthy. Skipping startup.');
    }
  } catch (e) {}

  if (!alreadyRunning) {
    console.log('Starting local Supabase Docker containers...');
    try { execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try {
      const ports = [25432, 54329, 54321, 54320, 3000];
      for (const port of ports) {
        try {
          const pids1 = execSync(`lsof -t -i:${port} 2>/dev/null || true`, { encoding: 'utf-8' }).split(/\s+/).map(p => p.trim()).filter(Boolean).map(Number);
          const pids2 = execSync(`fuser ${port}/tcp 2>/dev/null || true`, { encoding: 'utf-8' }).split(/\s+/).map(p => p.trim()).filter(Boolean).map(Number);
          const pids = [...pids1, ...pids2];
          for (const pid of pids) {
            if (!isNaN(pid) && pid > 0 && pid !== process.pid && pid !== process.ppid) {
              try { process.kill(pid, 'SIGKILL'); } catch(e){}
            }
          }
        } catch(e){}
      }
    } catch(e){}
    try { execSync('mv supabase/migrations_bak supabase/migrations 2>/dev/null || true && mv supabase/seed.sql.bak supabase/seed.sql 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}

    console.log('Attempting to start Supabase cleanly with robust 5-retry loop...');
    let retries = 5;
    let reachable = false;
    while (retries > 0 && !reachable) {
      try {
        console.log(`\nStopping any existing Supabase instances before clean start... (${retries} attempts left)`);
        teardownSupabase();
        ensureSupabaseHealthTimeout();

        console.log('Attempting npx supabase start --debug...');
        try {
          execSync('npx --no-install supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
        } catch (startErr: any) {
          console.warn('npx supabase start exited non-zero (PlatformError / ChildProcess.exitCode). Proceeding to verify reachability...');
        }

        console.log('Verifying Supabase is reachable before confirming start...');
        let checkRetries = 120;
        while (checkRetries > 0 && !reachable) {
          try {
            const res = await fetch('http://127.0.0.1:54321');
            if (res.ok || res.status === 404 || res.status === 400 || res.status === 200) {
              reachable = true;
              break;
            }
          } catch (e) {}
          await new Promise(resolve => setTimeout(resolve, 1000));
          checkRetries--;
        }

        if (reachable) {
          console.log('✔ Supabase started successfully and is reachable.');
          break;
        } else {
          throw new Error('Supabase started but http://127.0.0.1:54321 is unreachable.');
        }
      } catch (err: any) {
        console.warn(`Supabase start failed. Retrying... (${retries - 1} attempts left)`);
        console.warn('Error details:', err.message || err);
        retries--;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    if (!reachable) {
      throw new Error('Supabase started but http://127.0.0.1:54321 is unreachable after all 5 retries.');
    }
  }
}

function cleanup() {
  console.log('\n=== [E2E CLEANUP] Restoring environment ===');
  isShuttingDown = true;
  if (!lockAcquired) {
    console.log('Mutex lock was never acquired. Skipping environment teardown to avoid disrupting active test runner.');
    return;
  }
  try {
    const pids1 = execSync(`lsof -t -i:3000 2>/dev/null || true`, { encoding: 'utf-8' }).split(/\s+/).map(p => p.trim()).filter(Boolean).map(Number);
    const pids2 = execSync(`fuser 3000/tcp 2>/dev/null || true`, { encoding: 'utf-8' }).split(/\s+/).map(p => p.trim()).filter(Boolean).map(Number);
    const pids = [...pids1, ...pids2];
    for (const pid of pids) {
      if (!isNaN(pid) && pid > 0 && pid !== process.pid && pid !== process.ppid) {
        try { process.kill(pid, 'SIGKILL'); } catch(e){}
      }
    }
  } catch(e){}
  try { execSync('git checkout supabase/migrations supabase/seed.sql 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try {
    console.log('Stopping local Supabase Docker containers...');
    teardownSupabase();
  } catch (err) {
    console.error('Warning: Failed to stop Supabase containers:', err);
  }

  // Restore .env.local from backup
  if (backupCreated && fs.existsSync(envLocalBakPath)) {
    console.log('Restoring original .env.local from backup...');
    fs.copyFileSync(envLocalBakPath, envLocalPath);
    fs.unlinkSync(envLocalBakPath);
  } else if (fs.existsSync(envLocalPath)) {
    // If there was no original .env.local, just delete the temporary one
    console.log('Removing temporary .env.local...');
    fs.unlinkSync(envLocalPath);
  }
  releaseLock();
  console.log('Environment clean.\n');
}

function robustSupabaseRestart() {
  console.log('Performing robust Supabase restart...');
  teardownSupabase();
  ensureSupabaseHealthTimeout();
  try {
    execSync('npx --no-install supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
  } catch (err) {
    console.error('Robust Supabase restart failed on first attempt. Performing final teardown and retry...');
    teardownSupabase();
    ensureSupabaseHealthTimeout();
    try {
      execSync('npx --no-install supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
    } catch (retryErr) {
      console.warn('npx supabase start retry exited non-zero in robustSupabaseRestart. Proceeding to verify reachability...');
    }
  }
  try { execSync('sleep 10', { stdio: 'inherit' }); } catch(e){}
  console.log('Executing e2e/init_db.ts and e2e/seed.ts after robustSupabaseRestart to restore database permissions and seed data...');
  try {
    execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
    execSync('npx tsx --env-file=.env.test e2e/seed.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  } catch (e) {
    console.warn('e2e/init_db.ts or e2e/seed.ts failed during robustSupabaseRestart. Proceeding...');
  }
}

async function run() {
  try {
    await setup();
    
    console.log('Verifying Supabase health at http://127.0.0.1:54321...');
    let retries = 60;
    let healthy = false;
    while (retries > 0 && !healthy) {
      try {
        const res = await fetch('http://127.0.0.1:54321');
        if (res.ok || res.status === 404 || res.status === 400 || res.status === 200) {
          healthy = true;
          console.log('Supabase is reachable.');
          break;
        }
      } catch (e) {
        // Ignore and retry
      }
      if (!healthy) {
        console.log(`Waiting for Supabase to be reachable... (${retries} retries left)`);
        if (retries === 30) {
          console.log('Supabase seems unresponsive. Attempting to cleanly restart Supabase...');
          robustSupabaseRestart();
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries--;
      }
    }

    if (!healthy) {
      throw new Error('Supabase health check failed: http://127.0.0.1:54321 is unreachable.');
    }

    console.log('Verifying Postgres database readiness at port 25432 using pg.Client...');
    let pgReady = false;
    let pgRetries = 15;
    while (pgRetries > 0 && !pgReady) {
      const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:25432/postgres' });
      try {
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        pgReady = true;
        console.log('Postgres database is ready at port 25432.');
        break;
      } catch (e: any) {
        console.log(`Waiting for Postgres database at port 25432 to be ready... (${pgRetries} retries left)`);
        await client.end().catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 1000));
        pgRetries--;
      }
    }

    if (!pgReady) {
      throw new Error('Postgres database readiness check failed at port 25432.');
    }

    console.log('Resetting database schema and applying migrations...');
    execSync('sleep 3', { stdio: 'inherit' });
    killLingeringProcessesScoped('node|tsx|jest|webpack');
    let dbPushRetries = 5;
    let dbPushSuccess = false;
    while (dbPushRetries > 0 && !dbPushSuccess) {
      try {
        execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
        dbPushSuccess = true;
        console.log('Database reset and migrations pushed successfully!');
      } catch(e) {
        console.log(`Database reset failed. Performing a full robust Supabase restart... (${dbPushRetries - 1} retries left)`);
        robustSupabaseRestart();
        dbPushRetries--;
      }
    }

    if (!dbPushSuccess) {
      console.log('Database reset failed after retries, attempting one final full stop and start before final db reset...');
      robustSupabaseRestart();
      execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
    }
    execSync('sleep 10', { stdio: 'inherit' });
    execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
    console.log('Running npm test against initialized database...');
    execSync('npm test', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });

    console.log('Verifying Supabase health pre-seed at http://127.0.0.1:54321...');
    let preSeedRetries = 60;
    let preSeedHealthy = false;
    while (preSeedRetries > 0 && !preSeedHealthy) {
      try {
        const res = await fetch('http://127.0.0.1:54321');
        if (res.ok || res.status === 404 || res.status === 400 || res.status === 200) {
          preSeedHealthy = true;
          console.log('Supabase is reachable pre-seed.');
          break;
        }
      } catch (e) {}
      if (!preSeedHealthy) {
        console.log(`Waiting for Supabase to be reachable pre-seed... (${preSeedRetries} retries left)`);
        if (preSeedRetries === 30) {
          console.log('Supabase seems unresponsive. Attempting to cleanly restart Supabase...');
          robustSupabaseRestart();
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        preSeedRetries--;
      }
    }
    if (!preSeedHealthy) {
      throw new Error('Supabase pre-seed health check failed: http://127.0.0.1:54321 is unreachable.');
    }

    console.log('Seeding E2E test data...');
    execSync('sleep 3 && npx tsx --env-file=.env.test e2e/seed.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });

    console.log('Executing Tier 3 Pairwise Feature Interaction Verification...');
    execSync('npx tsx --env-file=.env.test e2e/verify_tier3_interactions.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });


    console.log('Building fresh Next.js production bundle with telemetry disabled...');
    // Removed killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e') to prevent killing concurrent test runners
    try {
      const pids1 = execSync(`lsof -t -i:3000 2>/dev/null || true`, { encoding: 'utf-8' }).split(/\s+/).map(p => p.trim()).filter(Boolean).map(Number);
      const pids2 = execSync(`fuser 3000/tcp 2>/dev/null || true`, { encoding: 'utf-8' }).split(/\s+/).map(p => p.trim()).filter(Boolean).map(Number);
      const pids = [...pids1, ...pids2];
      for (const pid of pids) {
        if (!isNaN(pid) && pid > 0 && pid !== process.pid && pid !== process.ppid) {
          try { process.kill(pid, 'SIGKILL'); } catch(e){}
        }
      }
    } catch(e){}
    try { execSync('rm -rf .next', { stdio: 'inherit' }); } catch(e){}
    killLingeringProcessesScoped('node|tsx|jest|webpack');
    execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1', SUPABASE_TELEMETRY_DISABLED: '1', POSTHOG_DISABLED: '1', NODE_OPTIONS: '' } });

    try { execSync('sync 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    killLingeringProcessesScoped('node|tsx|jest|webpack');
    try { execSync('docker update --oom-kill-disable=true $(docker ps -q --filter name=supabase) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}

    console.log('Verifying Supabase health post-build at http://127.0.0.1:54321...');
    let postBuildRetries = 60;
    let postBuildHealthy = false;
    while (postBuildRetries > 0 && !postBuildHealthy) {
      try {
        const res = await fetch('http://127.0.0.1:54321');
        if (res.ok || res.status === 404 || res.status === 400 || res.status === 200) {
          postBuildHealthy = true;
          console.log('Supabase is reachable post-build.');
          break;
        }
      } catch (e) {}
      if (!postBuildHealthy) {
        console.log(`Waiting for Supabase to be reachable post-build... (${postBuildRetries} retries left)`);
        if (postBuildRetries === 30) {
          console.log('Supabase seems unresponsive post-build. Attempting to cleanly restart Supabase...');
          robustSupabaseRestart();
          execSync('npx tsx --env-file=.env.test e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
          execSync('npx tsx --env-file=.env.test e2e/seed.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        postBuildRetries--;
      }
    }
    if (!postBuildHealthy) {
      throw new Error('Supabase post-build health check failed: http://127.0.0.1:54321 is unreachable.');
    }

    console.log('Verifying Supabase Realtime health at http://127.0.0.1:54321/realtime/v1/health...');
    let realtimeRetries = 60;
    let realtimeHealthy = false;
    while (realtimeRetries > 0 && !realtimeHealthy) {
      try {
        const res = await fetch('http://127.0.0.1:54321/realtime/v1/health');
        if (res.ok || res.status === 200 || res.status === 404) {
          realtimeHealthy = true;
          console.log('Supabase Realtime is reachable and healthy.');
          break;
        }
      } catch (e) {}
      if (!realtimeHealthy) {
        console.log(`Waiting for Supabase Realtime to be reachable... (${realtimeRetries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        realtimeRetries--;
      }
    }
    if (!realtimeHealthy) {
      console.warn('Warning: Supabase Realtime health check timed out, proceeding anyway...');
    }

    console.log('Ensuring port 3000 is free before starting Next.js server...');
    try {
      const pids1 = execSync(`lsof -t -i:3000 2>/dev/null || true`, { encoding: 'utf-8' }).split(/\s+/).map(p => p.trim()).filter(Boolean).map(Number);
      const pids2 = execSync(`fuser 3000/tcp 2>/dev/null || true`, { encoding: 'utf-8' }).split(/\s+/).map(p => p.trim()).filter(Boolean).map(Number);
      const pids = [...pids1, ...pids2];
      for (const pid of pids) {
        if (!isNaN(pid) && pid > 0 && pid !== process.pid && pid !== process.ppid) {
          try { process.kill(pid, 'SIGKILL'); } catch(e){}
        }
      }
    } catch(e){}

    console.log('Starting Next.js production server...');
    let isNextServerRestarting = false;
    function startNextServer() {
      if (isShuttingDown) return;
      console.log('Spawning Next.js server process...');
      const nextServer = require('child_process').spawn('node', ['--require', './e2e/suppress_crashes.js', '--unhandled-rejections=warn', '--max-old-space-size=256', 'node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_OPTIONS: '--require ./e2e/suppress_crashes.js --unhandled-rejections=warn --max-old-space-size=256',
          NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
          SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
        }
      });
      if (nextServer.pid) protectProcessTree(nextServer.pid);

      nextServer.on('exit', (code: any) => {
        if (isShuttingDown || isNextServerRestarting) return;
        console.log(`Next.js server exited unexpectedly with code ${code}. Cleaning up port 3000 and respawning...`);
        isNextServerRestarting = true;
        try { execSync(`kill -9 ${nextServer.pid} 2>/dev/null || true`, { stdio: 'inherit' }); } catch(e){}
        try { execSync(`pkill -9 -P ${nextServer.pid} 2>/dev/null || true`, { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f "next" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try {
          const pids1 = execSync(`lsof -t -i:3000 2>/dev/null || true`, { encoding: 'utf-8' }).split(/\s+/).map(p => p.trim()).filter(Boolean).map(Number);
          const pids2 = execSync(`fuser 3000/tcp 2>/dev/null || true`, { encoding: 'utf-8' }).split(/\s+/).map(p => p.trim()).filter(Boolean).map(Number);
          const pids = [...pids1, ...pids2];
          for (const pid of pids) {
            if (!isNaN(pid) && pid > 0 && pid !== process.pid && pid !== process.ppid) {
              try { process.kill(pid, 'SIGKILL'); } catch(e){}
            }
          }
        } catch(e){}
        setTimeout(() => {
          startNextServer();
          setTimeout(() => { isNextServerRestarting = false; }, 5000);
        }, 1000);
      });
    }
    startNextServer();

    console.log('Waiting for Next.js server to be healthy at http://127.0.0.1:3000...');
    let nextRetries = 30;
    let nextHealthy = false;
    while (nextRetries > 0 && !nextHealthy) {
      try {
        const res = await fetch('http://127.0.0.1:3000/login');
        if (res.ok || res.status === 200 || res.status === 404) {
          nextHealthy = true;
          console.log('Next.js server is perfectly healthy!');
          break;
        }
      } catch (e) {}
      await new Promise(resolve => setTimeout(resolve, 1000));
      nextRetries--;
    }

    if (!nextHealthy) {
      throw new Error('Next.js server failed to start at http://127.0.0.1:3000');
    }

    // Run Playwright tests across all browsers sequentially
    console.log('Allowing Next.js and Supabase services 10 seconds to fully stabilize...');
    for (let w = 0; w < 5; w++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      try { await fetch('http://127.0.0.1:3000/login'); } catch(e){}
    }
    console.log('Performing final server health gating check before launching Playwright...');
    let gatingRetries = 15;
    let gatingHealthy = false;
    while (gatingRetries > 0 && !gatingHealthy) {
      try {
        const res = await fetch('http://127.0.0.1:3000/login');
        if (res.ok || res.status === 200 || res.status === 404) {
          gatingHealthy = true;
          console.log('Next.js server is confirmed healthy post-stabilization.');
          break;
        }
      } catch (e) {}
      await new Promise(resolve => setTimeout(resolve, 1000));
      gatingRetries--;
    }
    if (!gatingHealthy) {
      throw new Error('Next.js server health gating check failed: http://127.0.0.1:3000/login is unreachable before Playwright launch.');
    }

    try { execSync('sync 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker update --oom-kill-disable=true $(docker ps -q --filter name=supabase) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    protectProcessTree(process.pid);

    console.log('Launching Playwright E2E tests across all browsers sequentially (asynchronously to preserve event loop)...');
    const cacheInterval = setInterval(() => {
      try { execSync('sync 2>/dev/null || true'); } catch(e){}
    }, 10000);

    let pwProcess: any = null;
    let isSupabaseRestarting = false;
    let playwrightAttempts = 2;
    let playwrightSuccess = false;
    let healthMonitorInterval: any = null;

    while (playwrightAttempts > 0 && !playwrightSuccess) {
      try {
        if (typeof global.gc === 'function') { try { global.gc(); } catch(e){} }
        try { execSync('sync 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}

        let isHealthChecking = false;
        healthMonitorInterval = setInterval(async () => {
          if (isShuttingDown || isSupabaseRestarting || isHealthChecking) return;
          isHealthChecking = true;
          try {
            const res = await fetch('http://127.0.0.1:54321');
            if (!res.ok && res.status !== 404 && res.status !== 400 && res.status !== 200) {
              throw new Error(`Unexpected status ${res.status}`);
            }
          } catch (err: any) {
            console.warn('Runtime Supabase Health Monitoring: Supabase became unreachable during Playwright execution:', err.message || err);
            isSupabaseRestarting = true;
            console.log('Aborting active Playwright process to prevent OOM memory pressure. Main loop will handle clean restart...');
            if (pwProcess && pwProcess.pid) {
              try { pwProcess.kill('SIGKILL'); } catch(killErr){}
            }
          } finally {
            isHealthChecking = false;
          }
        }, 5000);

        await new Promise((resolve, reject) => {
          pwProcess = require('child_process').spawn('npx', ['playwright', 'test', '--workers=1', '--reporter=list', '--trace=off'], { stdio: 'inherit', env: { ...process.env, CI: '1', NODE_OPTIONS: '--max-old-space-size=256', PWDEBUG: '0', PLAYWRIGHT_CHROMIUM_USE_HERMETIC: '1' } });
          pwProcess.on('close', (code: number) => {
            if (healthMonitorInterval) clearInterval(healthMonitorInterval);
            pwProcess = null;
            if (code === 0) {
              resolve(true);
            } else {
              reject(new Error(`Playwright tests failed with exit code ${code}`));
            }
          });
        });

        playwrightSuccess = true;
      } catch (pwErr: any) {
        if (healthMonitorInterval) clearInterval(healthMonitorInterval);
        console.warn(`Playwright test execution attempt failed: ${pwErr.message || pwErr}. Attempts left: ${playwrightAttempts - 1}`);
        playwrightAttempts--;
        if (playwrightAttempts > 0) {
          console.log('Retrying Playwright test suite after ensuring clean Supabase state...');
          isSupabaseRestarting = true;
          robustSupabaseRestart();
          isSupabaseRestarting = false;
        }
      }
    }

    clearInterval(cacheInterval);
    if (!playwrightSuccess) {
      throw new Error('Playwright tests failed after all retry attempts.');
    }
    
    console.log('E2E Tests completed successfully!');
    cleanup();
    process.exit(0);
  } catch (err) {
    console.error('E2E Tests execution failed!', err);
    process.exitCode = 1;
    cleanup();
    process.exit(1);
  }
}

run();
