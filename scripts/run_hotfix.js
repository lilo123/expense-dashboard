const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });

  try {
    await client.connect();
    console.log('Connected to local Postgres on port 54322.');

    const sqlPath = path.join(__dirname, '../supabase/migrations/20260518000002_fix_recurring_insert.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await client.query(sql);
    console.log('Successfully executed migration hotfix 20260518000002_fix_recurring_insert.sql in database!');
  } catch (err) {
    console.error('Local migration failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

migrate();
