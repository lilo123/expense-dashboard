import { execSync } from 'child_process';
import { Client } from 'pg';

async function verifySupabaseLifecycle() {
  console.log('=== [ADVERSARIAL TEST] Verifying Supabase Container Lifecycle & Postgres Readiness ===');
  try {
    console.log('1. Checking if supabase containers are fully running...');
    const statusOutput = execSync('npx --no-install supabase status 2>/dev/null || true', { encoding: 'utf-8' });
    console.log('Supabase status output:\n', statusOutput);

    if (statusOutput.includes('is not running') || statusOutput.includes('exited')) {
      throw new Error('Supabase container(s) exited unexpectedly (e.g., supabase_pooler or supabase_db).');
    }

    console.log('2. Verifying direct Postgres connection at port 25432...');
    const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:25432/postgres' });
    await client.connect();
    await client.query('SELECT 1;');
    await client.end();
    console.log('Direct Postgres connection successful.');

    console.log('3. Verifying npx supabase migration up...');
    execSync('npx --no-install supabase migration up --include-all', { stdio: 'inherit' });
    console.log('Migration up successful.');

    console.log('Adversarial test PASSED.');
    process.exit(0);
  } catch (err: any) {
    console.error('Adversarial test FAILED:', err.message || err);
    process.exit(1);
  }
}

verifySupabaseLifecycle();
