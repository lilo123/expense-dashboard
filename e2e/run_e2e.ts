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
}

function cleanup() {
  console.log('\n=== [E2E CLEANUP] Restoring environment ===');
  
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

function run() {
  try {
    setup();
    
    // Run Playwright tests against Chromium
    console.log('Launching Playwright Chromium E2E tests...');
    execSync('npx playwright test --project=chromium --workers=1', { stdio: 'inherit' });
    
    console.log('E2E Tests completed successfully!');
  } catch (err) {
    console.error('E2E Tests execution failed!');
    process.exitCode = 1;
  } finally {
    cleanup();
  }
}

run();
