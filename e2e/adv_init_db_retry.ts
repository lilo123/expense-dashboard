import { Client } from 'pg';

async function testPgClientReuse() {
  console.log('\n=== [ADVERSARIAL TEST] Validating pg.Client Retry Reusability ===');
  const connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const client = new Client({ connectionString });

  console.log('Attempting first connection (simulating container startup delay)...');
  try {
    // If postgres is not ready or if we force an error, client enters ended/error state
    await client.connect();
    console.log('Connected on first attempt.');
    await client.end();
  } catch (err: any) {
    console.log('First connection failed as expected during startup:', err.message);
    console.log('Attempting second connection using the SAME client instance (as done in e2e/init_db.ts)...');
    try {
      await client.connect();
      console.error('[FAIL] Second connection succeeded unexpectedly on same client instance.');
      process.exit(1);
    } catch (retryErr: any) {
      console.log('Second connection failed with:', retryErr.message);
      if (retryErr.message.includes('already been connected') || retryErr.message.includes('cannot reuse a client') || retryErr.message.includes('Client has already been connected')) {
        console.log('✔ Adversarial test successfully reproduced the pg.Client reuse bug in e2e/init_db.ts.');
        console.log('=== [ADVERSARIAL TEST] adv_init_db_retry PASSED (BUG CONFIRMED) ===\n');
        process.exit(0);
      } else {
        console.error('[FAIL] Unexpected error message:', retryErr.message);
        process.exit(1);
      }
    }
  }
}

testPgClientReuse();
