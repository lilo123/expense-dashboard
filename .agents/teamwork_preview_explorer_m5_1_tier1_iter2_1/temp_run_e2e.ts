import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const envLocalPath = path.join(rootDir, '.env.local');
const envLocalBakPath = path.join(rootDir, '.env.local.bak');
const envTestPath = path.join(rootDir, '.env.test');

let backupCreated = false;

function setup() {
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
  try { execSync('fuser -k 54321/tcp 54322/tcp 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('npx supabase stop 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker rm -f $(docker ps -aq) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  execSync('npx supabase start', { stdio: 'inherit' });
}

function cleanup() {
  console.log('\n=== [E2E CLEANUP] Restoring environment ===');
  
  try { execSync('git checkout supabase/migrations supabase/seed.sql 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try {
    console.log('Stopping local Supabase Docker containers...');
    execSync('npx supabase stop', { stdio: 'inherit' });
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
    setup();
    
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
          try { execSync('docker start $(docker ps -aq --filter name=supabase 2>/dev/null) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries--;
      }
    }

    if (!healthy) {
      throw new Error('Supabase health check failed: http://127.0.0.1:54321 is unreachable.');
    }

    console.log('Initializing database schema and migrations...');
    try { execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit' }); } catch(e){}

    console.log('Ensuring all Supabase containers are active before seeding...');
    try { execSync('docker start supabase_db_expense-dashboard supabase_rest_expense-dashboard supabase_auth_expense-dashboard supabase_kong_expense-dashboard $(docker ps -aq --filter name=supabase 2>/dev/null) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    console.log('Seeding E2E test data...');
    execSync('sleep 15 && npx tsx --env-file=.env.test e2e/seed.ts', { stdio: 'inherit' });

    console.log('Temporarily stopping Supabase containers to free up memory for Next.js build...');
    try { execSync('docker stop supabase_db_expense-dashboard supabase_rest_expense-dashboard supabase_auth_expense-dashboard supabase_kong_expense-dashboard $(docker ps -aq --filter name=supabase 2>/dev/null) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}

    console.log('Building fresh Next.js production bundle...');
    try { execSync('pkill -9 -f next || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('rm -rf .next', { stdio: 'inherit' }); } catch(e){}
    execSync('npm run build', { stdio: 'inherit' });

    console.log('Restarting Supabase containers after build...');
    try { execSync('docker start supabase_db_expense-dashboard supabase_rest_expense-dashboard supabase_auth_expense-dashboard supabase_kong_expense-dashboard $(docker ps -aq --filter name=supabase 2>/dev/null) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}

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
        await new Promise(resolve => setTimeout(resolve, 2000));
        postBuildRetries--;
      }
    }
    if (!postBuildHealthy) {
      throw new Error('Supabase post-build health check failed: http://127.0.0.1:54321 is unreachable.');
    }

    console.log('Ensuring port 3000 is free before starting Next.js server...');
    try { execSync('fuser -k 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}

    console.log('Starting Next.js production server in background...');
    const nextServer = require('child_process').spawn('npm', ['run', 'start'], {
      stdio: 'inherit',
      detached: true,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
      }
    });
    nextServer.unref();

    console.log('Waiting for Next.js server to be healthy at http://localhost:3000...');
    let nextRetries = 30;
    let nextHealthy = false;
    while (nextRetries > 0 && !nextHealthy) {
      try {
        const res = await fetch('http://localhost:3000/login');
        if (res.ok || res.status === 200 || res.status === 404) {
          nextHealthy = true;
          console.log('Next.js server is perfectly healthy!');
          break;
        }
      } catch (e) {}
      await new Promise(resolve => setTimeout(resolve, 2000));
      nextRetries--;
    }

    if (!nextHealthy) {
      throw new Error('Next.js server failed to start at http://localhost:3000');
    }

    // Run Playwright tests across all browsers sequentially
    console.log('Launching Playwright E2E tests across all browsers sequentially...');
    execSync('npx playwright test --workers=1 --reporter=list', { stdio: 'inherit' });
    
    console.log('E2E Tests completed successfully!');
  } catch (err) {
    console.error('E2E Tests execution failed!', err);
    process.exitCode = 1;
  } finally {
    cleanup();
  }
}

run();
