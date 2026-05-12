'use client';

import { StoreProvider } from '@/store/useExpenseStore';
import SettingsForm from './SettingsForm';
import { Category, Expense } from '@/types/database';

interface SettingsWrapperProps {
  userEmail: string;
  initialCategories: Category[];
  initialExpenses: Expense[];
}

export default function SettingsWrapper({ userEmail, initialCategories, initialExpenses }: SettingsWrapperProps) {
  return (
    <StoreProvider initialData={{ categories: initialCategories, expenses: initialExpenses }}>
      <SettingsForm userEmail={userEmail} />
    </StoreProvider>
  );
}
