import { Client } from 'pg';
import * as fs from 'fs';

async function runBackup() {
  // Note: Percent-encoded '%' in password as '%25' to ensure standard connection URI parses successfully
  const connectionString = "postgresql://postgres:OFr4MKhiWc3ln%25@db.zjanajeevdvhbeuyflmg.supabase.co:5432/postgres";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Supabase requires SSL connection support
  });
  
  try {
    await client.connect();
    console.log('\n[BACKUP] Connected successfully to Supabase Cloud!');
    
    const tables = ['profiles', 'categories', 'budgets', 'expenses'];
    const backupData: Record<string, any[]> = {};
    
    for (const table of tables) {
      const res = await client.query(`SELECT * FROM public."${table}"`);
      backupData[table] = res.rows;
      console.log(`   ✅ Successfully backed up ${res.rows.length} rows from "${table}"`);
    }
    
    fs.writeFileSync('production_backup.json', JSON.stringify(backupData, null, 2));
    console.log('\n🎉 [SUCCESS] Production data backup saved to "production_backup.json"!\n');
  } catch (err) {
    console.error('\n❌ [BACKUP ERROR]:', err);
  } finally {
    await client.end();
  }
}

runBackup();
