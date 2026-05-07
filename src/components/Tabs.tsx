'use client';
import { useExpenseStore } from '@/store/useExpenseStore';

export default function Tabs() {
  const { activeTab, setActiveTab } = useExpenseStore();

  return (
    <div className="flex border-b border-zen-lavender/60 mb-5">
      {['dashboard', 'recent', 'yearly'].map((tab, index) => (
        <button 
          key={tab}
          id={`action-elem-${index + 1}`} 
          className={`flex-1 py-3 border-none bg-transparent text-base font-semibold cursor-pointer transition-all capitalize ${
            activeTab === tab 
              ? 'text-zen-charcoal border-b-2 border-zen-charcoal' 
              : 'text-zen-charcoal/60 hover:text-zen-charcoal'
          }`}
          onClick={() => setActiveTab(tab as any)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
