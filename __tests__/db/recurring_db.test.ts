/**
 * @jest-environment node
 */
import { Client } from 'pg';

describe('Database Schema & Automation Integration Tests (Phase 1.8 Refinements)', () => {
  let client: Client;
  let userId: string;
  let categoryId: string;

  beforeAll(async () => {
    client = new Client({
      connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
    });
    await client.connect();

    // Acquire a valid user profile ID to bypass constraints in tests
    const profileRes = await client.query('SELECT id FROM public.profiles LIMIT 1');
    if (profileRes.rows.length > 0) {
      userId = profileRes.rows[0].id;
    } else {
      // Fallback seed dummy user
      userId = '00000000-0000-0000-0000-000000000002';
      await client.query(`
        INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role) 
        VALUES ($1, 'db_test@example.com', '{}', '{}', 'authenticated', 'authenticated')
        ON CONFLICT DO NOTHING
      `, [userId]);
      await client.query(`
        INSERT INTO public.profiles (id, display_name, base_currency, budget_reset_day, ai_tone, timezone)
        VALUES ($1, 'DB Test User', 'CAD', 1, 'nurturing', 'UTC')
        ON CONFLICT DO NOTHING
      `, [userId]);
    }

    // Acquire or seed a test category
    const catRes = await client.query('SELECT id FROM public.categories WHERE user_id = $1 LIMIT 1', [userId]);
    if (catRes.rows.length > 0) {
      categoryId = catRes.rows[0].id;
    } else {
      const newCat = await client.query(`
        INSERT INTO public.categories (user_id, name) 
        VALUES ($1, 'DB Integration Test Category') 
        RETURNING id
      `, [userId]);
      categoryId = newCat.rows[0].id;
    }
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    // Wrap each test in a transaction that we will ROLLBACK to ensure no side effects
    await client.query('BEGIN');
  });

  afterEach(async () => {
    await client.query('ROLLBACK');
  });

  const formatDateString = (d: any): string => {
    const dateObj = new Date(d);
    const year = dateObj.getUTCFullYear();
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  test('Weekly schedule trigger - start_date aligns forward to next Monday', async () => {
    // 2026-05-11 is Monday. Setting start_date to 2026-05-12 (Tuesday).
    // Target day_of_week is Monday (1). Initial occurrence should align forward to next Monday (2026-05-18).
    const res = await client.query(`
      INSERT INTO public.recurring_expenses (
        user_id, item, amount, category_id, frequency, start_date, day_of_week
      ) VALUES ($1, 'Rent Weekly Mon', 100, $2, 'weekly', '2026-05-12', 1)
      RETURNING next_occurrence
    `, [userId, categoryId]);

    expect(formatDateString(res.rows[0].next_occurrence)).toBe('2026-05-18');
  });

  test('Weekly schedule trigger - start_date aligns today if day matches', async () => {
    // 2026-05-11 is Monday. Target is Monday (1). Initial occurrence should be today (2026-05-11).
    const res = await client.query(`
      INSERT INTO public.recurring_expenses (
        user_id, item, amount, category_id, frequency, start_date, day_of_week
      ) VALUES ($1, 'Gym Weekly Today', 15, $2, 'weekly', '2026-05-11', 1)
      RETURNING next_occurrence
    `, [userId, categoryId]);

    expect(formatDateString(res.rows[0].next_occurrence)).toBe('2026-05-11');
  });

  test('Monthly specific day - start_date aligns today if day matches', async () => {
    // start_date is May 11. Target day_of_month is 15 (May 15 is in future).
    // Initial occurrence should be May 15.
    const res = await client.query(`
      INSERT INTO public.recurring_expenses (
        user_id, item, amount, category_id, frequency, start_date, day_of_month
      ) VALUES ($1, 'Phone Specific', 50, $2, 'monthly', '2026-05-11', 15)
      RETURNING next_occurrence
    `, [userId, categoryId]);

    expect(formatDateString(res.rows[0].next_occurrence)).toBe('2026-05-15');
  });

  test('Monthly specific day - start_date shifts to next month if target is in the past', async () => {
    // start_date is May 11. Target day_of_month is 5 (May 5 is in past).
    // Initial occurrence should shift to June 5.
    const res = await client.query(`
      INSERT INTO public.recurring_expenses (
        user_id, item, amount, category_id, frequency, start_date, day_of_month
      ) VALUES ($1, 'Sub past-day shift', 9.99, $2, 'monthly', '2026-05-11', 5)
      RETURNING next_occurrence
    `, [userId, categoryId]);

    expect(formatDateString(res.rows[0].next_occurrence)).toBe('2026-06-05');
  });

  test('Monthly last day trigger - sets to last day of the current month', async () => {
    // start_date is May 11. Target is Last Day. Initial occurrence should be May 31 (last day of May).
    const res = await client.query(`
      INSERT INTO public.recurring_expenses (
        user_id, item, amount, category_id, frequency, start_date, is_last_day_of_month
      ) VALUES ($1, 'Rent Last Day', 1200, $2, 'monthly', '2026-05-11', true)
      RETURNING next_occurrence
    `, [userId, categoryId]);

    expect(formatDateString(res.rows[0].next_occurrence)).toBe('2026-05-31');
  });

  test('Timezone-aware hourly logging - worker creates expenses and advances schedule', async () => {
    // User has timezone set to 'Asia/Ho_Chi_Minh' (UTC+7)
    await client.query("UPDATE public.profiles SET timezone = 'Asia/Ho_Chi_Minh' WHERE id = $1", [userId]);
    
    // We insert a configuration due on May 12 (which is today in Ho Chi Minh timezone at 21:30 UTC)
    const mockStartDate = '2026-05-10';
    const mockNextOccurrence = '2026-05-12'; 
    
    const insertRes = await client.query(`
      INSERT INTO public.recurring_expenses (
        user_id, item, amount, category_id, frequency, start_date, next_occurrence, day_of_month
      ) VALUES ($1, 'Due Spotify Item', 14.99, $2, 'monthly', $3, $4, 12)
      RETURNING id
    `, [userId, categoryId, mockStartDate, mockNextOccurrence]);
    
    const flowId = insertRes.rows[0].id;

    // Execute worker
    await client.query('SELECT public.process_recurring_expenses()');

    // Check expense is logged
    const expRes = await client.query('SELECT * FROM public.expenses WHERE recurring_expense_id = $1', [flowId]);
    expect(expRes.rows.length).toBe(1);
    expect(expRes.rows[0].item).toBe('Due Spotify Item');
    expect(formatDateString(expRes.rows[0].date)).toBe('2026-05-12');

    // Check next_occurrence is advanced to June 12
    const configRes = await client.query('SELECT next_occurrence, num_occurrences FROM public.recurring_expenses WHERE id = $1', [flowId]);
    expect(formatDateString(configRes.rows[0].next_occurrence)).toBe('2026-06-12');
    expect(configRes.rows[0].num_occurrences).toBe(1);
  });

  test('Expiration rules - ends config after reaching max_occurrences', async () => {
    await client.query("UPDATE public.profiles SET timezone = 'Asia/Ho_Chi_Minh' WHERE id = $1", [userId]);
    
    // max_occurrences = 1, currently num_occurrences = 0
    const insertRes = await client.query(`
      INSERT INTO public.recurring_expenses (
        user_id, item, amount, category_id, frequency, start_date, next_occurrence, day_of_month, max_occurrences
      ) VALUES ($1, 'One-Off Cron Job', 5.50, $2, 'monthly', '2026-05-10', '2026-05-12', 12, 1)
      RETURNING id
    `, [userId, categoryId]);
    
    const flowId = insertRes.rows[0].id;

    await client.query('SELECT public.process_recurring_expenses()');

    // Verify is_active is turned false
    const configRes = await client.query('SELECT is_active, num_occurrences FROM public.recurring_expenses WHERE id = $1', [flowId]);
    expect(configRes.rows[0].is_active).toBe(false);
    expect(configRes.rows[0].num_occurrences).toBe(1);
  });

  test('Expiration rules - ends config after crossing end_date', async () => {
    await client.query("UPDATE public.profiles SET timezone = 'Asia/Ho_Chi_Minh' WHERE id = $1", [userId]);
    
    // end_date is May 20. Next occurrence is May 12. Advancing by month leads to June 12 (which is > May 20)
    // So it should expire after logging.
    const insertRes = await client.query(`
      INSERT INTO public.recurring_expenses (
        user_id, item, amount, category_id, frequency, start_date, next_occurrence, day_of_month, end_date
      ) VALUES ($1, 'Limited Date Job', 100, $2, 'monthly', '2026-05-10', '2026-05-12', 12, '2026-05-20')
      RETURNING id
    `, [userId, categoryId]);
    
    const flowId = insertRes.rows[0].id;

    await client.query('SELECT public.process_recurring_expenses()');

    // Verify is_active is turned false
    const configRes = await client.query('SELECT is_active FROM public.recurring_expenses WHERE id = $1', [flowId]);
    expect(configRes.rows[0].is_active).toBe(false);
  });

  test('Edge Case - Month Cap (May 31 -> June 30)', async () => {
    const insertRes = await client.query(`
      INSERT INTO public.recurring_expenses (
        user_id, item, amount, category_id, frequency, start_date, day_of_month
      ) VALUES ($1, 'Month Cap Job', 10, $2, 'monthly', '2025-05-31', 31)
      RETURNING id, next_occurrence
    `, [userId, categoryId]);
    
    const flowId = insertRes.rows[0].id;
    expect(formatDateString(insertRes.rows[0].next_occurrence)).toBe('2025-05-31');

    await client.query("UPDATE public.profiles SET timezone = 'UTC' WHERE id = $1", [userId]);
    await client.query('SELECT public.process_recurring_expenses()');

    const configRes = await client.query('SELECT next_occurrence FROM public.recurring_expenses WHERE id = $1', [flowId]);
    expect(formatDateString(configRes.rows[0].next_occurrence)).toBe('2025-06-30');
  });

  test('Edge Case - February Non-Leap Year (Jan 30 -> Feb 28)', async () => {
    const insertRes = await client.query(`
      INSERT INTO public.recurring_expenses (
        user_id, item, amount, category_id, frequency, start_date, day_of_month
      ) VALUES ($1, 'Feb Non-Leap Job', 10, $2, 'monthly', '2026-01-30', 30)
      RETURNING id, next_occurrence
    `, [userId, categoryId]);
    
    const flowId = insertRes.rows[0].id;
    expect(formatDateString(insertRes.rows[0].next_occurrence)).toBe('2026-01-30');

    await client.query("UPDATE public.profiles SET timezone = 'UTC' WHERE id = $1", [userId]);
    await client.query('SELECT public.process_recurring_expenses()');

    const configRes = await client.query('SELECT next_occurrence FROM public.recurring_expenses WHERE id = $1', [flowId]);
    expect(formatDateString(configRes.rows[0].next_occurrence)).toBe('2026-02-28');
  });

  test('Edge Case - February Leap Year (Jan 31 -> Feb 29)', async () => {
    const insertRes = await client.query(`
      INSERT INTO public.recurring_expenses (
        user_id, item, amount, category_id, frequency, start_date, day_of_month
      ) VALUES ($1, 'Feb Leap Job', 10, $2, 'monthly', '2024-01-31', 31)
      RETURNING id, next_occurrence
    `, [userId, categoryId]);
    
    const flowId = insertRes.rows[0].id;
    expect(formatDateString(insertRes.rows[0].next_occurrence)).toBe('2024-01-31');

    await client.query("UPDATE public.profiles SET timezone = 'UTC' WHERE id = $1", [userId]);
    await client.query('SELECT public.process_recurring_expenses()');

    const configRes = await client.query('SELECT next_occurrence FROM public.recurring_expenses WHERE id = $1', [flowId]);
    expect(formatDateString(configRes.rows[0].next_occurrence)).toBe('2024-02-29');
  });
});
