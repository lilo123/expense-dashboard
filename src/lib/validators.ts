import { z } from 'zod';

export const ExpenseInputSchema = z.object({
  item: z.string().min(1, 'Description is required').max(100, 'Description must be under 100 characters').trim(),
  amount: z.number({ message: 'Amount must be a number' }).positive('Amount must be positive').lt(1000000, 'Amount must be under $1,000,000'),
  original_amount: z.number({ message: 'Original amount must be a number' }).positive('Original amount must be positive').lt(1000000, 'Original amount must be under $1,000,000'),
  original_currency: z.string().min(1, 'Original currency is required'),
  currency: z.string().min(1, 'Currency is required'),
  category_id: z.string().min(1, 'Category ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  is_recurring: z.boolean().optional(),
  recurring_expense_id: z.string().nullable().optional()
});

export const CategoryInputSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100, 'Category name must be under 100 characters').trim()
});
