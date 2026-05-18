import { ReactNode } from 'react';

export default function BudgetLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      {children}
    </div>
  );
}
