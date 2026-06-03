'use client';

import { useState, useOptimistic, useTransition, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, ArrowLeft } from 'lucide-react';
import DealCard from './DealCard';
import DealFormModal from './DealFormModal';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';
import { deleteDealAction } from '@/app/actions/deals';
import { DealRow } from '@/lib/dealValidators';

const categoryOptions = [
  { id: 'credit_card', name: 'Credit Card' },
  { id: 'bank_account', name: 'Bank Account' },
  { id: 'brokerage_account', name: 'Brokerage Account' },
  { id: 'other', name: 'Other' }
];

export default function DealsClient({ initialDeals }: { initialDeals: DealRow[] }) {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealRow | null>(null);
  const [, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortMetric, setSortMetric] = useState<'open_date' | 'action_date' | 'amount'>('open_date');
  const [sortDirection, setSortDirection] = useState<'highest' | 'lowest'>('highest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortPopoverRef.current && !sortPopoverRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
    };
    if (isSortOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSortOpen]);

  const [optimisticDeals, setOptimisticDeals] = useOptimistic(
    initialDeals,
    (state, newDeal: { action: string, deal: DealRow }) => {
      if (newDeal.action === 'add') return [newDeal.deal, ...state];
      if (newDeal.action === 'update') return state.map(d => d.id === newDeal.deal.id ? { ...d, ...newDeal.deal } : d);
      if (newDeal.action === 'delete') return state.filter(d => d.id !== newDeal.deal.id);
      return state;
    }
  );

  const filteredDeals = optimisticDeals.filter(d => 
    selectedCategories.size === 0 || selectedCategories.size === categoryOptions.length || selectedCategories.has(d.type)
  );

  const displayDeals = [...filteredDeals]
    .filter(d => {
      if (searchQuery === '') return true;
      const query = searchQuery.toLowerCase();
      const matchCompany = d.company?.toLowerCase().includes(query);
      const matchNote = d.note?.toLowerCase().includes(query);
      const matchCard = d.type_specific_data?.card_name?.toLowerCase().includes(query);
      const matchChecklist = d.deal_checklist_items?.some(item => item.action_text?.toLowerCase().includes(query));
      return matchCompany || matchNote || matchCard || matchChecklist;
    })
    .sort((a, b) => {
      if (sortMetric === 'amount') {
        const valA = Number(a.bonus_amount || 0) || 0;
        const valB = Number(b.bonus_amount || 0) || 0;
        const diff = valA < valB ? -1 : (valA > valB ? 1 : 0);
        return sortDirection === 'highest' ? -diff : diff;
      } else {
        const dateStrA = sortMetric === 'open_date' ? a.open_date : a.type_specific_data?.action_date;
        const dateStrB = sortMetric === 'open_date' ? b.open_date : b.type_specific_data?.action_date;
        
        const validA = Boolean(dateStrA && !isNaN(new Date(dateStrA as string).getTime()));
        const validB = Boolean(dateStrB && !isNaN(new Date(dateStrB as string).getTime()));

        if (!validA && !validB) return 0;
        if (!validA) return 1; // Always push missing dates to bottom
        if (!validB) return -1;

        const timeA = new Date(dateStrA as string).getTime();
        const timeB = new Date(dateStrB as string).getTime();
        const diff = timeA < timeB ? -1 : (timeA > timeB ? 1 : 0);
        return sortDirection === 'highest' ? diff : -diff; // Highest = Oldest first (ASC), Lowest = Newest first (DESC)
      }
    });

  const primaryCurrency = optimisticDeals.find(d => d.currency)?.currency || 'USD';
  const claimedAmount = optimisticDeals.filter(d => d.status === 'claimed' && d.currency === primaryCurrency).reduce((sum, d) => {
    const val = Number(d.bonus_amount);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  const pendingAmount = optimisticDeals.filter(d => d.status !== 'claimed' && d.status !== 'closed' && d.currency === primaryCurrency).reduce((sum, d) => {
    const val = Number(d.bonus_amount);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  const totalAmount = claimedAmount + pendingAmount;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: primaryCurrency, maximumFractionDigits: 0 }).format(val);
  };

  const getMetricLabel = () => {
    if (sortMetric === 'open_date') return 'Open Date';
    if (sortMetric === 'action_date') return 'Action Date';
    return 'Amount';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Top Bar / Navigation */}
      <div className="mb-4">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-zen-charcoal hover:opacity-80 transition-colors no-underline"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-zen-charcoal">Finance Deals</h1>
        <button 
          onClick={() => { setEditingDeal(null); setModalOpen(true); }}
          className="bg-zen-charcoal hover:bg-zen-charcoal/90 text-zen-base px-5 py-2.5 rounded-full font-extrabold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer border-none"
        >
          Add Deal
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white/40 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col items-start shadow-sm justify-between">
          <p className="text-xs font-semibold text-zen-charcoal/60 uppercase tracking-wider mb-1">Claimed ({primaryCurrency})</p>
          <p className="text-2xl font-extrabold text-zen-charcoal/90">{formatCurrency(claimedAmount)}</p>
        </div>
        <div className="bg-white/40 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col items-start shadow-sm justify-between">
          <p className="text-xs font-semibold text-zen-charcoal/60 uppercase tracking-wider mb-1">Pending ({primaryCurrency})</p>
          <p className="text-2xl font-extrabold text-zen-charcoal/90">{formatCurrency(pendingAmount)}</p>
        </div>
        <div className="bg-white/60 backdrop-blur-md border border-zen-sage/40 rounded-2xl p-4 flex flex-col items-start shadow-sm justify-between">
          <p className="text-xs font-semibold text-zen-charcoal/70 uppercase tracking-wider mb-1">Total Value ({primaryCurrency})</p>
          <p className="text-2xl font-extrabold text-zen-charcoal">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      {/* Glassmorphism Search & Filters Bar */}
      <div className="relative z-30 bg-white/60 backdrop-blur-md border border-zen-lavender/40 shadow-sm rounded-3xl p-4 mb-8 flex flex-col gap-3">
        <div className="flex gap-2">
          <input 
            id="search-input"
            type="text" 
            placeholder="Search deals..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-grow px-4 py-2 rounded-full border border-zen-lavender/30 bg-white text-zen-charcoal text-sm outline-none focus:border-zen-sage/60 focus:ring-1 focus:ring-zen-sage/60 transition-all font-semibold h-9"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <MultiSelectDropdown
            id="category-filter"
            label="Category"
            pluralLabel="Categories"
            options={categoryOptions}
            selectedIds={selectedCategories}
            onChange={setSelectedCategories}
          />

          {/* Sort Dropdown Component */}
          <div ref={sortPopoverRef} className="relative h-9 inline-block sm:ml-auto w-full sm:w-auto">
            <button 
              type="button"
              onClick={() => setIsSortOpen(!isSortOpen)}
              style={{ minHeight: 0 }}
              className="w-full sm:w-auto h-full px-4 py-0 rounded-full border border-zen-lavender/30 bg-white text-zen-charcoal !text-sm font-semibold flex items-center justify-between gap-2 hover:bg-white/90 transition-all shadow-sm box-border h-9 min-h-0 shrink-0 cursor-pointer whitespace-nowrap"
            >
              <span className="capitalize">
                Sort: {sortDirection === 'highest' ? 'Highest' : 'Lowest'} {getMetricLabel()}
              </span>
              <ChevronDown size={14} className={`text-zen-charcoal/50 shrink-0 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Absolute 2-Axis Sort Popover */}
            {isSortOpen && (
              <div className="absolute right-0 top-10 z-50 bg-white/95 backdrop-blur-xl border border-zen-lavender/40 shadow-xl rounded-3xl p-4 flex items-stretch gap-4 text-xs text-zen-charcoal font-semibold min-w-[240px] animate-scale-up">
                {/* Column 1: Direction */}
                <div className="flex flex-col gap-2.5 flex-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="dealSortDir"
                      checked={sortDirection === 'highest'}
                      onChange={() => setSortDirection('highest')}
                      className="w-3.5 h-3.5 accent-zen-sage"
                    />
                    Highest (Oldest)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="dealSortDir"
                      checked={sortDirection === 'lowest'}
                      onChange={() => setSortDirection('lowest')}
                      className="w-3.5 h-3.5 accent-zen-sage"
                    />
                    Lowest (Newest)
                  </label>
                </div>

                {/* Divider */}
                <div className="w-[1px] bg-zen-lavender/30 self-stretch mx-1" />

                {/* Column 2: Metric */}
                <div className="flex flex-col gap-2.5 flex-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="dealSortMetric"
                      checked={sortMetric === 'open_date'}
                      onChange={() => setSortMetric('open_date')}
                      className="w-3.5 h-3.5 accent-zen-sage"
                    />
                    Open Date
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="dealSortMetric"
                      checked={sortMetric === 'action_date'}
                      onChange={() => setSortMetric('action_date')}
                      className="w-3.5 h-3.5 accent-zen-sage"
                    />
                    Action Date
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="dealSortMetric"
                      checked={sortMetric === 'amount'}
                      onChange={() => setSortMetric('amount')}
                      className="w-3.5 h-3.5 accent-zen-sage"
                    />
                    Amount
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {displayDeals.length === 0 ? (
        <div className="text-center py-12 bg-white/40 backdrop-blur-md rounded-2xl border border-white/20 shadow-sm">
          <p className="text-zen-charcoal/60 font-semibold">No deals found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayDeals.map(deal => (
            <DealCard 
              key={deal.id} 
              deal={deal} 
              onEdit={() => { setEditingDeal(deal); setModalOpen(true); }}
              onDelete={() => {
                if (confirm('Are you sure?')) {
                  startTransition(async () => {
                    setOptimisticDeals({ action: 'delete', deal });
                    await deleteDealAction(deal.id);
                  });
                }
              }}
              setOptimisticDeals={setOptimisticDeals}
            />
          ))}
        </div>
      )}

      {isModalOpen && (
        <DealFormModal 
          isOpen={isModalOpen}
          onClose={() => { setModalOpen(false); setEditingDeal(null); }}
          editingDeal={editingDeal}
          setOptimisticDeals={setOptimisticDeals}
        />
      )}
    </div>
  );
}
