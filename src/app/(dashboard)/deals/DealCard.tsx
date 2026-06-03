'use client';

import { useTransition } from 'react';
import { toggleChecklistItemAction } from '@/app/actions/deals';
import { DealRow, ChecklistItem } from '@/lib/dealValidators';

interface DealCardProps {
  deal: DealRow;
  onEdit: () => void;
  onDelete: () => void;
  setOptimisticDeals: (action: { action: string; deal: DealRow }) => void;
}

export default function DealCard({ deal, onEdit, onDelete, setOptimisticDeals }: DealCardProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggleChecklist = (item: ChecklistItem) => {
    startTransition(async () => {
      if (!item.id) return;
      const updatedDeal = { ...deal };
      updatedDeal.deal_checklist_items = [...(updatedDeal.deal_checklist_items || [])];
      const index = updatedDeal.deal_checklist_items.findIndex(i => i.id === item.id);
      if (index > -1) {
        updatedDeal.deal_checklist_items[index] = { ...item, is_done: !item.is_done };
      }
      setOptimisticDeals({ action: 'update', deal: updatedDeal });
      
      try {
        await toggleChecklistItemAction(item.id, !item.is_done);
      } catch (e) {
        console.error(e);
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'exploring': return 'bg-white/80 text-indigo-950 border-indigo-200';
      case 'active': return 'bg-white/80 text-amber-950 border-amber-200';
      case 'ready_to_claim': return 'bg-white/80 text-blue-950 border-blue-200';
      case 'claimed': return 'bg-zen-sage/30 text-emerald-950 border-zen-sage/50';
      case 'closed': return 'bg-white/60 text-zen-charcoal/60 border-zen-lavender/40';
      default: return 'bg-white/80 text-indigo-950 border-indigo-200';
    }
  };

  const formatCurrency = (val: number | null | undefined, currency: string | null = 'USD') => {
    const validCurrency = currency || 'USD';
    const validVal = Number(val || 0);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: validCurrency, maximumFractionDigits: 0 }).format(isNaN(validVal) ? 0 : validVal);
  };

  return (
    <div className="bg-white/40 backdrop-blur-md hover:bg-white/60 rounded-2xl shadow-sm border border-white/20 flex flex-col transition-all hover:shadow-md p-4">
      {/* 1. Header Row (Company Name, Status Dot & Action Buttons) */}
      <div className="flex justify-between items-start mb-3">
        <div className="min-w-0 flex-1 pr-3">
          <h3 className="text-lg font-extrabold text-zen-charcoal truncate">{deal.company || 'Unnamed Company'}</h3>
          <p className="text-[10px] font-bold text-zen-charcoal/60 uppercase tracking-wider mt-0.5">
            {deal?.type?.replace('_', ' ')}
          </p>
        </div>
        <div className="flex items-center space-x-2.5 shrink-0 pt-0.5">
          <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(deal.status).split(' ')[0]}`} title={deal.status}></span>
          <div className="flex space-x-1 border-l pl-2.5 border-zen-lavender/40">
            <button onClick={onEdit} className="text-zen-charcoal/40 hover:text-zen-charcoal cursor-pointer border-none bg-transparent p-1" title="Edit Deal">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button onClick={onDelete} className="text-red-400 hover:text-red-600 cursor-pointer border-none bg-transparent p-1" title="Delete Deal">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Dedicated Feature Strip: Bonus Reward Display */}
      <div className="bg-white/60 border border-white/40 rounded-xl p-3 mb-4 flex items-center justify-between shadow-xs">
        <span className="text-xs font-bold text-zen-charcoal/70 uppercase tracking-wider">Bonus Reward</span>
        <span className="text-xl font-extrabold text-emerald-800 tracking-wide">
          {formatCurrency(deal.bonus_amount, deal.currency)}
        </span>
      </div>

      {/* 2. Type-Specific Core Content */}
      <div className="flex-1 mb-3">
        {deal?.type === 'credit_card' && (
          <div>
            {!!deal.type_specific_data?.card_name && (
              <p className="text-sm font-semibold text-zen-charcoal mb-2">{String(deal.type_specific_data.card_name)}</p>
            )}
            <div className="flex justify-between items-center mb-1 text-xs">
              <span className="text-zen-charcoal/60">Spend Progress</span>
              <span className="font-semibold text-zen-charcoal">
                {formatCurrency(deal.type_specific_data?.spend_progress || 0, deal.currency)} / {formatCurrency(deal.type_specific_data?.target_spend || 0, deal.currency)}
              </span>
            </div>
            <div className="w-full bg-zen-lavender/20 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-zen-sage h-full transition-all duration-500 ease-out" 
                style={{ width: `${Math.min(100, deal.type_specific_data?.target_spend ? ((deal.type_specific_data.spend_progress || 0) / deal.type_specific_data.target_spend) * 100 : 0)}%` }}
              />
            </div>
          </div>
        )}

        {deal?.type === 'bank_account' && deal.deal_checklist_items && deal.deal_checklist_items.length > 0 && (
          <div className="space-y-1.5">
            {deal.deal_checklist_items.map(item => (
              <label key={item.id} className="flex items-center space-x-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={item.is_done} 
                  disabled={isPending}
                  onChange={() => handleToggleChecklist(item)}
                  className="w-3.5 h-3.5 border-zen-lavender/40 rounded text-zen-sage focus:ring-zen-sage cursor-pointer disabled:opacity-50 accent-zen-sage"
                />
                <span className={`text-xs truncate flex-1 ${item.is_done ? 'line-through text-zen-charcoal/40 opacity-60' : 'text-zen-charcoal font-semibold transition-colors'}`}>
                  {item.action_text} {item.deadline && <span className="text-zen-charcoal/50 font-semibold ml-1">({item.deadline})</span>}
                </span>
              </label>
            ))}
          </div>
        )}

        {deal?.type === 'brokerage_account' && (
          <p className="text-sm font-medium text-zen-charcoal">
            Fund Committed: <span className="font-bold">{formatCurrency(deal.type_specific_data?.fund_committed || 0, deal.currency)}</span>
          </p>
        )}
      </div>

      {/* Note Block */}
      {deal.note && (
        <div className="bg-white/40 rounded-xl p-2.5 mb-3 border border-zen-lavender/30">
          <p className="text-xs text-zen-charcoal/80 font-medium leading-relaxed whitespace-pre-wrap">{deal.note}</p>
        </div>
      )}

      {/* 3. Metadata Strip */}
      <div className="flex justify-between items-center text-[11px] text-zen-charcoal/60 bg-white/30 p-3 -mx-4 -mb-4 mt-auto rounded-b-2xl border-t border-white/20">
        <span>Open: <strong className="font-bold text-zen-charcoal">{deal.open_date || '—'}</strong></span>
        <span>Action: <strong className="font-bold text-emerald-800">{deal.type_specific_data?.action_date || '—'}</strong></span>
      </div>
    </div>
  );
}
