export interface Category {
  id: string;
  user_id?: string;
  name: string;
}

export interface Expense {
  id: string;
  user_id: string;
  item: string;
  amount: number;            // Normalized value in base currency (for sums/aggregates)
  original_amount?: number;   // Raw spent receipt value
  original_currency?: string; // Original currency spent
  currency?: string;          // Legacy compatibility mapping to original_currency
  category_id: string;
  date: string;
  created_at: string;
  recurring_expense_id?: string | null;
  categories?: {
    name: string;
  };
}

export interface User {
  id: string;
  email?: string;
}

export interface ExchangeRates {
  id: string;
  base_currency: string;
  rates: Record<string, number>;
  updated_at: string;
}

export type SupportedCurrency = 'CAD' | 'VND' | 'USD' | 'EUR' | 'JPY' | 'GBP' | 'SGD';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  base_currency: SupportedCurrency;
  budget_reset_day: number;
  ai_tone: string;
  timezone: string;
  updated_at: string;
}

export interface RecurringExpense {
  id: string;
  user_id: string;
  item: string;
  amount: number;
  currency: string;
  category_id: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  next_occurrence: string;
  is_active: boolean;
  created_at: string;
  categories?: {
    name: string;
  };
}
