export interface Category {
  id: string;
  user_id?: string;
  name: string;
  icon?: string;
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
  is_recurring: boolean;
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
  email?: string;
  display_name: string | null;
  avatar_url: string | null;
  base_currency: SupportedCurrency;
  display_currency: SupportedCurrency;
  budget_reset_day: number;
  ai_tone: string;
  timezone: string;
  onboarding_status: 'pending' | 'completed';
  role?: 'user' | 'admin';
  tier?: 'standard' | 'premium';
  created_at?: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  limit_amount: number;
  currency: string;
  month: string;
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

export interface InviteRequest {
  id: string;
  email: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected' | 'claimed' | 'processing';
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  subject: string;
  html_body: string;
  updated_at?: string;
}

export type DealType = 'credit_card' | 'bank_account' | 'brokerage_account';
export type DealStatus = 'exploring' | 'active' | 'ready_to_claim' | 'claimed' | 'closed';

export interface DealChecklistItem {
  id: string;
  deal_id: string;
  user_id: string;
  action_text: string;
  deadline: string | null;
  is_done: boolean;
  created_at: string;
  updated_at: string;
}

export interface BaseDeal {
  id: string;
  user_id: string;
  title?: string | null;
  description?: string | null;
  company: string;
  bonus_amount: number;
  open_date: string;
  status: DealStatus;
  note?: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
  checklist?: DealChecklistItem[];
}

export interface CreditCardDeal extends BaseDeal {
  type: 'credit_card';
  card_name: string;
  target_spend: number;
  spend_progress: number;
  date_to_close?: string | null;
  next_churn_date?: string | null;
  date_to_check_bonus?: never;
  fund_committed?: never;
}

export interface BankAccountDeal extends BaseDeal {
  type: 'bank_account';
  date_to_check_bonus?: string | null;
  date_to_close?: string | null;
  card_name?: never;
  target_spend?: never;
  spend_progress?: never;
  next_churn_date?: never;
  fund_committed?: never;
}

export interface BrokerageAccountDeal extends BaseDeal {
  type: 'brokerage_account';
  fund_committed: number;
  date_to_check_bonus?: string | null;
  date_to_close?: string | null;
  card_name?: never;
  target_spend?: never;
  spend_progress?: never;
  next_churn_date?: never;
}

export type Deal = CreditCardDeal | BankAccountDeal | BrokerageAccountDeal;
