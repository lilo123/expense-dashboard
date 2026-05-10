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
