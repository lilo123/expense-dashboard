import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = 'postgresql://postgres:postgres@127.0.0.1:25432/postgres';

// DDL migrations are handled by Supabase CLI

async function initDb() {
  console.log('\n=== [DB INITIALIZER] Connecting to local Postgres ===');
  let connected = false;
  let retries = 30;
  let client: Client | null = null;
  while (retries > 0 && !connected) {
    const c = new Client({ connectionString });
    try {
      await c.connect();
      const { rows } = await c.query("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses'");
      if (rows.length > 0) {
        client = c;
        connected = true;
        console.log('Connected successfully to local Postgres at port 25432 and verified expenses table exists.');
      } else {
        console.log(`Connected to Postgres but expenses table not ready yet... (${retries} retries left)`);
        await c.end().catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries--;
      }
    } catch (e: any) {
      console.log(`Waiting for Postgres to be ready... (${retries} retries left)`);
      await c.end().catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 2000));
      retries--;
    }
  }
  if (!connected || !client) {
    console.error('Failed to connect to Postgres after 30 retries.');
    process.exit(1);
  }

  try {

    // Grant permissions to Supabase roles
    console.log('Granting permissions to anon, authenticated, and service_role...');
    await client.query(`
      GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
      GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
      
      ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.siri_tokens DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.budgets DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.recurring_expenses DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.exchange_rates DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.deals DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.deal_checklist_items DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.api_rate_limits DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.email_templates DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.invite_requests DISABLE ROW LEVEL SECURITY;
    `);

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
    await client?.end();
    console.log('Postgres connection closed. Waiting 10s for PostgREST schema cache reload to complete...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}

initDb();
