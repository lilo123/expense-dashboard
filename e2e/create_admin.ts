import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

(global as any).WebSocket = ws;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase env variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ADMIN_EMAIL = 'admin@an-yen.com';
const ADMIN_PASSWORD = 'adminpass123';

async function spawnAdmin() {
  console.log(`\n=== Spawning Admin User ===`);
  try {
    // 1. Check existing users
    const { data: usersData } = await supabase.auth.admin.listUsers();
    let user = usersData?.users?.find(u => u.email === ADMIN_EMAIL);

    if (!user) {
      console.log(`Creating fresh auth user: ${ADMIN_EMAIL}...`);
      const { data, error } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true
      });
      if (error || !data.user) {
        console.error('Failed to create admin user:', error?.message);
        process.exit(1);
      }
      user = data.user;
      console.log(`Created auth user successfully (ID: ${user.id}).`);
    } else {
      console.log(`User already exists (ID: ${user.id}).`);
    }

    // 2. Wait 1 second for Postgres trigger to auto-create profile
    await new Promise(r => setTimeout(r, 1000));

    // 3. Promote profile role to 'admin'
    console.log(`Promoting profile role to 'admin'...`);
    const { error: promoError } = await supabase
      .from('profiles')
      .update({ role: 'admin', onboarding_status: 'completed' })
      .eq('id', user.id);

    if (promoError) {
      console.error('Failed to promote profile to admin:', promoError.message);
      process.exit(1);
    }

    console.log(`\n🎉 [SUCCESS] Admin user successfully spawned and elevated!`);
    console.log(`Email:    ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}\n`);

  } catch (err: any) {
    console.error('Unexpected error spawning admin:', err.message || err);
    process.exit(1);
  }
}

spawnAdmin();
