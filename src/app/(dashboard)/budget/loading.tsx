import React from 'react';

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function BudgetPlannerSkeleton() {
  return (
    <div data-testid="budget-planner-skeleton" className="flex flex-col gap-6 text-left animate-pulse pb-16">
      
      {/* Top Navigation Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="w-36 h-6 bg-white/30 rounded-full" />
        <div className="flex items-center gap-3">
          <div className="w-24 h-6 bg-white/30 rounded-full" />
          <div className="w-24 h-10 bg-white/30 rounded-full" />
        </div>
      </div>

      {/* Sticky Global Utility Toolbar Skeleton */}
      <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-md rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-24 h-8 bg-white/40 rounded-full" />
          <div className="w-32 h-4 bg-white/30 rounded-full" />
        </div>
        <div className="w-44 h-9 bg-white/40 rounded-full" />
      </div>

      {/* Month Accordions: January is expanded by default, others are collapsed */}
      <div className="flex flex-col gap-4">
        {MONTH_LABELS.map((monthName, idx) => {
          const isFirst = idx === 0;
          return (
            <div key={monthName} className="bg-white/60 border border-white/20 shadow-sm rounded-3xl overflow-hidden">
              
              {/* Accordion Header Skeleton */}
              <div className="w-full px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-lg text-zen-charcoal/50">{monthName}</span>
                  <div className="w-16 h-5 bg-white/40 rounded-full" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-5 bg-white/40 rounded-full" />
                  <div className="w-5 h-5 bg-white/40 rounded-full" />
                </div>
              </div>

              {/* Expanded January Skeleton Content to ensure zero layout shift */}
              {isFirst && (
                <div className="px-6 pb-6 pt-2 border-t border-zen-lavender/20 flex flex-col gap-6">
                  
                  {/* Total Ceil / Unallocated cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="w-full h-12 bg-white/40 rounded-full animate-pulse" />
                    <div className="w-full h-12 bg-white/40 rounded-2xl animate-pulse" />
                  </div>

                  {/* Category Inputs Mock Rows */}
                  <div className="flex flex-col gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="w-full h-16 bg-white/40 rounded-2xl animate-pulse" />
                    ))}
                  </div>

                  {/* Action Buttons Skeleton Footer */}
                  <div className="flex justify-end gap-3 mt-2">
                    <div className="w-32 h-11 bg-white/40 rounded-full animate-pulse" />
                    <div className="w-48 h-11 bg-white/40 rounded-full animate-pulse" />
                  </div>

                </div>
              )}

            </div>
          );
        })}
      </div>

    </div>
  );
}
