const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });
  try {
    await client.connect();
    const userRes = await client.query("SELECT id FROM auth.users WHERE email = 'test-user@example.com'");
    if (userRes.rows.length === 0) {
      console.log('No E2E test-user exists!');
      return;
    }
    const userId = userRes.rows[0].id;
    console.log('E2E User ID:', userId);
    
    const catRes = await client.query('SELECT * FROM public.categories WHERE user_id = $1', [userId]);
    console.log(`Found ${catRes.rows.length} categories for test user:`);
    console.log(catRes.rows.map(c => c.name));

    const recurRes = await client.query('SELECT * FROM public.recurring_expenses WHERE user_id = $1', [userId]);
    console.log(`Found ${recurRes.rows.length} recurring expenses for test user:`);
    console.log(recurRes.rows.map(r => ({ id: r.id, item: r.item, amount: r.amount })));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();
