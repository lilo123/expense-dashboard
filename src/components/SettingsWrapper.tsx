'use client';

import { StoreProvider } from '@/store/useExpenseStore';
import SettingsForm from './SettingsForm';

interface SettingsWrapperProps {
  userEmail: string;
}

export default function SettingsWrapper({ userEmail }: SettingsWrapperProps) {
  return (
    <StoreProvider initialData={{}}>
      <SettingsForm userEmail={userEmail} />
    </StoreProvider>
  );
}
