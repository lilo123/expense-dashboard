'use client';

import { useState, useTransition, ChangeEvent, FormEvent } from 'react';
import { createDealAction, updateDealAction } from '@/app/actions/deals';
import { DealRow, ChecklistItem } from '@/lib/dealValidators';

interface DealFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingDeal?: DealRow | null;
  setOptimisticDeals?: (action: { action: string; deal: DealRow }) => void;
}

interface FormDataState {
  company: string;
  status: 'exploring' | 'active' | 'ready_to_claim' | 'claimed' | 'closed';
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

export default function DealFormModal({ isOpen, onClose, editingDeal, setOptimisticDeals }: DealFormModalProps) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(editingDeal ? 2 : 1);
  const [formData, setFormData] = useState<FormDataState>(editingDeal ? {
    company: editingDeal.company,
    status: editingDeal.status,
    open_date: editingDeal.open_date || '',
    note: editingDeal.note || '',
    currency: editingDeal.currency,
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
    currency: 'USD',
    bonus_amount: '',
    type: '',
    checklist_items: []
  });

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
          payload.checklist_items = formData.checklist_items.filter(i => i.action_text && i.action_text.trim() !== '');
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {editingDeal ? 'Edit Deal' : 'Add New Deal'}
          </h2>
          <button onClick={onClose} disabled={isPending} className="text-gray-500 hover:text-gray-700 disabled:opacity-50">&times;</button>
        </div>

        {step === 1 && !editingDeal && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div onClick={() => handleTypeSelect('credit_card')} className="border-2 border-gray-200 rounded-xl p-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all text-center">
              <div className="text-3xl mb-2">💳</div>
              <h3 className="font-bold">Credit Card</h3>
            </div>
            <div onClick={() => handleTypeSelect('bank_account')} className="border-2 border-gray-200 rounded-xl p-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all text-center">
              <div className="text-3xl mb-2">🏦</div>
              <h3 className="font-bold">Bank Account</h3>
            </div>
            <div onClick={() => handleTypeSelect('brokerage_account')} className="border-2 border-gray-200 rounded-xl p-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all text-center">
              <div className="text-3xl mb-2">📈</div>
              <h3 className="font-bold">Brokerage</h3>
            </div>
            <div onClick={() => handleTypeSelect('other')} className="border-2 border-gray-200 rounded-xl p-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all text-center">
              <div className="text-3xl mb-2">📁</div>
              <h3 className="font-bold">Other</h3>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company</label>
                <input required type="text" name="company" value={formData.company} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border">
                  <option value="exploring">Exploring</option>
                  <option value="active">Active</option>
                  <option value="ready_to_claim">Ready to Claim</option>
                  <option value="claimed">Claimed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bonus Amount</label>
                <input type="number" name="bonus_amount" value={formData.bonus_amount} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
                <select name="currency" value={formData.currency} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border">
                  <option value="USD">USD</option>
                  <option value="CAD">CAD</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Open Date</label>
                <input type="date" name="open_date" value={formData.open_date} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border" />
              </div>
            </div>

            {formData.type === 'credit_card' && (
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-4">
                <h3 className="font-medium">Credit Card Details</h3>
                <div>
                  <label className="block text-sm font-medium">Card Name</label>
                  <input required type="text" name="card_name" value={formData.card_name || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium">Target Spend</label>
                    <input type="number" name="target_spend" value={formData.target_spend ?? ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Current Spend Progress</label>
                    <input type="number" name="spend_progress" value={formData.spend_progress ?? ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Next Action Date</label>
                    <input type="date" name="action_date" value={formData.action_date || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm" />
                  </div>
                </div>
              </div>
            )}

            {formData.type === 'bank_account' && (
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-4">
                <h3 className="font-medium">Bank Account Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium">Next Action Date</label>
                    <input type="date" name="action_date" value={formData.action_date || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Checklist Items (Optional)</label>
                  {formData.checklist_items.map((item, i) => (
                    <div key={i} className="flex items-center space-x-2 mb-2">
                      <input 
                        type="text" 
                        value={item.action_text} 
                        onChange={e => {
                          const newItems = formData.checklist_items.map((cItem, cIdx) => cIdx === i ? { ...cItem, action_text: e.target.value } : cItem);
                          setFormData({ ...formData, checklist_items: newItems });
                        }}
                        placeholder="Action"
                        className="flex-1 rounded-md border-gray-300 shadow-sm p-2 border text-sm"
                      />
                      <input 
                        type="date" 
                        value={item.deadline || ''} 
                        onChange={e => {
                          const newItems = formData.checklist_items.map((cItem, cIdx) => cIdx === i ? { ...cItem, deadline: e.target.value } : cItem);
                          setFormData({ ...formData, checklist_items: newItems });
                        }}
                        className="w-32 rounded-md border-gray-300 shadow-sm p-2 border text-sm"
                      />
                      <button 
                        type="button" 
                        onClick={() => {
                          const newItems = formData.checklist_items.filter((_, cIdx) => cIdx !== i);
                          setFormData({ ...formData, checklist_items: newItems });
                        }}
                        className="text-red-500 hover:text-red-700 font-bold px-2 py-1 text-base"
                        title="Remove item"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  <button 
                    type="button"
                    onClick={() => setFormData({ ...formData, checklist_items: [...formData.checklist_items, { action_text: '', is_done: false }]})}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium mt-1"
                  >
                    + Add Item
                  </button>
                </div>
              </div>
            )}

            {formData.type === 'brokerage_account' && (
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-4">
                <h3 className="font-medium">Brokerage Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium">Fund Committed</label>
                    <input type="number" name="fund_committed" value={formData.fund_committed ?? ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Next Action Date</label>
                    <input type="date" name="action_date" value={formData.action_date || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm" />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Note</label>
              <textarea name="note" value={formData.note} onChange={handleChange} rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border" />
            </div>

            <div className="pt-4 flex justify-end space-x-3">
              <button type="button" onClick={onClose} disabled={isPending} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={isPending} className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {isPending ? 'Saving...' : 'Save Deal'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
