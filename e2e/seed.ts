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

const DEFAULT_CATEGORIES = [
  { name: 'Food', icon: '🍔' },
  { name: 'Transport', icon: '🚗' },
  { name: 'Utilities', icon: '⚡' }
];

// Sample realistic expense descriptors
const SAMPLE_EXPENSES = [
  { category: 'Food', item: 'Weekly Groceries 🛒', min: 45.0, max: 120.0 },
  { category: 'Food', item: 'Matcha Latte 🍵', min: 4.50, max: 7.50 },
  { category: 'Food', item: 'Cozy Coffee ☕', min: 3.50, max: 6.00 },
  { category: 'Food', item: 'Dinner with Friends 🍕', min: 25.0, max: 85.0 },
  { category: 'Food', item: 'Lunch Sandwich 🥪', min: 8.50, max: 15.50 },
  { category: 'Food', item: 'Organic Salad 🥗', min: 12.0, max: 18.0 },
  
  { category: 'Transport', item: 'Uber Ride 🚗', min: 8.0, max: 38.0 },
  { category: 'Transport', item: 'Train Ticket 🎫', min: 15.0, max: 45.0 },
  { category: 'Transport', item: 'Bus Fare 🚌', min: 2.25, max: 4.50 },
  { category: 'Transport', item: 'Gas Refill ⛽', min: 35.0, max: 65.0 },
  { category: 'Transport', item: 'Bikeshare 🚲', min: 3.0, max: 8.0 },
  
  { category: 'Utilities', item: 'Electric Bill ⚡', min: 65.0, max: 130.0 },
  { category: 'Utilities', item: 'Water Bill 💧', min: 30.0, max: 55.0 },
  { category: 'Utilities', item: 'Internet Fiber 🌐', min: 59.99, max: 79.99 },
  { category: 'Utilities', item: 'Phone Plan 📱', min: 35.0, max: 65.0 }
];

// Helper to generate a random date in the past N days
function getRandomPastDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  // Format as local YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function seed() {
  console.log(`\n=== Seeding A Large Historical Test Dataset ===`);
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
      await supabase.from('expenses').delete().eq('user_id', existingUser.id);
      await supabase.from('categories').delete().eq('user_id', existingUser.id);

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
      email_confirm: true // Auto-confirm email
    });

    if (createError) {
      console.error('Failed to create test user:', createError.message);
      process.exit(1);
    }

    const userId = createData.user.id;
    console.log(`Created fresh test user. ID: ${userId}`);

    // 3. Seed default categories
    console.log('Seeding default categories...');
    const categoriesToInsert = DEFAULT_CATEGORIES.map(cat => ({
      user_id: userId,
      name: cat.name
    }));

    const { data: seededCategories, error: catError } = await supabase
      .from('categories')
      .insert(categoriesToInsert)
      .select('*');

    if (catError || !seededCategories) {
      console.error('Failed to seed categories:', catError?.message || 'No data returned');
      process.exit(1);
    }
    console.log('Seeded categories:', seededCategories.map(c => c.name));

    // Map category name to its newly created local UUID
    const categoryMap = new Map<string, string>();
    seededCategories.forEach(cat => {
      categoryMap.set(cat.name, cat.id);
    });

    // 4. Generate a large historical dataset (35 realistic expenses)
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
      const date = getRandomPastDate(90);

      expensesToInsert.push({
        user_id: userId,
        item: desc.item,
        amount,
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
