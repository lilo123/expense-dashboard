# Wealth App PRD

## 1. App Vibe & UI/UX
* **Design:** Highly Gamified experience (streaks, achievements, micro-interactions).
* **AI Persona:** Encouraging coach/companion (not a strict accountant).
* **Core Loop:** When logging expenses, the AI provides:
  1. Confirmation + Emoji ("Got it! $5 for coffee ☕")
  2. Status Update ("You have $45 left in your coffee budget.")
  3. Micro-Reward/Hype ("That's a 3-day logging streak! Keep it up! 🔥")

## 2. MVP v2 Core Feature: Budget "Health Bars"
* RPG-style health bars for budgets.
* Starts Vibrant Green (100%), fades to Yellow/Orange (25%).
* Hits 0%: Turns Cool Blue/Purple ("Borrowed" or "Over-limit") instead of red, avoiding "Game Over" anxiety. AI will suggest reallocating funds rather than punishing the user.

## 3. Database Schema

### `categories` table
* `id` (UUID)
* `user_id` (UUID)
* `name` (String)
* `is_active` (Boolean, Default: true)

### `budgets` table
* `id` (UUID)
* `user_id` (UUID)
* `category_id` (Foreign Key to `categories`, Nullable for global budgets)
* `limit_amount` (Exact Decimal type to prevent JS floating-point errors)
* `period` (Default: monthly)
* **Safe Deletion:** Foreign keys must use `ON DELETE CASCADE` to prevent database crashes if a custom category is deleted.
* **Indexing [NEW]:** Explicit B-Tree index on `category_id` (`idx_budgets_category_id`) to optimize cascading deletions and prevent free-tier Supabase database CPU spikes.

### `expenses` table
* `id` (UUID)
* `user_id` (UUID)
* `item` (String)
* `amount` (Exact Decimal type - Normalized to CAD base currency for fast aggregates)
* `original_amount` (Exact Decimal type - Raw transaction spent receipt value)
* `original_currency` (String - spent currency, default 'CAD')
* `currency` (String - duplicate tag for backwards compatibility, default 'CAD')
* `category_id` (Foreign Key to `categories`, Nullable)
* `date` (DATE type - calendar format without time to immunize dates against midnight timezone offset bugs)
* `created_at` (Timestamp with timezone)

### `exchange_rates` table
* `id` (UUID Primary Key)
* `base_currency` (String, default 'CAD')
* `rates` (JSONB - cached daily conversion map for CAD, VND, USD, EUR, JPY, GBP, SGD)
* `updated_at` (Timestamp with timezone)

### `recurring_expenses` table [NEW]
* `id` (UUID Primary Key)
* `user_id` (UUID Foreign Key to `auth.users` ON DELETE CASCADE)
* `category_id` (UUID Foreign Key to `categories.id` ON DELETE SET NULL)
* `item` (String - expense title)
* `amount` (Exact Decimal type)
* `currency` (String - code default 'CAD')
* `frequency` (String: 'weekly' | 'monthly' - restricted to weekly and monthly options for MVP)
* `day_of_week` (Integer - weekly weekday index 0-6, nullable)
* `day_of_month` (Integer - monthly day index 1-31, nullable)
* `is_last_day_of_month` (Boolean, default false)
* `start_date` (DATE type)
* `end_date` (DATE type, nullable - specific expiration date)
* `max_occurrences` (Integer, nullable - expiration limit by runs count)
* `num_occurrences` (Integer, default 0 - tracking counter for occurrences limits)
* `next_occurrence` (DATE type - calculated dynamically by triggers)
* `is_active` (Boolean, default true)
* `created_at` (Timestamp with timezone)

### `stored_procedures` [NEW]
* `get_monthly_aggregates(p_user_id UUID, p_start_date DATE, p_end_date DATE)`: RPC SQL stored procedure offloading complex category expense summing and budget comparisons from browser memory directly to PostgreSQL.


## 4. Edge Cases & Robustness
* **Zero-Dollar Budgets:** Safely handle $0 budgets (prevent divide-by-zero errors in health bar percentages if a user wants to block spending in a category).
* **Timezones:** Budget math must strictly respect the user's local timezone (avoiding UTC crossover bugs at midnight on the last day of the month).
* **Graceful Degradation / Blanket Error Handling:**
  * Global Catch-All: *"Uh oh, the system tripped up! Don't worry, your data is safe. Let's try that again."*
  * Raw backend/DB errors must NEVER surface to the UI.

## 5. Future Roadmap
* **Phase 1.6: Automated Testing (Jest + Playwright) - [COMPLETED]**: Locked down the refactored React logic with Jest unit tests and Playwright E2E tests (including BFF network mocks).
* **Phase 1.65: Base Categories Seeding & Currency System:**
  * **Seed Categories on Signup:**
    * **Database Automation**: Implement a Postgres Trigger (`after_user_signup`) on `auth.users` that automatically inserts 16 default categories into `public.categories` for the newly created user ID.
    * **16 Default Categories**: Housing, Utilities, Insurance, Groceries, Dining Out, Transportation, Household, Health & Care, Subscriptions, Shopping, Entertainment, Travel, Gifts, Education, Misc, Sport.
  * **Multi-Currency System:**
    * **Database Schema Requirements**:
      * Table `expenses`: Add `currency` column (text, max length 3, default 'USD').
      * Table `exchange_rates` [NEW]:
        * Columns: `id` (UUID PK, Default random), `base_currency` (text, length 3, default 'USD'), `rates` (jsonb), `updated_at` (timestamptz).
    * **Exchange Rates Sync**:
      * Implement a Server Action `syncExchangeRates()` that queries a free FX API (e.g. ExchangeRate-API) for 6 core currencies (USD, EUR, JPY, GBP, SGD, VND) and caches the rates inside `exchange_rates` daily.
    * **Frontend Integration**:
      * Store display currency preference (`displayCurrency`, default 'USD') in Zustand store.
      * Add currency selectors when manual logging or editing expenses.
      * Dynamically convert totals and chart segments to match preferred display currency.
* **Phase 1.7: User Settings & Profile Management:**
  * **Database Schema Requirements:**
    * Table Name: `profiles`
    * Foreign Key: `id` references `auth.users.id` (1-to-1 relationship, Cascade delete).
    * Columns: `display_name` (text, nullable), `avatar_url` (text, nullable), `base_currency` (VARCHAR(3), default 'CAD'), `budget_reset_day` (integer, default 1), `ai_tone` (text, default 'nurturing').
    * Security: RLS enabled. Users can only select and update where `auth.uid() = id`.
    * Automation: Refactored signup categories trigger function (`seed_default_categories()`) to automatically insert a default profile row first, then seed default categories inside a single exception-safe database transaction block.
  * **Frontend Requirements:**
    * Route: `src/app/(dashboard)/settings/page.tsx` (Protected route).
    * UI Components: Profile editing form, Password update form.
    * Styling: Must utilize standard An-yen glassmorphism (`bg-white/40 backdrop-blur-md border border-white/20`).
    * Data Fetching: Utilize Next.js Server Actions. `updateProfile(data)` mapping to `profiles` table; `updatePassword(newPassword)` reusing `supabase.auth.updateUser()`.
* **Phase 1.8: Automation & Integration - [COMPLETED]:**
  * **Database Schema Requirements:**
    * Table Name: `recurring_expenses` [NEW] - See details in Section 3.
    * Table `profiles` [MODIFY]: Add `timezone` (text, default 'UTC') to track user local timezones.
    * Table `expenses` [MODIFY]: Add `recurring_expense_id` (UUID FK to `recurring_expenses`, Set Null).
    * Security: RLS enabled on `recurring_expenses`. Users can only manage their own.
  * **Backend Automation (Timezone-Aware & Free Tier Optimized):**
    * Implement PL/pgSQL function `process_recurring_expenses()` (Security Definer, secure search path) to log expenses when the user's local calendar date crosses `next_occurrence`.
    * Implement database trigger `seed_first_next_occurrence()` to automatically seed the first next occurrence upon initial insertion of recurring expenses.
    * Schedule hourly worker execution via `pg_cron` (`0 * * * *`) to process global timezones quickly.
    * Schedule daily janitor execution via `pg_cron` (`0 0 * * *`) to purge `cron.job_run_details` logs older than 7 days to protect the 500 MB Free Tier limit.
  * **UI/UX Refactoring (An-yen Vibe & Strict Vocabulary):**
    * **Category Relocation:** Move category management from dashboard FAB modal to inline card on Settings page (`/settings`).
    * **Profile Menu:** Inject strictly `"Recurring Expense"` (avoiding `"Management"`) above "Siri Setup" in the user dropdown.
    * **Recurring Expense Modal [NEW]:** Grid-style dashboard displaying running configurations at the top level, with centered bottom-aligned primary `+ Add New` CTA buttons, and left-aligned grid rows.
    * **Form Setup View [NEW]:**
      * Inputs: Item, Amount, Start Date, Frequency, Category.
      * Weeklyweekday pills selector if Weekly frequency is active.
      * Last Day of the Month checkbox and log on specific day dropdown if Monthly is active.
      * **Ends Radio Panel**: Integrated inline radios (`Never`, `On` [date selector], `After` [occurrences count input]) to handle schedulers expiration parameters gracefully.
      * **Real-Time Client-Side Date Calculator**: Mirrors backend DDL triggers to calculate and output: `"First expense will be logged on [Calculated Date]"` in real-time as values shift.
    * **Yearly Chart [MODIFY]:** Add minimalist "Simple / Breakdown" pill toggle. When breakdown is active, render a stacked bar chart showing Sage Green (Recurring) vs Lavender (One-off) segments, hiding datalabels for clean aesthetics.
    * **Recent Tab Enhancements [NEW]:**
      * **Search**: Add search input to filter expenses by item name (case-insensitive).
      * **Filters**: Add Category dropdown (from database categories) and Type dropdown (All, One-off, Recurring).
      * **Sort**: Add Sort dropdown supporting Date (Newest/Oldest first) and Value (Highest/Lowest first).
      * **Coexistence**: Ensure search, filters, and sorting operate together dynamically via a unified client-side data pipeline.
      * **Recurring Tag**: Add a small, brand-aligned recurring loop SVG next to the expense date (using `text-zen-sage` or `text-zen-lavender` with smooth transitions) for items linked to `recurring_expense_id`.
      * **Optimistic Empty State**: Render a frosted glass card (`bg-white/40 backdrop-blur-md border border-white/20 rounded-3xl p-8 text-center`) displaying a calm message (*"No expenses found for this view. You are all caught up!"*) in Deep Charcoal if the filtered results are empty.
      * **Premium Mobile-Only UX upgrades [NEW]**:
        * **Press-and-Hold (Long Press) Selection**: Remove the manual `"Select"` button on Mobile viewports, replacing it with intuitive touch-gestures. Long pressing any list item card for `500ms` triggers a tactile vibration feedback (`navigator.vibrate(50)`), activates Bulk Select mode, and checks the card dynamically. Includes scroll-move safety hooks to prevent gesture conflicts during scrolling.
        * **Responsive Layout Shifting**: Duplicate-render the Sort dropdown (Desktop instance inside the filters box; Mobile instance on the left edge of the controls row next to shortened `"Edit"` and `"Delete"` action buttons). Hide the desktop instance on mobile to eliminate layout duplicates.
        * **Transparent Overlay Select Pattern**: Style a custom button displaying `Sort by [Selected Option]` dynamically (e.g., `Sort by Date: Newest` as the default prompt), overlaying a fully transparent native `<select>` on top of it. This locks standard desktop/mobile responsive picker menus with custom visual prefixes beautifully.
        * **Automated Height Validation Guardrails**: Lock the vertical height of all filter search dropdown buttons to exactly `36px` (`h-9`) with explicit `minHeight: 0` and `box-border` overrides. Enforce this visual symmetry by compiling a mathematical E2E height comparison test case inside the test runner.
* **Phase 2: Budget "Health Bars" (MVP v2):**
  * **State & Database:** Integrate `budgets` data fetches into store.
  * **Frontend Components:** Implement RPG-style budget "health bars" that transition dynamically from Green (100%) to Yellow (25%).
  * **No Game Overs Philosophy:** When a budget hits 0%, render a Cool Blue/Purple ("Borrowed") status instead of red. Ensure AI companion companionably prompts the user to "Reallocate" funds rather than using negative jargon.
* **Phase 3:**
  * **Budget Rollover Functionality:** Allowing unspent budget to carry over to the next month (deferred from MVP v2 to keep initial launch simple).
  * **Advanced Gamification:** Leveling up Savings Avatars, unlocking new tiers.
