import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

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
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('Failed to list users:', listError.message);
      process.exit(1);
    }

    const existingUser = usersData.users.find(u => u.email === TARGET_EMAIL);
    if (existingUser) {
      console.log(`User already exists (ID: ${existingUser.id}). Cleaning up existing user data...`);
      
      // Delete user's records to ensure clean slate
      const { error: expDelError } = await supabase.from('expenses').delete().eq('user_id', existingUser.id);
      if (expDelError) console.warn('Warning: failed to clean expenses:', expDelError.message);
      
      const { error: catDelError } = await supabase.from('categories').delete().eq('user_id', existingUser.id);
      if (catDelError) console.warn('Warning: failed to clean categories:', catDelError.message);

      const { error: recurDelError } = await supabase.from('recurring_expenses').delete().eq('user_id', existingUser.id);
      if (recurDelError) console.warn('Warning: failed to clean recurring_expenses:', recurDelError.message);

      // Delete the auth user
      const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id);
      if (deleteError) {
        console.error('Failed to delete existing auth user:', deleteError.message);
        process.exit(1);
      }
      console.log('Deleted existing auth user.');
    }

    // 2. Create fresh test user
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: TARGET_EMAIL,
      password: TARGET_PASSWORD,
      email_confirm: true // Auto-confirm email so they can log in immediately
    });

    if (createError) {
      console.error('Failed to create test user:', createError.message);
      process.exit(1);
    }

    const userId = createData.user.id;
    console.log(`Created fresh test user. ID: ${userId}`);

    // 3. Fetch categories dynamically created by the Postgres Trigger!
    console.log('Waiting for Postgres trigger to auto-seed default categories...');
    const { data: seededCategories, error: catError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId);

    if (catError || !seededCategories || seededCategories.length === 0) {
      console.error('Failed to verify categories trigger execution:', catError?.message || 'No categories returned');
      process.exit(1);
    }

    console.log(`Trigger verified! Fetched ${seededCategories.length} auto-seeded categories:`);
    console.log(seededCategories.map(c => c.name));

    // Map category name to its newly created local UUID
    const categoryMap = new Map<string, string>();
    seededCategories.forEach(cat => {
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

      // Generate a random realistic amount
      const amount = parseFloat((Math.random() * (desc.max - desc.min) + desc.min).toFixed(2));
      
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

    console.log(`Successfully generated & inserted ${expensesToInsert.length} expenses!`);
    console.log('Database seeded beautifully! Ready for local exploration and E2E tests.\n');

  } catch (err: any) {
    console.error('Unexpected error during seeding:', err.message || err);
    process.exit(1);
  }
}

seed();
