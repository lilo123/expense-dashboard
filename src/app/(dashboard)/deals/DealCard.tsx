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
      case 'exploring': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
      case 'active': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'ready_to_claim': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'claimed': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700';
      default: return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
    }
  };

  const formatCurrency = (val: number | null | undefined, currency: string | null = 'USD') => {
    const validCurrency = currency || 'USD';
    const validVal = Number(val || 0);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: validCurrency, maximumFractionDigits: 0 }).format(isNaN(validVal) ? 0 : validVal);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col transition-all hover:shadow-md p-4">
      {/* 1. Header Row */}
      <div className="flex justify-between items-start mb-3">
        <div className="min-w-0 flex-1 pr-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">{deal.company || 'Unnamed Company'}</h3>
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mt-0.5">
            {deal?.type?.replace('_', ' ')}
          </p>
        </div>
        <div className="flex items-center space-x-3 shrink-0">
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(deal.bonus_amount, deal.currency)}
          </p>
          <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(deal.status).split(' ')[0]}`} title={deal.status}></span>
          <div className="flex space-x-1.5 border-l pl-3 border-gray-200 dark:border-gray-700">
            <button onClick={onEdit} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button onClick={onDelete} className="text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Type-Specific Core Content */}
      <div className="flex-1 mb-3">
        {deal?.type === 'credit_card' && (
          <div>
            {deal.type_specific_data?.card_name && (
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{deal.type_specific_data.card_name}</p>
            )}
            <div className="flex justify-between items-center mb-1 text-xs">
              <span className="text-gray-500">Spend Progress</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(deal.type_specific_data?.spend_progress || 0, deal.currency)} / {formatCurrency(deal.type_specific_data?.target_spend || 0, deal.currency)}
              </span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-blue-500 dark:bg-blue-600 h-full transition-all duration-500 ease-out" 
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
                  className="w-3.5 h-3.5 border-gray-300 dark:border-gray-600 rounded text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                />
                <span className={`text-xs truncate flex-1 ${item.is_done ? 'line-through text-gray-400 opacity-60' : 'text-gray-800 dark:text-gray-200 group-hover:text-black dark:group-hover:text-white transition-colors'}`}>
                  {item.action_text} {item.deadline && <span className="text-gray-400 font-medium ml-1">({item.deadline})</span>}
                </span>
              </label>
            ))}
          </div>
        )}

        {deal?.type === 'brokerage_account' && (
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Fund Committed: <span className="font-bold">{formatCurrency(deal.type_specific_data?.fund_committed || 0, deal.currency)}</span>
          </p>
        )}
      </div>

      {/* Note Block */}
      {deal.note && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded p-2 mb-3 border border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{deal.note}</p>
        </div>
      )}

      {/* 3. Metadata Strip */}
      <div className="flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 p-2 -mx-4 -mb-4 mt-auto rounded-b-lg border-t border-gray-100 dark:border-gray-800/60">
        <span>Open: <strong className="font-semibold text-gray-700 dark:text-gray-300">{deal.open_date || '—'}</strong></span>
        <span>Action: <strong className="font-semibold text-emerald-600 dark:text-emerald-400">{deal.type_specific_data?.action_date || '—'}</strong></span>
      </div>
    </div>
  );
}
