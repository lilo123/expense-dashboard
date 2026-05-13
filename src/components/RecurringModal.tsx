'use client';

import { useState, useEffect } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { 
  addRecurringExpenseAction, 
  updateRecurringExpenseAction,
  getRecurringExpensesAction, 
  deleteRecurringExpenseAction 
} from '@/app/actions/recurring';
import { Category, RecurringExpense } from '@/types/database';
import { formatFriendlyDate, formatFriendlyCurrency } from '@/lib/utils';

const getLocalExecutionTime = (): string => {
  const localMidnight = new Date();
  localMidnight.setHours(0, 0, 0, 0);
  
  const utcMinutes = localMidnight.getUTCMinutes();
  const minutesOffset = utcMinutes === 0 ? 0 : 60 - utcMinutes;
  
  const executionTime = new Date(localMidnight.getTime() + minutesOffset * 60000);
  return executionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const calculateFirstOccurrenceClient = (
  startDateStr: string,
  freq: 'weekly' | 'monthly',
  dow: number | null,
  dom: number | null,
  lastDay: boolean
): string => {
  const start = new Date(startDateStr + 'T00:00:00');
  if (isNaN(start.getTime())) return '';

  if (freq === 'weekly' && dow !== null) {
    const currentDow = start.getDay();
    const daysToAdd = (dow - currentDow + 7) % 7;
    const firstDate = new Date(start.getTime() + daysToAdd * 86400000);
    return firstDate.toISOString().split('T')[0];
  }

  if (freq === 'monthly') {
    if (lastDay) {
      const lastDayDate = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      return lastDayDate.toISOString().split('T')[0];
    } else if (dom !== null) {
      const lastDayInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(dom, lastDayInMonth);
      const firstDate = new Date(start.getFullYear(), start.getMonth(), targetDay);
      
      if (firstDate.getTime() < start.getTime()) {
        const nextMonthLastDay = new Date(start.getFullYear(), start.getMonth() + 2, 0).getDate();
        const nextMonthTargetDay = Math.min(dom, nextMonthLastDay);
        const nextMonthDate = new Date(start.getFullYear(), start.getMonth() + 1, nextMonthTargetDay);
        return nextMonthDate.toISOString().split('T')[0];
      }
      return firstDate.toISOString().split('T')[0];
    }
  }
  return startDateStr;
};

export default function RecurringModal() {
  const { 
    isRecurringModalOpen, toggleRecurringModal, 
    categories, profile, recurringExpenses, hydrate, removeRecurringExpense 
  } = useExpenseStore();

  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingConfig, setEditingConfig] = useState<RecurringExpense | null>(null);

  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>('monthly');
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState<number | null>(1);
  const [isLastDayOfMonth, setIsLastDayOfMonth] = useState(false);
  
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [untilType, setUntilType] = useState<'never' | 'occurrences' | 'date'>('never');
  const [maxOccurrences, setMaxOccurrences] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (isRecurringModalOpen) {
      setView('list');
      setEditingConfig(null);
      async function fetchConfigs() {
        try {
          const res = await getRecurringExpensesAction();
          if (res.success && res.data) {
            hydrate({ recurringExpenses: res.data as RecurringExpense[] });
          }
        } catch (err) {
          console.error('[FETCH RECURRING CONFIGS ERROR]:', err);
        }
      }
      fetchConfigs();
    }
  }, [isRecurringModalOpen, hydrate]);

  if (!isRecurringModalOpen) return null;

  const openAddForm = () => {
    setEditingConfig(null);
    setItem('');
    setAmount('');
    setFrequency('monthly');
    setDayOfWeek(1);
    setDayOfMonth(1);
    setIsLastDayOfMonth(false);
    setStartDate(new Date().toISOString().split('T')[0]);
    setUntilType('never');
    setMaxOccurrences('');
    setEndDate('');
    setCategoryId('');
    setMessage(null);
    setView('form');
  };

  const openEditForm = (config: RecurringExpense) => {
    setEditingConfig(config);
    setItem(config.item);
    setAmount(config.amount.toString());
    if (config.frequency === 'weekly' || config.frequency === 'monthly') {
      setFrequency(config.frequency);
    }
    setDayOfWeek((config as any).day_of_week ?? 1);
    setDayOfMonth((config as any).day_of_month ?? 1);
    setIsLastDayOfMonth((config as any).is_last_day_of_month ?? false);
    setStartDate(config.start_date);
    setCategoryId(config.category_id);
    
    if ((config as any).max_occurrences) {
      setUntilType('occurrences');
      setMaxOccurrences((config as any).max_occurrences.toString());
      setEndDate('');
    } else if ((config as any).end_date) {
      setUntilType('date');
      setEndDate((config as any).end_date);
      setMaxOccurrences('');
    } else {
      setUntilType('never');
      setMaxOccurrences('');
      setEndDate('');
    }
    
    setMessage(null);
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recurring expense schedule?')) return;
    try {
      const res = await deleteRecurringExpenseAction(id);
      if (res.success) {
        removeRecurringExpense(id);
      } else {
        alert(res.error || 'Failed to delete configuration');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.trim() || !amount || !startDate || !categoryId) {
      setMessage({ text: 'Please fill in all required fields.', isError: true });
      return;
    }

    if (frequency === 'weekly' && dayOfWeek === null) {
      setMessage({ text: 'Please select a day of the week.', isError: true });
      return;
    }

    if (frequency === 'monthly' && !isLastDayOfMonth && dayOfMonth === null) {
      setMessage({ text: 'Please select a specific day of the month.', isError: true });
      return;
    }

    if (untilType === 'occurrences' && !maxOccurrences) {
      setMessage({ text: 'Please specify the maximum number of occurrences.', isError: true });
      return;
    }

    if (untilType === 'date' && !endDate) {
      setMessage({ text: 'Please specify an expiration date.', isError: true });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const currency = profile?.base_currency || 'CAD';
      
      const scheduleParams = {
        item: item.trim(),
        amount: parseFloat(amount),
        currency,
        category_id: categoryId,
        frequency,
        start_date: startDate,
        day_of_week: frequency === 'weekly' ? dayOfWeek : null,
        day_of_month: frequency === 'monthly' && !isLastDayOfMonth ? dayOfMonth : null,
        is_last_day_of_month: frequency === 'monthly' ? isLastDayOfMonth : false,
        end_date: untilType === 'date' ? endDate : null,
        max_occurrences: untilType === 'occurrences' ? parseInt(maxOccurrences, 10) : null
      };

      let res;
      if (editingConfig) {
        res = await updateRecurringExpenseAction(editingConfig.id, scheduleParams);
      } else {
        res = await addRecurringExpenseAction(scheduleParams);
      }

      if (res.success) {
        setMessage({ text: `Recurring expense ${editingConfig ? 'updated' : 'registered'} successfully!`, isError: false });
        setTimeout(async () => {
          setMessage(null);
          const refreshRes = await getRecurringExpensesAction();
          if (refreshRes.success && refreshRes.data) {
            hydrate({ recurringExpenses: refreshRes.data as RecurringExpense[] });
          }
          setView('list');
        }, 1000);
      } else {
        setMessage({ text: res.error || 'Failed to update configuration.', isError: true });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ text: err.message || 'Failed to process request.', isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const getUntilText = (config: RecurringExpense): string => {
    if ((config as any).max_occurrences) {
      return `${(config as any).num_occurrences ?? 0}/${(config as any).max_occurrences} runs`;
    }
    if ((config as any).end_date) {
      return `Until ${formatFriendlyDate((config as any).end_date)}`;
    }
    return 'Never';
  };

  const getFrequencyText = (config: RecurringExpense): string => {
    if (config.frequency === 'weekly') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dow = (config as any).day_of_week ?? 0;
      return `Weekly (${days[dow].substring(0, 3)})`;
    }
    if (config.frequency === 'monthly') {
      if ((config as any).is_last_day_of_month) {
        return 'Monthly (Last Day)';
      }
      const dom = (config as any).day_of_month ?? 1;
      return `Monthly (Day ${dom})`;
    }
    return config.frequency;
  };

  return (
    <div className="modal" style={{ display: 'flex' }} onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) toggleRecurringModal();
    }}>
      <div className="modal-content bg-white/40 backdrop-blur-md border border-white/20 shadow-xl text-zen-charcoal rounded-3xl p-6 max-w-lg w-full relative flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        
        {view === 'list' ? (
          <div className="flex flex-col overflow-hidden h-full">
            <h2 className="m-0 font-bold text-zen-charcoal text-xl leading-snug pr-10 w-fit" style={{ marginBottom: '16px' }}>Recurring Expense</h2>
            <button 
              onClick={toggleRecurringModal}
              aria-label="Close Modal"
              className="close-btn rounded-full text-zen-charcoal/60 hover:text-zen-charcoal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <p className="text-xs text-zen-charcoal/60 mb-4 text-left">List of active scheduled background expense entry rules.</p>

            <div className="overflow-y-auto flex-1 pr-1 py-1 flex flex-col gap-3">
              {recurringExpenses.length === 0 ? (
                <div className="text-center py-8 text-sm text-zen-charcoal/50 font-medium">
                  No running recurring expenses configured. Click "+ Add New" to schedule one.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {recurringExpenses.map((config) => (
                    <div 
                      key={config.id} 
                      data-testid="recurring-item"
                      className="flex items-center justify-between p-3 rounded-2xl bg-white/40 backdrop-blur-sm border border-white/10 shadow-sm transition-all hover:bg-white/60 text-left"
                    >
                      <div className="flex-1 flex flex-col gap-0.5">
                        <h4 className="font-bold text-zen-charcoal text-sm m-0">{config.item}</h4>
                        <p className="text-[10px] text-zen-charcoal/60 m-0 font-semibold">
                          {getFrequencyText(config)} &bull; {getUntilText(config)} &bull; {config.categories?.name || 'Uncategorized'}
                        </p>
                        <p className="text-[9px] text-zen-charcoal/50 m-0 mt-0.5 font-bold">
                          Next entry: {formatFriendlyDate(config.next_occurrence)}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="font-bold text-zen-charcoal text-sm">
                          {formatFriendlyCurrency(
                            parseFloat(config.amount as any),
                            config.currency || profile?.base_currency || 'CAD'
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          <button 
                            onClick={() => openEditForm(config)}
                            aria-label="Edit Config"
                            className="cursor-pointer min-h-0 p-1.5 text-zen-charcoal/60 hover:text-zen-sage bg-transparent border-none transition-colors flex items-center justify-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>
                          </button>
                          <button 
                            onClick={() => handleDelete(config.id)}
                            aria-label="Delete Config"
                            className="cursor-pointer min-h-0 p-1.5 text-zen-charcoal/60 hover:text-zen-peach bg-transparent border-none transition-colors flex items-center justify-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="mt-5 flex justify-center shrink-0">
              <button 
                onClick={openAddForm}
                className="w-full max-w-[240px] py-3 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-sm border-none shadow-sm cursor-pointer flex items-center justify-center gap-1.5 h-11"
              >
                + Add New
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[80vh] flex flex-col">
            <h2 className="m-0 font-bold text-zen-charcoal text-lg leading-snug pr-10 w-fit" style={{ marginBottom: '8px' }}>
              {editingConfig ? 'Edit Recurring Expense' : 'Add Recurring Expense'}
            </h2>
            <button 
              onClick={toggleRecurringModal}
              aria-label="Close Modal"
              className="close-btn rounded-full text-zen-charcoal/60 hover:text-zen-charcoal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <p className="text-xs text-zen-charcoal/60 m-0" style={{ marginBottom: '4px' }}>
              Recurring expense will be logged at {getLocalExecutionTime()} on the date.
            </p>
            <p className="text-xs text-zen-charcoal/50 m-0 font-bold mb-4">
              First expense will be logged on {formatFriendlyDate(calculateFirstOccurrenceClient(startDate, frequency, dayOfWeek, dayOfMonth, isLastDayOfMonth))}.
            </p>

            {message && (
              <div className={`p-3 rounded-2xl mb-4 text-sm font-medium border ${
                message.isError 
                  ? 'bg-zen-peach/20 border-zen-peach/45 text-zen-charcoal' 
                  : 'bg-zen-sage/20 border-zen-sage/45 text-zen-charcoal'
              }`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 pr-1">
              <div className="flex flex-col gap-1 text-left">
                <label htmlFor="itemDescription" className="text-xs text-zen-charcoal/60 font-semibold ml-1">Description</label>
                <input 
                  id="itemDescription"
                  type="text" 
                  required
                  placeholder="e.g. Rent, Internet, Gym subscription"
                  value={item}
                  onChange={e => setItem(e.target.value)}
                  className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/40 text-base box-border h-12"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1 text-left">
                  <label htmlFor="amountInput" className="text-xs text-zen-charcoal/60 font-semibold ml-1">Amount ({profile?.base_currency || 'CAD'})</label>
                  <input 
                    id="amountInput"
                    type="number" 
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/40 text-base box-border h-12"
                  />
                </div>

                <div className="flex-1 flex flex-col gap-1 text-left">
                  <label htmlFor="frequencySelect" className="text-xs text-zen-charcoal/60 font-semibold ml-1">Frequency</label>
                  <select 
                    id="frequencySelect"
                    value={frequency} 
                    aria-label="Frequency"
                    onChange={e => {
                      const val = e.target.value as 'weekly' | 'monthly';
                      setFrequency(val);
                      if (val === 'weekly') setDayOfWeek(1);
                      else {
                        setDayOfWeek(null);
                        setDayOfMonth(1);
                        setIsLastDayOfMonth(false);
                      }
                    }}
                    className="w-full px-4 py-3 rounded-full border border-zen-lavender/60 bg-white/50 text-zen-charcoal text-base cursor-pointer outline-none h-12 box-border appearance-none"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              {frequency === 'weekly' && (
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">Log Weekly On</label>
                  <div className="flex flex-wrap gap-1.5 p-1.5 bg-white/60 border border-zen-lavender/40 rounded-2xl justify-center shadow-sm">
                    {[
                      { label: 'Mon', val: 1 },
                      { label: 'Tue', val: 2 },
                      { label: 'Wed', val: 3 },
                      { label: 'Thu', val: 4 },
                      { label: 'Fri', val: 5 },
                      { label: 'Sat', val: 6 },
                      { label: 'Sun', val: 0 }
                    ].map((day) => (
                      <button
                        key={day.val}
                        type="button"
                        onClick={() => setDayOfWeek(day.val)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-full border-none cursor-pointer transition-all ${
                          dayOfWeek === day.val ? 'bg-zen-charcoal text-white shadow-sm' : 'bg-white/40 text-zen-charcoal/60 hover:bg-white/70'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {frequency === 'monthly' && (
                <div className="flex flex-col gap-3 p-3 bg-white/60 border border-zen-lavender/40 rounded-2xl text-left shadow-sm">
                  <div className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      id="lastDayCheckbox" 
                      checked={isLastDayOfMonth}
                      onChange={e => setIsLastDayOfMonth(e.target.checked)}
                      className="w-4 h-4 rounded border-zen-lavender/60 accent-zen-charcoal cursor-pointer"
                    />
                    <label htmlFor="lastDayCheckbox" className="text-sm text-zen-charcoal font-semibold cursor-pointer">
                      Last Day of the Month
                    </label>
                  </div>

                  {!isLastDayOfMonth && (
                    <div className="flex flex-col gap-1">
                      <label htmlFor="dayOfMonthSelect" className="text-xs text-zen-charcoal/60 font-semibold ml-1">Log on Specific Day</label>
                      <select 
                        id="dayOfMonthSelect"
                        value={dayOfMonth || 1} 
                        aria-label="Specific Day of Month"
                        onChange={e => setDayOfMonth(parseInt(e.target.value, 10))}
                        className="w-full px-4 py-3 rounded-full border border-zen-lavender/60 bg-white/50 text-zen-charcoal text-base cursor-pointer outline-none h-12 box-border appearance-none"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>Day {day}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1 text-left">
                <label htmlFor="startDateInput" className="text-xs text-zen-charcoal/60 font-semibold ml-1">Start Date</label>
                <input 
                  id="startDateInput"
                  type="date" 
                  required
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-base box-border h-12"
                />
              </div>

              <div className="flex flex-col gap-3.5 p-4 bg-white/60 border border-zen-lavender/40 rounded-2xl text-left shadow-sm">
                <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">Ends</label>
                
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 h-12">
                    <input 
                      type="radio" 
                      id="endsNever" 
                      name="endsOption"
                      checked={untilType === 'never'}
                      onChange={() => {
                        setUntilType('never');
                        setMaxOccurrences('');
                        setEndDate('');
                      }}
                      className="w-5 h-5 accent-zen-charcoal cursor-pointer"
                    />
                    <label htmlFor="endsNever" className="text-sm font-bold text-zen-charcoal cursor-pointer select-none">
                      Never
                    </label>
                  </div>

                  <div className="flex items-center gap-3 h-12">
                    <input 
                      type="radio" 
                      id="endsOnDate" 
                      name="endsOption"
                      checked={untilType === 'date'}
                      onChange={() => {
                        setUntilType('date');
                        setMaxOccurrences('');
                        setEndDate(new Date().toISOString().split('T')[0]);
                      }}
                      className="w-5 h-5 accent-zen-charcoal cursor-pointer"
                    />
                    <label htmlFor="endsOnDate" className="text-sm font-bold text-zen-charcoal cursor-pointer select-none min-w-[40px]">
                      On
                    </label>
                    <input 
                      type="date"
                      id="endDateInput"
                      aria-label="End Date"
                      disabled={untilType !== 'date'}
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="px-4 py-2.5 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-sm box-border h-10 disabled:opacity-40 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-3 h-12">
                    <input 
                      type="radio" 
                      id="endsAfterOccurrences" 
                      name="endsOption"
                      checked={untilType === 'occurrences'}
                      onChange={() => {
                        setUntilType('occurrences');
                        setEndDate('');
                        setMaxOccurrences('10');
                      }}
                      className="w-5 h-5 accent-zen-charcoal cursor-pointer"
                    />
                    <label htmlFor="endsAfterOccurrences" className="text-sm font-bold text-zen-charcoal cursor-pointer select-none min-w-[40px]">
                      After
                    </label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        id="maxOccurrencesInput"
                        aria-label="Number of Runs"
                        min="1"
                        disabled={untilType !== 'occurrences'}
                        placeholder="10"
                        value={maxOccurrences}
                        onChange={e => setMaxOccurrences(e.target.value)}
                        className="w-20 px-4 py-2.5 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/30 text-sm box-border h-10 disabled:opacity-40 transition-all text-center"
                      />
                      <span className="text-xs text-zen-charcoal/60 font-semibold select-none">occurrences</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1 text-left">
                <label htmlFor="categorySelect" className="text-xs text-zen-charcoal/60 font-semibold ml-1">Category</label>
                <select 
                  id="categorySelect"
                  required
                  value={categoryId} 
                  aria-label="Category"
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full px-4 py-3 rounded-full border border-zen-lavender/60 bg-white/50 text-zen-charcoal text-base cursor-pointer outline-none h-12 box-border appearance-none"
                >
                  <option value="" disabled>Select a category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 mt-2">
                <button 
                  type="button"
                  onClick={() => setView('list')}
                  className="flex-1 py-3 bg-white/60 border border-zen-lavender/40 hover:bg-white/80 text-zen-charcoal rounded-full font-bold text-base cursor-pointer transition-all bg-transparent"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="flex-1 py-3 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-base cursor-pointer border-none disabled:opacity-50"
                >
                  {isLoading ? 'Scheduling...' : (editingConfig ? 'Save Changes' : 'Schedule')}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
