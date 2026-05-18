'use client';
import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface BudgetErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function BudgetError({ error, reset }: BudgetErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 min-h-[400px] bg-white/60 backdrop-blur-xl border border-white/30 shadow-xl rounded-3xl p-8 text-center">
      <div className="w-16 h-16 bg-zen-peach/20 border border-zen-peach rounded-full flex items-center justify-center text-amber-600 shadow-inner">
        <AlertCircle size={32} />
      </div>
      <div className="flex flex-col gap-2 max-w-md">
        <h2 className="font-bold text-2xl text-zen-charcoal m-0">Failed to Load Budget Planner</h2>
        <p className="text-sm text-zen-charcoal/70 leading-relaxed m-0">
          {error.message || 'An unexpected error occurred while fetching your budget data. Please verify your network connection and try again.'}
        </p>
      </div>
      <button 
        type="button"
        onClick={reset}
        className="px-8 py-4 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-base cursor-pointer border-none shadow-md flex items-center gap-2"
      >
        <RefreshCw size={16} />
        <span>Retry Loading</span>
      </button>
    </div>
  );
}
