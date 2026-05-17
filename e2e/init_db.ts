import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const client = new Client({ connectionString });

const MIGRATION_FILES = [
  'supabase/migrations/20260510000000_init.sql',
  'supabase/migrations/20260510140000_phase_1_65.sql',
  'supabase/migrations/20260510150000_phase_1_65_extensions.sql',
  'supabase/migrations/20260510170000_phase_1_7.sql',
  'supabase/migrations/20260511000000_phase_1_8_recurring.sql',
  'supabase/migrations/20260512000000_decouple_recurring.sql',
  'supabase/migrations/20260516232346_add_budgets_category_idx.sql'
];

async function initDb() {
  console.log('\n=== [DB INITIALIZER] Connecting to local Postgres ===');
  try {
    await client.connect();
    console.log('Connected successfully to local Postgres at port 54322.');

    for (const migrationFile of MIGRATION_FILES) {
      const ddlPath = path.join(process.cwd(), migrationFile);
      if (!fs.existsSync(ddlPath)) {
        console.error(`Migration file not found at: ${ddlPath}`);
        process.exit(1);
      }
      const ddl = fs.readFileSync(ddlPath, 'utf-8');

      console.log(`Executing DDL migration: ${migrationFile}...`);
      await client.query(ddl);
      console.log(`Applied ${migrationFile} successfully.`);
    }

    // Force PostgREST to reload schema cache
    console.log('Forcing PostgREST to reload schema cache...');
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('PostgREST reload notification sent.');

    // Verify tables are present in public schema
    const { rows } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tableNames = rows.map(r => r.table_name);
    console.log('Verified tables in public schema:', tableNames);

    if (!tableNames.includes('categories') || !tableNames.includes('expenses') || !tableNames.includes('exchange_rates')) {
      console.error('Error: Missing required tables after migration!');
      process.exit(1);
    }

    console.log('Database initialization complete & verified!\n');
  } catch (err: any) {
    console.error('Failed to initialize database:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

initDb();
