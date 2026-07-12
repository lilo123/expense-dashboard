import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { execSync } from 'child_process';

// Polyfill global WebSocket for Node 20 compatibility with Supabase Realtime
(global as any).WebSocket = ws;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase env variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Seed parameters
const TARGET_EMAIL = 'test-user@example.com';
const TARGET_PASSWORD = 'password123';

// Sample realistic expense descriptors aligned to our 16 default trigger categories
const SAMPLE_EXPENSES = [
  { category: 'Groceries', item: 'Weekly Groceries 🛒', min: 45.0, max: 120.0 },
  { category: 'Dining Out', item: 'Matcha Latte 🍵', min: 4.50, max: 7.50 },
  { category: 'Dining Out', item: 'Cozy Coffee ☕', min: 3.50, max: 6.00 },
  { category: 'Dining Out', item: 'Dinner with Friends 🍕', min: 25.0, max: 85.0 },
  { category: 'Dining Out', item: 'Lunch Sandwich 🥪', min: 8.50, max: 15.50 },
  { category: 'Groceries', item: 'Organic Salad 🥗', min: 12.0, max: 18.0 },
  
  { category: 'Transportation', item: 'Uber Ride 🚗', min: 8.0, max: 38.0 },
  { category: 'Transportation', item: 'Train Ticket 🎫', min: 15.0, max: 45.0 },
  { category: 'Transportation', item: 'Bus Fare 🚌', min: 2.25, max: 4.50 },
  { category: 'Transportation', item: 'Gas Refill ⛽', min: 35.0, max: 65.0 },
  { category: 'Transportation', item: 'Bikeshare 🚲', min: 3.0, max: 8.0 },
  
  { category: 'Utilities', item: 'Electric Bill ⚡', min: 65.0, max: 130.0 },
  { category: 'Utilities', item: 'Water Bill 💧', min: 30.0, max: 55.0 },
  { category: 'Utilities', item: 'Internet Fiber 🌐', min: 59.99, max: 79.99 },
  { category: 'Utilities', item: 'Phone Plan 📱', min: 35.0, max: 65.0 }
];

// Helper to generate a random date in the past N days
function getRandomPastDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function seed() {
  console.log(`\n=== Seeding E2E test environment ===`);
  console.log(`Target User: ${TARGET_EMAIL}`);

  try {
    // 1. Clean up existing user and their data if they exist
    let usersData: any = null;
    let listError: any = null;
    let retries = 60;
    while (retries > 0) {
      try {
        const res = await supabase.auth.admin.listUsers();
        usersData = res.data;
        listError = res.error;
        if (!listError && usersData) break;
      } catch (e: any) {
        listError = e;
      }
      console.log(`Waiting for Supabase Auth to be ready... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      retries--;
    }

    if (listError || !usersData) {
      console.error('Failed to list users:', listError?.message || listError);
      process.exit(1);
    }

    // ADDED: Robust retry loop verifying PostgREST schema cache readiness
    console.log('Verifying PostgREST schema cache readiness...');
    let schemaReady = false;
    let schemaRetries = 50;
    while (schemaRetries > 0 && !schemaReady) {
      const { error: profErr } = await supabase.from('profiles').select('*').limit(1);
      const { error: catErr } = await supabase.from('categories').select('*').limit(1);
      
      if (!profErr && !catErr) {
        schemaReady = true;
        console.log('PostgREST schema cache is fully ready and accessible.');
        break;
      }
      
      console.log(`Waiting for PostgREST schema cache to reload... (Errors: ${profErr?.message || ''} / ${catErr?.message || ''}) (${schemaRetries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      schemaRetries--;
    }

    if (!schemaReady) {
      console.error('Failed to verify PostgREST schema cache readiness after 50 retries.');
      process.exit(1);
    }
    // END ADDED

    const existingUser = usersData.users.find((u: any) => u.email === TARGET_EMAIL);
    if (existingUser) {
      console.log(`User already exists (ID: ${existingUser.id}). Cleaning up existing user data with robust retry loops...`);
      
      // Delete user's expenses with retry loop
      let expRetries = 10;
      while (expRetries > 0) {
        const { error: expDelError } = await supabase.from('expenses').delete().eq('user_id', existingUser.id);
        if (!expDelError) {
          console.log('Successfully cleaned expenses.');
          break;
        }
        console.warn(`Warning: failed to clean expenses (${expDelError.message}). Retrying... (${expRetries - 1} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        expRetries--;
      }
      
      // Delete user's categories with retry loop
      let catDelRetries = 10;
      while (catDelRetries > 0) {
        const { error: catDelError } = await supabase.from('categories').delete().eq('user_id', existingUser.id);
        if (!catDelError) {
          console.log('Successfully cleaned categories.');
          break;
        }
        console.warn(`Warning: failed to clean categories (${catDelError.message}). Retrying... (${catDelRetries - 1} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        catDelRetries--;
      }

      // Delete user's recurring_expenses with retry loop
      let recurDelRetries = 10;
      while (recurDelRetries > 0) {
        const { error: recurDelError } = await supabase.from('recurring_expenses').delete().eq('user_id', existingUser.id);
        if (!recurDelError) {
          console.log('Successfully cleaned recurring_expenses.');
          break;
        }
        console.warn(`Warning: failed to clean recurring_expenses (${recurDelError.message}). Retrying... (${recurDelRetries - 1} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        recurDelRetries--;
      }

      // Delete the auth user with retry loop
      let deleteRetries = 15;
      let deleteSuccess = false;
      let lastDeleteError: any = null;
      while (deleteRetries > 0 && !deleteSuccess) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id);
        if (!deleteError) {
          deleteSuccess = true;
          console.log('Deleted existing auth user.');
          break;
        }
        lastDeleteError = deleteError;
        console.warn(`Warning: failed to delete existing auth user (${deleteError.message}). Retrying... (${deleteRetries - 1} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        deleteRetries--;
      }

      if (!deleteSuccess) {
        console.error('Failed to delete existing auth user after retries:', lastDeleteError?.message || lastDeleteError);
        process.exit(1);
      }
    }

    // 2. Create fresh test user with retry loop
    console.log('Creating fresh test user with robust retry loop...');
    let createRetries = 15;
    let createData: any = null;
    let lastCreateError: any = null;
    while (createRetries > 0 && !createData) {
      const res = await supabase.auth.admin.createUser({
        email: TARGET_EMAIL,
        password: TARGET_PASSWORD,
        email_confirm: true // Auto-confirm email so they can log in immediately
      });
      if (!res.error && res.data?.user) {
        createData = res.data;
        break;
      }
      lastCreateError = res.error;
      console.warn(`Warning: failed to create test user (${res.error?.message || res.error}). Retrying... (${createRetries - 1} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      createRetries--;
    }

    if (!createData || (lastCreateError && !createData)) {
      console.error('Failed to create test user after retries:', lastCreateError?.message || lastCreateError);
      process.exit(1);
    }

    const userId = createData.user.id;
    console.log(`Created fresh test user. ID: ${userId}`);

    // Create or update founder (admin) and standard user for invite workflows
    const existingFounder = usersData.users.find((u: any) => u.email === 'founder@an-yen.com');
    let founderId = existingFounder?.id;
    if (!founderId) {
      console.log('Creating founder user with robust retry loop...');
      let founderRetries = 15;
      let founderData: any = null;
      let lastFounderError: any = null;
      while (founderRetries > 0 && !founderData) {
        const res = await supabase.auth.admin.createUser({
          email: 'founder@an-yen.com',
          password: 'adminpass123',
          email_confirm: true
        });
        if (!res.error && res.data?.user) {
          founderData = res.data;
          break;
        }
        lastFounderError = res.error;
        console.warn(`Warning: failed to create founder user (${res.error?.message || res.error}). Retrying... (${founderRetries - 1} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        founderRetries--;
      }
      if (!founderData) {
        console.warn('Founder create error after retries:', lastFounderError?.message || lastFounderError);
      }
      founderId = founderData?.user?.id;
    } else {
      await supabase.auth.admin.updateUserById(founderId, { password: 'adminpass123', email_confirm: true });
    }
    if (founderId) {
      const { error: pErr } = await supabase.from('profiles').upsert({ id: founderId, role: 'admin', onboarding_status: 'completed', base_currency: 'CAD', display_currency: 'CAD' });
      if (pErr) console.warn('Founder profile upsert error:', pErr.message);
    }

    const existingStandard = usersData.users.find((u: any) => u.email === 'standard-user@example.com');
    let standardId = existingStandard?.id;
    if (!standardId) {
      console.log('Creating standard user with robust retry loop...');
      let standardRetries = 15;
      let standardData: any = null;
      let lastStandardError: any = null;
      while (standardRetries > 0 && !standardData) {
        const res = await supabase.auth.admin.createUser({
          email: 'standard-user@example.com',
          password: 'password123',
          email_confirm: true
        });
        if (!res.error && res.data?.user) {
          standardData = res.data;
          break;
        }
        lastStandardError = res.error;
        console.warn(`Warning: failed to create standard user (${res.error?.message || res.error}). Retrying... (${standardRetries - 1} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        standardRetries--;
      }
      if (!standardData) {
        console.warn('Standard create error after retries:', lastStandardError?.message || lastStandardError);
      }
      standardId = standardData?.user?.id;
    } else {
      await supabase.auth.admin.updateUserById(standardId, { password: 'password123', email_confirm: true });
    }
    if (standardId) {
      const { error: pErr2 } = await supabase.from('profiles').upsert({ id: standardId, onboarding_status: 'completed', base_currency: 'CAD', display_currency: 'CAD' });
      if (pErr2) console.warn('Standard profile upsert error:', pErr2.message);
    }

    console.log('Seeding email_templates...');
    await supabase.from('email_templates').upsert({ id: 'invite_approval', subject: 'Welcome to An-yen', html_body: '<p>Welcome</p>', updated_at: new Date().toISOString() });

    // 3. Fetch categories dynamically created by the Postgres Trigger!
    console.log('Waiting for Postgres trigger to auto-seed default categories...');
    let seededCategories: any = null;
    let catError: any = null;
    let catAttempts = 15;
    while (catAttempts > 0) {
      const res = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId);
      seededCategories = res.data;
      catError = res.error;
      if (!catError && seededCategories && seededCategories.length > 0) break;
      console.log(`Failed to fetch categories (${catError?.message || 'No categories returned'}), forcing schema cache reload and retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      catAttempts--;
    }

    if (catError || !seededCategories || seededCategories.length === 0) {
      console.error('Failed to verify categories trigger execution:', catError?.message || 'No categories returned');
      process.exit(1);
    }

    console.log(`Trigger verified! Fetched ${seededCategories.length} auto-seeded categories:`);
    console.log(seededCategories.map((c: any) => c.name));

    // Map category name to its newly created local UUID
    const categoryMap = new Map<string, string>();
    seededCategories.forEach((cat: any) => {
      categoryMap.set(cat.name, cat.id);
    });

    console.log('Seeding E2E mock exchange rates (Base: CAD)...');
    const { error: ratesError } = await supabase
      .from('exchange_rates')
      .insert([
        {
          base_currency: 'CAD',
          rates: {
            CAD: 1.0,
            VND: 18500.0,
            USD: 0.73,
            EUR: 0.68,
            JPY: 114.0,
            GBP: 0.58,
            SGD: 0.99
          },
          updated_at: new Date().toISOString()
        }
      ]);

    if (ratesError) {
      console.error('Failed to seed exchange rates:', ratesError.message);
      process.exit(1);
    }

    console.log('Seeding E2E mock budget for December 2025 and December 2026...');
    await supabase.from('budgets').insert([
      {
        user_id: userId,
        category_id: categoryMap.get('Groceries'),
        limit_amount: 500.0,
        currency: 'CAD',
        month: '2026-12'
      },
      {
        user_id: userId,
        category_id: categoryMap.get('Groceries'),
        limit_amount: 500.0,
        currency: 'CAD',
        month: '2025-12'
      }
    ]);

    console.log('Resetting API rate limits for clean E2E test run...');
    await supabase.from('api_rate_limits').delete().neq('key', 'dummy');
    await supabase.from('invite_requests').delete().neq('email', 'dummy');

    // 4. Seed 3 active recurring configurations (Rent, Netflix, Gym)
    console.log('Seeding 3 active recurring configurations (Rent, Netflix, Gym)...');
    const recurringToInsert = [
      {
        user_id: userId,
        item: 'Monthly Rent 🏠',
        amount: 1200.00,
        currency: 'CAD',
        category_id: categoryMap.get('Housing'),
        frequency: 'monthly',
        day_of_month: 1,
        is_last_day_of_month: false,
        start_date: getRandomPastDate(90),
        next_occurrence: new Date().toISOString().split('T')[0],
        is_active: true
      },
      {
        user_id: userId,
        item: 'Netflix Subscription 🎬',
        amount: 18.99,
        currency: 'CAD',
        category_id: categoryMap.get('Subscriptions'),
        frequency: 'monthly',
        day_of_month: 15,
        is_last_day_of_month: false,
        start_date: getRandomPastDate(90),
        next_occurrence: new Date().toISOString().split('T')[0],
        is_active: true
      },
      {
        user_id: userId,
        item: 'Gym Membership 🏋️',
        amount: 45.00,
        currency: 'CAD',
        category_id: categoryMap.get('Health & Care'),
        frequency: 'monthly',
        is_last_day_of_month: true,
        start_date: getRandomPastDate(90),
        next_occurrence: new Date().toISOString().split('T')[0],
        is_active: true
      }
    ];

    const { data: insertedRecurring, error: recurInsertError } = await supabase
      .from('recurring_expenses')
      .insert(recurringToInsert)
      .select('*');

    if (recurInsertError || !insertedRecurring) {
      console.error('Failed to seed recurring expenses:', recurInsertError?.message);
      process.exit(1);
    }
    console.log(`Successfully seeded ${insertedRecurring.length} recurring configurations!`);

    // Generate historical logged occurrences for the last 3 months
    console.log('Generating historical logged occurrences for recurring expenses over the past 3 months...');
    const recurringExpensesToInsert = [];
    const today = new Date();

    for (const recur of insertedRecurring) {
      for (let mOffset = 1; mOffset <= 3; mOffset++) {
        const occDate = new Date();
        occDate.setMonth(today.getMonth() - mOffset);
        
        if (recur.day_of_month) {
          occDate.setDate(recur.day_of_month);
        } else if (recur.is_last_day_of_month) {
          // Set to last day of that month
          occDate.setMonth(occDate.getMonth() + 1);
          occDate.setDate(0);
        }
        
        const dateString = occDate.toISOString().split('T')[0];

        recurringExpensesToInsert.push({
          user_id: userId,
          item: recur.item,
          amount: recur.amount,
          original_amount: recur.amount,
          original_currency: 'CAD',
          currency: 'CAD',
          category_id: recur.category_id,
          recurring_expense_id: recur.id,
          is_recurring: true,
          date: new Date(dateString).toISOString(),
          created_at: new Date(dateString).toISOString()
        });
      }
    }

    const { error: recurLogsError } = await supabase
      .from('expenses')
      .insert(recurringExpensesToInsert);

    if (recurLogsError) {
      console.error('Failed to seed recurring logged expenses:', recurLogsError.message);
      process.exit(1);
    }
    console.log(`Successfully seeded ${recurringExpensesToInsert.length} historical recurring logged expenses!`);

    // 5. Generate a large historical dataset (35 realistic expenses)
    console.log('Generating 35 historical expenses spread over the last 90 days...');
    const expensesToInsert = [];

    for (let i = 0; i < 35; i++) {
      // Pick a random sample descriptor
      const desc = SAMPLE_EXPENSES[Math.floor(Math.random() * SAMPLE_EXPENSES.length)];
      const categoryId = categoryMap.get(desc.category);

      if (!categoryId) continue;

      // Generate a random realistic amount (force first 3 to 50.00 CAD to guarantee >1M VND total)
      const amount = i < 3 ? 50.00 : parseFloat((Math.random() * (desc.max - desc.min) + desc.min).toFixed(2));
      
      // Generate a random date in the past 90 days
      // Force the first 3 to be logged today (current month) to ensure stable E2E currency sums!
      const date = i < 3 ? new Date().toISOString().split('T')[0] : getRandomPastDate(90);

      expensesToInsert.push({
        user_id: userId,
        item: desc.item,
        amount, // Base CAD value
        original_amount: amount,
        original_currency: 'CAD',
        currency: 'CAD',
        category_id: categoryId,
        date: new Date(date).toISOString(), // Convert local date to ISO UTC
        created_at: new Date(date).toISOString()
      });
    }

    // Bulk insert expenses
    const { error: expError } = await supabase
      .from('expenses')
      .insert(expensesToInsert);

    if (expError) {
      console.error('Failed to bulk insert historical expenses:', expError.message);
      process.exit(1);
    }

    // 6. Mark onboarding as completed so existing E2E tests can navigate without modal interception
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: userId, onboarding_status: 'completed', base_currency: 'CAD', display_currency: 'CAD' });

    if (profileError) {
      console.warn('Warning: failed to mark onboarding completed:', profileError.message);
    }

    console.log(`Successfully generated & inserted ${expensesToInsert.length} expenses!`);
    console.log('Database seeded beautifully! Ready for local exploration and E2E tests.\n');

  } catch (err: any) {
    console.error('Unexpected error during seeding:', err.message || err);
    process.exit(1);
  }
}

seed();
