export interface Category {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  user_id: string;
  item: string;
  amount: number;
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
