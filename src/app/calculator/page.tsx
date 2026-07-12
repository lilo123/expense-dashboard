import React, { Suspense } from 'react';
import { CalculatorParams } from './CalculatorParams';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

export const metadata = {
  title: 'Retirement Calculator | FI Calc Simulator',
  description: 'Mathematically rigorous retirement simulation engine modeled after ficalc.app',
};

export default function CalculatorPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          FI Calc Retirement Simulator
        </h1>
        <p className="mt-2 text-sm text-gray-600 max-w-2xl">
          Test your withdrawal strategy against historical market data (1871–present). Explore capital preservation rules, dynamic spending guardrails, and asset glide paths.
        </p>
      </header>

      <Suspense fallback={<div className="p-12 text-center text-gray-500 animate-pulse">Loading Calculator...</div>}>
        <NuqsAdapter>
          <CalculatorParams />
        </NuqsAdapter>
      </Suspense>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-8 border-t border-gray-200 text-center text-xs text-gray-500">
        <p>
          Inspired by and modeled after <a href="https://ficalc.app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">ficalc.app</a>, created by James. We extend our deepest gratitude to James for his incredible contributions to the financial independence community.
        </p>
      </footer>
    </div>
  );
}
