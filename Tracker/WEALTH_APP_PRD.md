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
    * Foreign Key: `id` references `auth.users.id` (1-to-1 relationship).
    * Columns: `display_name` (text), `avatar_url` (text), `base_currency` (text, max length 3).
    * Security: RLS enabled. Users can only select and update where `auth.uid() = id`.
    * Automation: Postgres trigger required to insert a default row into `profiles` automatically upon new user signup in `auth.users`.
  * **Frontend Requirements:**
    * Route: `src/app/(dashboard)/settings/page.tsx` (Protected route).
    * UI Components: Profile editing form, Password update form.
    * Styling: Must utilize standard An-yen glassmorphism (`bg-white/40 backdrop-blur-md border border-white/20`).
    * Data Fetching: Utilize Next.js Server Actions. `updateProfile(data)` mapping to `profiles` table; `updatePassword(newPassword)` reusing `supabase.auth.updateUser()`.
* **Phase 2: Budget "Health Bars" (MVP v2):**
  * **State & Database:** Integrate `budgets` data fetches into store.
  * **Frontend Components:** Implement RPG-style budget "health bars" that transition dynamically from Green (100%) to Yellow (25%).
  * **No Game Overs Philosophy:** When a budget hits 0%, render a Cool Blue/Purple ("Borrowed") status instead of red. Ensure AI companion companionably prompts the user to "Reallocate" funds rather than using negative jargon.
* **Phase 3:**
  * **Budget Rollover Functionality:** Allowing unspent budget to carry over to the next month (deferred from MVP v2 to keep initial launch simple).
  * **Advanced Gamification:** Leveling up Savings Avatars, unlocking new tiers.
