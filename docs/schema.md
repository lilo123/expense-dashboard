# An-yen Expense Dashboard - Database Schema & Architecture

This document outlines the PostgreSQL database schema, table relationships, indexing optimizations, and stored SQL RPC procedures powering the An-yen Expense Dashboard.

---

## 🗄️ 1. Core Tables & Relationships

```
┌────────────────────────┐         ┌────────────────────────┐
│       categories       │◀────────│        expenses        │
├────────────────────────┤         ├────────────────────────┤
│ id (UUID, PK)          │         │ id (UUID, PK)          │
│ user_id (UUID, FK)     │         │ user_id (UUID, FK)     │
│ name (TEXT)            │         │ category_id (UUID, FK) │
│ color (TEXT)           │         │ amount (NUMERIC)       │
│ icon (TEXT)            │         │ currency (TEXT)        │
└────────────────────────┘         │ date (TIMESTAMPTZ)     │
            ▲                      └────────────────────────┘
            │
┌───────────┴────────────┐         ┌────────────────────────┐
│        budgets         │         │     exchange_rates     │
├────────────────────────┤         ├────────────────────────┤
│ id (UUID, PK)          │         │ id (UUID, PK)          │
│ user_id (UUID, FK)     │         │ base_currency (TEXT)   │
│ category_id (UUID, FK) │         │ rates (JSONB)          │
│ amount (NUMERIC)       │         │ updated_at (TIMESTAMP) │
└────────────────────────┘         └────────────────────────┘
```

---

## ⚡ 2. Indexing Strategy

To ensure lightning-fast query performance and prevent free-tier CPU spikes, all primary foreign keys utilize explicit PostgreSQL B-Tree indexing:

### A. Budgets Foreign Key Index
Added in Phase 3 migration (`20260516232346_add_budgets_category_idx.sql`) to optimize cascading deletions and category budget joins:
```sql
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON budgets (category_id);
```

### B. Expenses Query Indexes
Optimizes filtering by user and date ranges:
```sql
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses (user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date DESC);
```

---

## 🛠️ 3. SQL RPC Stored Procedures

### `get_monthly_aggregates`
Offloads heavy client-side JavaScript array mapping and category summing directly to the PostgreSQL engine.

* **Parameters:** `p_user_id UUID`, `p_start_date DATE`, `p_end_date DATE`
* **Returns:** Table of `(category_id UUID, category_name TEXT, total_amount NUMERIC, budget_amount NUMERIC)`
* **Usage:** Called securely via Supabase RPC inside Next.js Server Actions (`actions.ts`).

---

## 🔐 4. Row Level Security (RLS)

All tables enforce strict RLS policies guaranteeing data isolation across multi-tenant user boundaries:
```sql
-- Example Expenses Policy
CREATE POLICY "Users can only access their own expenses"
ON expenses FOR ALL
USING (auth.uid() = user_id);
```
