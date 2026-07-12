import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Client } from 'pg';

const rootDir = process.cwd();
const envLocalPath = path.join(rootDir, '.env.local');
const envLocalBakPath = path.join(rootDir, '.env.local.bak');
const envTestPath = path.join(rootDir, '.env.test');

let backupCreated = false;
let isShuttingDown = false;

async function setup() {
  console.log('\n=== [E2E SETUP] Preparing environment ===');
  
  // 1. Backup existing .env.local if it exists
  if (fs.existsSync(envLocalPath)) {
    console.log('Backing up existing .env.local to .env.local.bak...');
    fs.copyFileSync(envLocalPath, envLocalBakPath);
    backupCreated = true;
  }

  // 2. Copy .env.test to .env.local
  if (!fs.existsSync(envTestPath)) {
    console.error('.env.test not found! Please create it first.');
    process.exit(1);
  }
  console.log('Swapping .env.local with E2E test credentials...');
  fs.copyFileSync(envTestPath, envLocalPath);

  // START LOCAL SUPABASE & SEED DB
  console.log('Starting local Supabase Docker containers...');
  try { execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('mv supabase/migrations_bak supabase/migrations 2>/dev/null || true && mv supabase/seed.sql.bak supabase/seed.sql 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  console.log('Stopping existing Supabase containers and cleaning up Docker...');
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

  console.log('Attempting to start Supabase cleanly...');
  let supabaseStarted = false;
  for (let i = 0; i < 3; i++) {
    try {
      console.log(`Supabase start attempt ${i + 1}/3...`);
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

      execSync('npx supabase start --ignore-health-check', { stdio: 'inherit' });
      try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
      
      console.log('Verifying Supabase is reachable before confirming start...');
      let checkRetries = 15;
      let reachable = false;
      while (checkRetries > 0 && !reachable) {
        try {
          const res = await fetch('http://127.0.0.1:54321');
          if (res.ok || res.status === 404 || res.status === 400 || res.status === 200) {
            reachable = true;
            break;
          }
        } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 5000));
        checkRetries--;
      }

      if (!reachable) {
        throw new Error('Supabase started but http://127.0.0.1:54321 is unreachable.');
      }

      supabaseStarted = true;
      console.log('Supabase started and verified successfully.');
      break;
    } catch (err) {
      console.error(`Supabase start attempt ${i + 1} failed. Checking status and cleaning up before retry...`);
      try { execSync('npx supabase status', { stdio: 'inherit' }); } catch (statusErr) { console.error('Supabase status check failed.'); }
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
    }
  }

  if (!supabaseStarted) {
    console.error('Failed to start Supabase after 3 attempts.');
    process.exit(1);
  }
}

function cleanup() {
  console.log('\n=== [E2E CLEANUP] Restoring environment ===');
  isShuttingDown = true;
  try { execSync('fuser -k 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('git checkout supabase/migrations supabase/seed.sql 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try {
    console.log('Stopping local Supabase Docker containers...');
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
  console.log('Environment clean.\n');
}

async function run() {
  try {
    await setup();
    
    console.log('Verifying Supabase health at http://127.0.0.1:54321...');
    let retries = 20;
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
        if (retries === 15 || retries === 10 || retries === 5) {
          console.log('Supabase seems unresponsive. Attempting to cleanly restart Supabase...');
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
          try { execSync('npx supabase start --ignore-health-check', { stdio: 'inherit' }); } catch(e){}
          try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
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
        await new Promise(resolve => setTimeout(resolve, 5000));
        pgRetries--;
      }
    }

    if (!pgReady) {
      throw new Error('Postgres database readiness check failed at port 25432.');
    }

    console.log('Initializing database schema and migrations...');
    execSync('sleep 15', { stdio: 'inherit' });
    let dbPushRetries = 5;
    let dbPushSuccess = false;
    while (dbPushRetries > 0 && !dbPushSuccess) {
      try {
        execSync('npx supabase migration up --include-all', { stdio: 'inherit' });
        dbPushSuccess = true;
        console.log('Database migrations pushed successfully!');
      } catch(e) {
        console.log(`Database push failed. Performing a full npx supabase stop and npx supabase start... (${dbPushRetries - 1} retries left)`);
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
        try { execSync('npx supabase start --ignore-health-check', { stdio: 'inherit' }); } catch(err){}
        try { execSync('sleep 20', { stdio: 'inherit' }); } catch(err){}
        dbPushRetries--;
      }
    }

    if (!dbPushSuccess) {
      console.log('Migration up failed after retries, attempting one final full stop and start before final migration up...');
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
      try { execSync('npx supabase start --ignore-health-check', { stdio: 'inherit' }); } catch(err){}
      try { execSync('sleep 20', { stdio: 'inherit' }); } catch(err){}
      execSync('npx supabase migration up --include-all', { stdio: 'inherit' });
    }
    execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit' });

    console.log('Verifying Supabase health pre-seed at http://127.0.0.1:54321...');
    let preSeedRetries = 20;
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
        if (preSeedRetries === 15 || preSeedRetries === 10 || preSeedRetries === 5) {
          console.log('Supabase seems unresponsive. Attempting to cleanly restart Supabase...');
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
          try { execSync('npx supabase start --ignore-health-check', { stdio: 'inherit' }); } catch(e){}
          try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        preSeedRetries--;
      }
    }
    if (!preSeedHealthy) {
      throw new Error('Supabase pre-seed health check failed: http://127.0.0.1:54321 is unreachable.');
    }

    console.log('Seeding E2E test data...');
    execSync('sleep 15 && npx tsx --env-file=.env.test e2e/seed.ts', { stdio: 'inherit' });


    console.log('Building fresh Next.js production bundle...');
    try {
      const currentPid = process.pid;
      const parentPid = process.ppid;
      let grandParentPid = -1;
      try { grandParentPid = Number(execSync(`ps -o ppid= -p ${parentPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim()); } catch(e){}
      let greatGrandParentPid = -1;
      try { greatGrandParentPid = Number(execSync(`ps -o ppid= -p ${grandParentPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim()); } catch(e){}
      
      const nodePids = execSync('pgrep -f "node.*run_e2e" 2>/dev/null || true', { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
      const tsxPids = execSync('pgrep -f "tsx.*run_e2e" 2>/dev/null || true', { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
      const allPids = Array.from(new Set([...nodePids, ...tsxPids]));
      
      const pids = allPids.filter(pid => pid !== currentPid && pid !== parentPid && pid !== grandParentPid && pid !== greatGrandParentPid);
      if (pids.length > 0) {
        console.log(`Killing lingering run_e2e processes: ${pids.join(' ')}`);
        execSync(`kill -9 ${pids.join(' ')} 2>/dev/null || true`, { stdio: 'inherit' });
      }
    } catch (e) {}
    try { execSync('fuser -k 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('rm -rf .next', { stdio: 'inherit' }); } catch(e){}
    execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '' } });


    console.log('Verifying Supabase health post-build at http://127.0.0.1:54321...');
    let postBuildRetries = 20;
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
        if (postBuildRetries === 15 || postBuildRetries === 10 || postBuildRetries === 5) {
          console.log('Supabase seems unresponsive. Attempting to cleanly restart Supabase...');
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
          try { execSync('npx supabase start --ignore-health-check', { stdio: 'inherit' }); } catch(e){}
          try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        postBuildRetries--;
      }
    }
    if (!postBuildHealthy) {
      throw new Error('Supabase post-build health check failed: http://127.0.0.1:54321 is unreachable.');
    }

    console.log('Ensuring port 3000 is free before starting Next.js server...');
    try { execSync('fuser -k 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}

    console.log('Starting Next.js production server...');
    let isNextServerRestarting = false;
    function startNextServer() {
      if (isShuttingDown) return;
      console.log('Spawning Next.js server process...');
      const nextServer = require('child_process').spawn('node', ['--unhandled-rejections=warn', '--max-old-space-size=4096', 'node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_OPTIONS: '--unhandled-rejections=warn --max-old-space-size=4096',
          NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
          SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
        }
      });

      nextServer.on('exit', (code: any) => {
        if (isShuttingDown || isNextServerRestarting) return;
        console.log(`Next.js server exited unexpectedly with code ${code}. Cleaning up port 3000 and respawning...`);
        isNextServerRestarting = true;
        try { execSync('fuser -k 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
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
      await new Promise(resolve => setTimeout(resolve, 5000));
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
    console.log('Launching Playwright E2E tests across all browsers sequentially (asynchronously to preserve event loop)...');
    await new Promise((resolve, reject) => {
      const pw = require('child_process').spawn('npx', ['playwright', 'test', '--workers=1', '--reporter=list', '--trace=off'], { stdio: 'inherit' });
      pw.on('close', (code: number) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`Playwright tests failed with exit code ${code}`));
        }
      });
    });
    
    console.log('E2E Tests completed successfully!');
  } catch (err) {
    console.error('E2E Tests execution failed!', err);
    process.exitCode = 1;
  } finally {
    cleanup();
  }
}

run();
