'use client';

import { useState, useEffect, useTransition, ChangeEvent, FormEvent } from 'react';
import { createDealAction, updateDealAction } from '@/app/actions/deals';
import { DealRow, ChecklistItem } from '@/lib/dealValidators';
import { DealStatus } from '@/types/database';

interface DealFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingDeal?: DealRow | null;
  setOptimisticDeals?: (action: { action: string; deal: DealRow }) => void;
  defaultCurrency?: string;
}

interface FormDataState {
  company: string;
  status: DealStatus;
  open_date: string;
  note: string;
  currency: string;
  bonus_amount: number | string;
  type: 'credit_card' | 'bank_account' | 'brokerage_account' | 'other' | '';
  card_name?: string;
  target_spend?: number | string;
  spend_progress?: number | string;
  action_date?: string;
  fund_committed?: number | string;
  checklist_items: ChecklistItem[];
}

export default function DealFormModal({ isOpen, onClose, editingDeal, setOptimisticDeals, defaultCurrency }: DealFormModalProps) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(editingDeal ? 2 : 1);
  const [formData, setFormData] = useState<FormDataState>(() => editingDeal ? {
    company: editingDeal.company,
    status: editingDeal.status || 'exploring',
    open_date: editingDeal.open_date || '',
    note: editingDeal.note || '',
    currency: (editingDeal.currency || defaultCurrency || 'USD').toUpperCase(),
    bonus_amount: editingDeal.bonus_amount,
    type: editingDeal.type,
    card_name: editingDeal.type_specific_data?.card_name || '',
    target_spend: editingDeal.type_specific_data?.target_spend ?? '',
    spend_progress: editingDeal.type_specific_data?.spend_progress ?? '',
    action_date: editingDeal.type_specific_data?.action_date || '',
    fund_committed: editingDeal.type_specific_data?.fund_committed ?? '',
    checklist_items: editingDeal.deal_checklist_items || []
  } : {
    company: '',
    status: 'exploring',
    open_date: '',
    note: '',
    currency: (defaultCurrency || 'USD').toUpperCase(),
    bonus_amount: '',
    type: '',
    checklist_items: []
  });

  useEffect(() => {
    if (editingDeal) {
      setStep(2);
      setFormData({
        company: editingDeal.company,
        status: editingDeal.status || 'exploring',
        open_date: editingDeal.open_date || '',
        note: editingDeal.note || '',
        currency: (editingDeal.currency || defaultCurrency || 'USD').toUpperCase(),
        bonus_amount: editingDeal.bonus_amount,
        type: editingDeal.type,
        card_name: editingDeal.type_specific_data?.card_name || '',
        target_spend: editingDeal.type_specific_data?.target_spend ?? '',
        spend_progress: editingDeal.type_specific_data?.spend_progress ?? '',
        action_date: editingDeal.type_specific_data?.action_date || '',
        fund_committed: editingDeal.type_specific_data?.fund_committed ?? '',
        checklist_items: editingDeal.deal_checklist_items || []
      });
    } else {
      setStep(1);
      setFormData({
        company: '',
        status: 'exploring',
        open_date: '',
        note: '',
        currency: (defaultCurrency || 'USD').toUpperCase(),
        bonus_amount: '',
        type: '',
        checklist_items: []
      });
    }
  }, [editingDeal, defaultCurrency, isOpen]);

  if (!isOpen) return null;

  const handleTypeSelect = (type: 'credit_card' | 'bank_account' | 'brokerage_account' | 'other') => {
    setFormData({ ...formData, type });
    setStep(2);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.type) return;

    startTransition(async () => {
      try {
        const payload: any = {
          company: formData.company,
          status: formData.status,
          open_date: formData.open_date || null,
          note: formData.note || null,
          currency: formData.currency,
          bonus_amount: Number(formData.bonus_amount) || 0,
          type: formData.type,
          type_specific_data: {} as Record<string, unknown>,
          checklist_items: formData.checklist_items.filter(i => i.action_text && i.action_text.trim() !== ''),
        };

        if (formData.type === 'credit_card') {
          payload.type_specific_data = {
            card_name: formData.card_name || '',
            target_spend: Number(formData.target_spend) || 0,
            spend_progress: Number(formData.spend_progress) || 0,
            action_date: formData.action_date || null,
          };
        } else if (formData.type === 'bank_account') {
          payload.type_specific_data = {
            action_date: formData.action_date || null,
          };
        } else if (formData.type === 'brokerage_account') {
          payload.type_specific_data = {
            fund_committed: Number(formData.fund_committed) || 0,
            action_date: formData.action_date || null,
          };
        } else if (formData.type === 'other') {
          payload.type_specific_data = editingDeal?.type === 'other' ? { ...editingDeal.type_specific_data } : {};
        }

        if (setOptimisticDeals) {
          const optimisticDeal: DealRow = {
            id: editingDeal ? editingDeal.id : `temp-${Date.now()}`,
            user_id: editingDeal ? editingDeal.user_id : 'temp-user',
            company: payload.company,
            type: payload.type,
            status: payload.status,
            open_date: payload.open_date,
            note: payload.note,
            currency: payload.currency,
            bonus_amount: payload.bonus_amount,
            type_specific_data: payload.type_specific_data,
            deal_checklist_items: payload.checklist_items || []
          };
          setOptimisticDeals({ action: editingDeal ? 'update' : 'add', deal: optimisticDeal });
        }

        if (editingDeal) {
          await updateDealAction(editingDeal.id, payload);
        } else {
          await createDealAction(payload);
        }
        onClose();
      } catch (err) {
        console.error(err);
        alert('An error occurred saving the deal');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zen-charcoal/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-xl border border-zen-lavender/60 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-zen-charcoal">
            {editingDeal ? 'Edit Deal' : 'Add New Deal'}
          </h2>
          <button onClick={onClose} disabled={isPending} className="text-zen-charcoal/40 hover:text-zen-charcoal text-2xl font-bold border-none bg-transparent cursor-pointer disabled:opacity-50">&times;</button>
        </div>

        {step === 1 && !editingDeal && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div onClick={() => handleTypeSelect('credit_card')} className="border border-zen-lavender/60 bg-white/60 rounded-2xl p-6 cursor-pointer hover:border-zen-sage hover:bg-zen-sage/10 transition-all text-center shadow-xs">
              <div className="text-3xl mb-2">💳</div>
              <h3 className="font-bold text-sm text-zen-charcoal">Credit Card</h3>
            </div>
            <div onClick={() => handleTypeSelect('bank_account')} className="border border-zen-lavender/60 bg-white/60 rounded-2xl p-6 cursor-pointer hover:border-zen-sage hover:bg-zen-sage/10 transition-all text-center shadow-xs">
              <div className="text-3xl mb-2">🏦</div>
              <h3 className="font-bold text-sm text-zen-charcoal">Bank Account</h3>
            </div>
            <div onClick={() => handleTypeSelect('brokerage_account')} className="border border-zen-lavender/60 bg-white/60 rounded-2xl p-6 cursor-pointer hover:border-zen-sage hover:bg-zen-sage/10 transition-all text-center shadow-xs">
              <div className="text-3xl mb-2">📈</div>
              <h3 className="font-bold text-sm text-zen-charcoal">Brokerage</h3>
            </div>
            <div onClick={() => handleTypeSelect('other')} className="border border-zen-lavender/60 bg-white/60 rounded-2xl p-6 cursor-pointer hover:border-zen-sage hover:bg-zen-sage/10 transition-all text-center shadow-xs">
              <div className="text-3xl mb-2">📁</div>
              <h3 className="font-bold text-sm text-zen-charcoal">Other</h3>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="deal-company" className="block text-sm font-semibold text-zen-charcoal/80 mb-1">Company</label>
                <input required id="deal-company" type="text" name="company" value={formData.company} onChange={handleChange} className="w-full rounded-2xl border border-zen-lavender/60 bg-white text-zen-charcoal p-2.5 text-sm outline-none focus:border-zen-sage focus:ring-1 focus:ring-zen-sage transition-all shadow-inner" />
              </div>
              <div>
                <label htmlFor="deal-status" className="block text-sm font-semibold text-zen-charcoal/80 mb-1">Status</label>
                <select id="deal-status" name="status" value={formData.status} onChange={handleChange} className="w-full rounded-2xl border border-zen-lavender/60 bg-white text-zen-charcoal p-2.5 text-sm outline-none focus:border-zen-sage focus:ring-1 focus:ring-zen-sage transition-all shadow-inner cursor-pointer">
                  <option value="exploring">Exploring</option>
                  <option value="active">Active</option>
                  <option value="ready_to_claim">Ready to Claim</option>
                  <option value="claimed">Claimed</option>
                  <option value="closed">Closed</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="deal-bonus-amount" className="block text-sm font-semibold text-zen-charcoal/80 mb-1">Bonus Amount</label>
                <input id="deal-bonus-amount" type="number" name="bonus_amount" value={formData.bonus_amount} onChange={handleChange} className="w-full rounded-2xl border border-zen-lavender/60 bg-white text-zen-charcoal p-2.5 text-sm outline-none focus:border-zen-sage focus:ring-1 focus:ring-zen-sage transition-all shadow-inner" />
              </div>
              <div>
                <label htmlFor="deal-currency" className="block text-sm font-semibold text-zen-charcoal/80 mb-1">Currency</label>
                <select id="deal-currency" name="currency" value={formData.currency} onChange={handleChange} className="w-full rounded-2xl border border-zen-lavender/60 bg-white text-zen-charcoal p-2.5 text-sm outline-none focus:border-zen-sage focus:ring-1 focus:ring-zen-sage transition-all shadow-inner cursor-pointer">
                  <option value="USD">USD</option>
                  <option value="CAD">CAD</option>
                </select>
              </div>
              <div>
                <label htmlFor="deal-open-date" className="block text-sm font-semibold text-zen-charcoal/80 mb-1">Open Date</label>
                <input id="deal-open-date" type="date" name="open_date" value={formData.open_date} onChange={handleChange} className="w-full rounded-2xl border border-zen-lavender/60 bg-white text-zen-charcoal p-2.5 text-sm outline-none focus:border-zen-sage focus:ring-1 focus:ring-zen-sage transition-all shadow-inner cursor-pointer" />
              </div>
            </div>

            {formData.type === 'credit_card' && (
              <div className="bg-white/50 border border-zen-lavender/30 p-5 rounded-2xl space-y-4 my-4">
                <h3 className="font-bold text-base text-zen-charcoal">Credit Card Details</h3>
                <div>
                  <label htmlFor="deal-card-name" className="block text-sm font-semibold text-zen-charcoal/80 mb-1">Card Name</label>
                  <input required id="deal-card-name" type="text" name="card_name" value={formData.card_name || ''} onChange={handleChange} className="w-full rounded-2xl border border-zen-lavender/60 bg-white text-zen-charcoal p-2.5 text-sm outline-none focus:border-zen-sage focus:ring-1 focus:ring-zen-sage transition-all shadow-inner" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="deal-target-spend" className="block text-sm font-semibold text-zen-charcoal/80 mb-1">Target Spend</label>
                    <input id="deal-target-spend" type="number" name="target_spend" value={formData.target_spend ?? ''} onChange={handleChange} className="w-full rounded-2xl border border-zen-lavender/60 bg-white text-zen-charcoal p-2.5 text-sm outline-none focus:border-zen-sage focus:ring-1 focus:ring-zen-sage transition-all shadow-inner" />
                  </div>
                  <div>
                    <label htmlFor="deal-spend-progress" className="block text-sm font-semibold text-zen-charcoal/80 mb-1">Spend Progress</label>
                    <input id="deal-spend-progress" type="number" name="spend_progress" value={formData.spend_progress ?? ''} onChange={handleChange} className="w-full rounded-2xl border border-zen-lavender/60 bg-white text-zen-charcoal p-2.5 text-sm outline-none focus:border-zen-sage focus:ring-1 focus:ring-zen-sage transition-all shadow-inner" />
                  </div>
                  <div>
                    <label htmlFor="deal-action-date-cc" className="block text-sm font-semibold text-zen-charcoal/80 mb-1">Next Action Date</label>
                    <input id="deal-action-date-cc" type="date" name="action_date" value={formData.action_date || ''} onChange={handleChange} className="w-full rounded-2xl border border-zen-lavender/60 bg-white text-zen-charcoal p-2.5 text-sm outline-none focus:border-zen-sage focus:ring-1 focus:ring-zen-sage transition-all shadow-inner cursor-pointer" />
                  </div>
                </div>
              </div>
            )}

            {formData.type === 'bank_account' && (
              <div className="bg-white/50 border border-zen-lavender/30 p-5 rounded-2xl space-y-4 my-4">
                <h3 className="font-bold text-base text-zen-charcoal">Bank Account Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="deal-action-date-bank" className="block text-sm font-semibold text-zen-charcoal/80 mb-1">Next Action Date</label>
                    <input id="deal-action-date-bank" type="date" name="action_date" value={formData.action_date || ''} onChange={handleChange} className="w-full rounded-2xl border border-zen-lavender/60 bg-white text-zen-charcoal p-2.5 text-sm outline-none focus:border-zen-sage focus:ring-1 focus:ring-zen-sage transition-all shadow-inner cursor-pointer" />
                  </div>
                </div>
              </div>
            )}

            {formData.type === 'brokerage_account' && (
              <div className="bg-white/50 border border-zen-lavender/30 p-5 rounded-2xl space-y-4 my-4">
                <h3 className="font-bold text-base text-zen-charcoal">Brokerage Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="deal-fund-committed" className="block text-sm font-semibold text-zen-charcoal/80 mb-1">Fund Committed</label>
                    <input id="deal-fund-committed" type="number" name="fund_committed" value={formData.fund_committed ?? ''} onChange={handleChange} className="w-full rounded-2xl border border-zen-lavender/60 bg-white text-zen-charcoal p-2.5 text-sm outline-none focus:border-zen-sage focus:ring-1 focus:ring-zen-sage transition-all shadow-inner" />
                  </div>
                  <div>
                    <label htmlFor="deal-action-date-brokerage" className="block text-sm font-semibold text-zen-charcoal/80 mb-1">Next Action Date</label>
                    <input id="deal-action-date-brokerage" type="date" name="action_date" value={formData.action_date || ''} onChange={handleChange} className="w-full rounded-2xl border border-zen-lavender/60 bg-white text-zen-charcoal p-2.5 text-sm outline-none focus:border-zen-sage focus:ring-1 focus:ring-zen-sage transition-all shadow-inner cursor-pointer" />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-zen-charcoal/80 mb-2">Checklist Items (Optional)</label>
              {formData.checklist_items.map((item, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3 sm:mb-2">
                  <input 
                    type="text" 
                    value={item.action_text} 
                    onChange={e => {
                      const newItems = formData.checklist_items.map((cItem, cIdx) => cIdx === i ? { ...cItem, action_text: e.target.value } : cItem);
                      setFormData({ ...formData, checklist_items: newItems });
                    }}
                    placeholder="Action"
                    className="w-full sm:flex-1 rounded-2xl border border-zen-lavender/60 bg-white text-zen-charcoal p-2.5 text-sm outline-none focus:border-zen-sage focus:ring-1 focus:ring-zen-sage transition-all shadow-inner"
                  />
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input 
                      type="date" 
                      value={item.deadline || ''} 
                      onChange={e => {
                        const newItems = formData.checklist_items.map((cItem, cIdx) => cIdx === i ? { ...cItem, deadline: e.target.value } : cItem);
                        setFormData({ ...formData, checklist_items: newItems });
                      }}
                      className="flex-1 sm:flex-none sm:w-32 rounded-2xl border border-zen-lavender/60 bg-white text-zen-charcoal p-2.5 text-sm outline-none focus:border-zen-sage focus:ring-1 focus:ring-zen-sage transition-all shadow-inner cursor-pointer"
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        const newItems = formData.checklist_items.filter((_, cIdx) => cIdx !== i);
                        setFormData({ ...formData, checklist_items: newItems });
                      }}
                      className="shrink-0 w-10 h-10 flex items-center justify-center text-red-500 hover:text-red-700 font-bold text-xl border-none bg-transparent cursor-pointer"
                      title="Remove item"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
              <button 
                type="button" 
                onClick={() => setFormData({ ...formData, checklist_items: [...formData.checklist_items, { action_text: '', is_done: false }]})}
                className="text-sm text-zen-sage hover:opacity-80 font-extrabold mt-2 cursor-pointer border-none bg-transparent"
              >
                + Add Item
              </button>
            </div>

            <div>
              <label htmlFor="deal-note" className="block text-sm font-semibold text-zen-charcoal/80 mb-1">Note</label>
              <textarea id="deal-note" name="note" value={formData.note} onChange={handleChange} rows={3} className="w-full rounded-2xl border border-zen-lavender/60 bg-white text-zen-charcoal p-2.5 text-sm outline-none focus:border-zen-sage focus:ring-1 focus:ring-zen-sage transition-all shadow-inner" />
            </div>

            <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button type="button" onClick={onClose} disabled={isPending} className="w-full sm:w-auto px-5 py-2.5 border border-zen-lavender/60 bg-white/60 text-zen-charcoal hover:bg-white/80 rounded-full font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={isPending} className="w-full sm:w-auto px-5 py-2.5 bg-zen-charcoal text-zen-base hover:bg-zen-charcoal/90 rounded-full font-extrabold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer border-none disabled:opacity-50">
                {isPending ? 'Saving...' : 'Save Deal'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
