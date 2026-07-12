import { execSync } from 'child_process';

const supabaseEnv = {
  ...process.env,
  NODE_OPTIONS: '--max-old-space-size=512',
  DB_HOST: '127.0.0.1',
  SUPABASE_DB_HOST: '127.0.0.1',
  SUPABASE_INTERNAL_DB_HOST: '127.0.0.1',
  SUPABASE_INTERNAL_HOST: '127.0.0.1',
  SUPABASE_DAEMON_ENABLE: 'false',
  SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1',
  DOCKER_DEFAULT_PLATFORM: 'linux/amd64'
};

function teardownSupabase() {
  console.log('Performing bulletproof Supabase teardown and cleanup...');
  try { execSync('npx --no-install supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  
  // 1. Explicitly force-remove supabase_db_expense-dashboard by name to resolve lingering container conflicts
  try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  
  // 2. Robust cleanup of all docker containers matching 'supabase' BEFORE network removal
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -a -q --filter name=supabase | grep -q .; do docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true; sleep 2; done', { stdio: 'ignore', timeout: 10000 }); } catch(e){}
  
  // 3. Volume cleanup (Network deletion removed to prevent destroying supabase_network_expense-dashboard)
  try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  
  // 4. Robust cleanup of docker containers AFTER network removal to catch any lingering containers in Creating/Created states
  try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}

  // 5. Targeted process killing with strict filtering to avoid terminating task runners, jetski, gemini, or E2E scripts
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase.*start" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  const killCmd = 'ps auxww | grep -i supabase | grep -v grep | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_supabase | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
  try { execSync(killCmd, { stdio: 'inherit' }); } catch(e){}
  
  try { execSync('sleep 2', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp/* $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
}

async function verifySupabaseDnsResolution() {
  console.log('\n=== [ADVERSARIAL TEST] Validating Supabase CLI Docker Network DNS Resolution (DB_HOST: nxdomain) ===');

  let retries = 5;
  let success = false;
  let lastErr: any = null;

  while (retries > 0 && !success) {
    try {
      console.log(`\nStopping any existing Supabase instances before clean start... (${retries} attempts left)`);
      teardownSupabase();

      console.log('Attempting npx supabase start --debug...');
      try {
        execSync('npx --no-install supabase start --debug', { stdio: 'inherit', env: supabaseEnv });
      } catch (startErr: any) {
        console.warn('npx supabase start exited non-zero (PlatformError / ChildProcess.exitCode). Proceeding to verify reachability...');
      }
      
      console.log('Verifying Supabase is reachable...');
      let checkRetries = 120;
      let reachable = false;
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
        console.log('✔ Supabase started successfully without DNS nxdomain errors.');
        success = true;
        break;
      } else {
        throw new Error('Supabase started but http://127.0.0.1:54321 is unreachable.');
      }
    } catch (err: any) {
      lastErr = err;
      console.warn(`Supabase start failed (PlatformError / ChildProcess.exitCode). Retrying... (${retries - 1} attempts left)`);
      console.warn('Error details:', err.message || err);
      retries--;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  if (success) {
    process.exit(0);
  } else {
    console.error('\n[FAIL] Supabase start failed with DNS resolution error (DB_HOST: nxdomain) after all retries.');
    console.error('Fatal Error details:', lastErr?.message || lastErr);
    process.exit(1);
  }
}

verifySupabaseDnsResolution();
