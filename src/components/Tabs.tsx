'use client';
import { useExpenseStore } from '@/store/useExpenseStore';
import { LayoutDashboard, Receipt, Calendar } from 'lucide-react';

const tabs = ['dashboard', 'recent', 'yearly'] as const;

const icons = {
  dashboard: LayoutDashboard,
  recent: Receipt,
  yearly: Calendar,
};

export default function Tabs() {
  const { activeTab, setActiveTab } = useExpenseStore();

  return (
    <div className="border-zen-lavender/60 md:border-b md:mb-5 md:static md:flex-row fixed bottom-0 left-0 right-0 z-40 bg-white/60 backdrop-blur-md border-t flex items-center justify-around shadow-[0_-4px_12px_rgba(0,0,0,0.03)] pb-[env(safe-area-inset-bottom,0px)] h-[calc(64px+_env(safe-area-inset-bottom,0px))] md:h-auto md:bg-transparent md:backdrop-blur-none md:shadow-none md:pb-0">
      {tabs.map((tab, index) => {
        const Icon = icons[tab];
        return (
          <button 
            key={tab}
            id={`action-elem-${index + 1}`} 
            className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-0 flex-1 py-2.5 md:py-3 text-xs md:text-base font-semibold cursor-pointer transition-all capitalize ${
              activeTab === tab 
                ? 'text-zen-charcoal border-b-2 border-transparent md:border-zen-charcoal' 
                : 'text-zen-charcoal/60 hover:text-zen-charcoal border-b-2 border-transparent'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {Icon && <Icon className="block md:hidden w-5 h-5 text-current" />}
            <span>{tab}</span>
          </button>
        );
      })}
    </div>
  );
}
