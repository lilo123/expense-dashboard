'use client';
import { useActionState, useEffect } from 'react';
import { saveBulkBudgets } from '@/app/actions/budget';
import { X, AlertCircle } from 'lucide-react';

interface BudgetDTO {
  id: string;
  category_id: string | null;
  limit_amount: number;
  currency: string;
  month: string;
}

interface TargetMonthSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceMonthStr: string; // YYYY-MM
  sourceMonthIndex: number; // 0-11
  selectedYear: string;
  optimisticBudgets: BudgetDTO[];
  setOptimisticBudgets: (update: { targetMonths: string[]; allocations: BudgetDTO[] }) => void;
  displayCurrency: string;
  setAnnouncement: (msg: string) => void;
  onSuccess: () => void;
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function TargetMonthSelectionModal({
  isOpen,
  onClose,
  sourceMonthStr,
  sourceMonthIndex,
  selectedYear,
  optimisticBudgets,
  setOptimisticBudgets,
  displayCurrency,
  setAnnouncement,
  onSuccess
}: TargetMonthSelectionModalProps) {
  const [state, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const targetMonths = formData.getAll('targetMonths') as string[];
      if (targetMonths.length === 0) {
        return { success: false, error: 'Please select at least one target month.' };
      }

      const sourceBudgets = optimisticBudgets.filter(b => b.month === sourceMonthStr);
      const payload = sourceBudgets.map(b => ({
        category_id: b.category_id,
        limit_amount: b.limit_amount,
        currency: displayCurrency
      }));

      const optimisticAdditions: BudgetDTO[] = [];
      targetMonths.forEach(m => {
        sourceBudgets.forEach((b, idx) => {
          optimisticAdditions.push({
            id: `opt-${m}-${idx}`,
            category_id: b.category_id,
            limit_amount: b.limit_amount,
            currency: displayCurrency,
            month: m
          });
        });
      });
      setOptimisticBudgets({ targetMonths, allocations: optimisticAdditions });

      const res = await saveBulkBudgets(sourceMonthStr, targetMonths, payload);
      if (res.success) {
        setAnnouncement(`Propagated ${MONTH_LABELS[sourceMonthIndex]} budget to ${targetMonths.length} months. [${Date.now()}]`);
        return { success: true };
      } else {
        return { success: false, error: res.error || 'Failed to propagate budget.' };
      }
    },
    { success: false }
  );

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-zen-charcoal/40 backdrop-blur-sm p-4 animate-fade-in" 
      onClick={e => { if (e.target === e.currentTarget && !isPending) onClose(); }}
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="selection-modal-title"
        className="bg-white/90 border border-white/50 shadow-2xl rounded-3xl p-8 w-full max-w-md flex flex-col gap-6 text-zen-charcoal text-left animate-scale-up max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-zen-lavender/20 pb-4">
          <h2 id="selection-modal-title" className="text-xl font-extrabold m-0 text-zen-charcoal">
            Apply {MONTH_LABELS[sourceMonthIndex]} Budget
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-11 h-11 rounded-full bg-white/60 border border-zen-lavender/40 flex items-center justify-center text-zen-charcoal hover:bg-white/80 transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {state.error && (
          <div className="p-4 bg-zen-peach/20 border border-zen-peach text-zen-charcoal rounded-2xl text-sm font-semibold flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-6">
          <p className="text-sm text-zen-charcoal/70 m-0 leading-relaxed font-medium">
            Select the target months in <strong className="text-zen-charcoal font-bold">{selectedYear}</strong> to receive the budget allocation from <strong className="text-zen-charcoal font-bold">{MONTH_LABELS[sourceMonthIndex]}</strong>:
          </p>

          <div className="flex flex-col gap-2 overflow-y-auto max-h-[40dvh] pr-1">
            {MONTH_LABELS.map((mName, i) => {
              if (i === sourceMonthIndex) return null;
              const mStr = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
              const hasBgt = optimisticBudgets.some(b => b.month === mStr);
              
              return (
                <label 
                  key={mStr} 
                  className="flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all hover:bg-zen-lavender/20 active:scale-[0.99] bg-white/40 border border-white/20 select-none"
                >
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      name="targetMonths" 
                      value={mStr} 
                      defaultChecked={i > sourceMonthIndex}
                      disabled={isPending}
                      className="w-4 h-4 accent-zen-sage cursor-pointer rounded" 
                    />
                    <span className="font-semibold text-sm text-zen-charcoal">{mName}</span>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs ${hasBgt ? 'bg-zen-sage/30 text-zen-charcoal border border-zen-sage font-extrabold' : 'bg-zen-lavender/20 text-zen-charcoal/70 border border-zen-lavender/40 font-bold'}`}>
                    {hasBgt ? 'Allocated' : 'Not set'}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-zen-lavender/20">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white/60 border border-zen-lavender/40 text-zen-charcoal rounded-full font-semibold hover:bg-white/80 transition-all text-sm cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="px-8 py-3 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-sm cursor-pointer border-none shadow-md disabled:opacity-40 flex items-center justify-center"
            >
              {isPending ? 'Applying...' : 'Apply Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
