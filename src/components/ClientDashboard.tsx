'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useExpenseStore, StoreProvider } from '@/store/useExpenseStore';
import { syncExchangeRates } from '@/app/actions/rates';
import { getProfile } from '@/app/actions/profile';
import { Category } from '@/types/database';
import { Expense, User } from '@/types/database';
import Tabs from './Tabs';
import DashboardTab from './DashboardTab';
import ChatBox from './ChatBox';
import ExpenseList from './ExpenseList';
import YearlyTab from './YearlyTab';
import AddExpenseModal from './AddExpenseModal';
import EditExpenseModal from './EditExpenseModal';
import CategoryModal from './CategoryModal';
import BulkEditModal from './BulkEditModal';
import SiriModal from './SiriModal';
import Logo from './Logo';

interface ClientDashboardProps {
  initialExpenses: Expense[];
  initialCategories: Category[];
  initialUser: User | null;
  initialError: string | null;
}

export default function ClientDashboard({
  initialExpenses,
  initialCategories,
  initialUser,
  initialError
}: ClientDashboardProps) {
  return (
    <StoreProvider initialData={{ expenses: initialExpenses, categories: initialCategories, user: initialUser, globalError: initialError }}>
      <ClientDashboardContent />
    </StoreProvider>
  );
}

function ClientDashboardContent() {
  const { 
    globalError, activeTab, 
    toggleAddModal, toggleCategoryModal, toggleChatModal, toggleSiriModal, 
    isCategoryModalOpen, isChatModalOpen, isAddModalOpen,
    reset,
    displayCurrency, setDisplayCurrency, setExchangeRates,
    profile, setProfile, baseCurrency, user
  } = useExpenseStore(state => state);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  // Sync Exchange Rates & Profile on Mount
  useEffect(() => {
    async function fetchRatesAndProfile() {
      try {
        // 1. Sync FX rates cache
        const rates = await syncExchangeRates();
        setExchangeRates(rates);

        // 2. Hydrate user settings profile from database
        const profileRes = await getProfile();
        if (profileRes.success && profileRes.data) {
          console.log('[PROFILE HYDRATION] Loaded database settings successfully.');
          setProfile(profileRes.data);
        }
      } catch (err) {
        console.error('[UI INITIAL SYNC ERROR] Failed to sync live rates or profile:', err);
      }
    }
    fetchRatesAndProfile();
  }, [setExchangeRates, setProfile]);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Hydration-Safe Restore preferred display currency
  useEffect(() => {
    if (isMounted) {
      const stored = localStorage.getItem('displayCurrency');
      if (stored) {
        console.log('[FX STORAGE HIT] Restoring preferred display currency:', stored);
        setDisplayCurrency(stored as any);
      }
    }
  }, [isMounted, setDisplayCurrency]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    reset();
    router.push('/login');
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      const updateViewport = () => {
        const modals = document.querySelectorAll('.modal-content, .chat-modal');
        const offset = window.innerHeight - (window.visualViewport?.height || window.innerHeight);
        modals.forEach((modal) => {
          if (modal instanceof HTMLElement && modal.offsetParent !== null) {
            modal.style.marginBottom = offset > 0 ? `${offset}px` : '0px';
          }
        });
      };
      window.visualViewport.addEventListener('resize', updateViewport);
      window.visualViewport.addEventListener('scroll', updateViewport);
      return () => {
        window.visualViewport?.removeEventListener('resize', updateViewport);
        window.visualViewport?.removeEventListener('scroll', updateViewport);
      };
    }
  }, []);

  return (
    <>
      <div className="container">
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <Link href="/" className="cursor-pointer hover:opacity-80 transition-all no-underline">
            <Logo className="w-24 h-8 text-zen-charcoal flex items-center" />
          </Link>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }} className="relative">
            {isMounted ? (
              <div className="relative">
                {/* 1. Profile Initials Avatar button */}
                <button 
                  id="profile-btn"
                  aria-label="Profile Menu"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-10 h-10 rounded-full border border-zen-lavender/40 bg-white/60 hover:bg-white/80 text-zen-charcoal font-bold text-sm flex items-center justify-center transition-all cursor-pointer select-none shadow-sm"
                >
                  {profile?.display_name
                    ? profile.display_name.substring(0, 2).toUpperCase()
                    : (user?.email ? user.email.substring(0, 2).toUpperCase() : 'U')}
                </button>

                {/* 2. Floating Glassmorphic Dropdown Menu */}
                {isDropdownOpen && (
                  <div 
                    id="profile-dropdown"
                    className="absolute right-0 mt-2 w-48 bg-white/60 backdrop-blur-md border border-white/20 shadow-lg rounded-2xl p-2 flex flex-col gap-1 z-50 text-left"
                    style={{ transformOrigin: 'top right' }}
                  >
                    <Link 
                      href="/settings" 
                      onClick={() => setIsDropdownOpen(false)}
                      className="block px-3 py-2 rounded-xl hover:bg-zen-sage/10 text-zen-charcoal text-sm font-semibold transition-all no-underline cursor-pointer"
                    >
                      Account Overview
                    </Link>
                    
                    <button 
                      onClick={() => { setIsDropdownOpen(false); toggleSiriModal(); }}
                      className="flex items-center text-left px-3 py-2 rounded-xl hover:bg-zen-sage/10 text-zen-charcoal text-sm font-semibold transition-all cursor-pointer border-none bg-transparent w-full"
                    >
                      Siri Setup
                    </button>

                    {/* Inline Currency Select Dropdown Pill */}
                    <div className="px-3 py-2 flex flex-col gap-1">
                      <span className="text-[10px] text-zen-charcoal/50 font-bold uppercase tracking-wider">Display Currency</span>
                      <select 
                        value={displayCurrency} 
                        aria-label="Currency"
                        onChange={e => { 
                          setDisplayCurrency(e.target.value as any);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-zen-lavender/40 bg-white/80 text-zen-charcoal text-xs font-semibold cursor-pointer outline-none"
                      >
                        <option value="CAD">CAD (C$)</option>
                        <option value="VND">VND (₫)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="JPY">JPY (¥)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="SGD">SGD (S$)</option>
                      </select>
                    </div>

                    <hr className="border-t border-zen-lavender/20 my-1" />

                    <button 
                      onClick={() => { setIsDropdownOpen(false); handleSignOut(); }}
                      className="flex items-center text-left px-3 py-2 rounded-xl hover:bg-zen-peach/20 text-zen-peach font-semibold text-sm transition-all cursor-pointer border-none bg-transparent w-full"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full border border-zen-lavender/20 bg-white/40 flex items-center justify-center select-none shadow-sm animate-pulse" />
            )}
          </div>
        </div>

        {globalError && (
          <div className="my-4 p-3 bg-zen-peach/20 border border-zen-peach/50 text-zen-charcoal rounded-full text-sm text-center font-semibold">
            Error: {globalError}
          </div>
        )}

        <Tabs />

        {/* DASHBOARD TAB */}
        <div id="tab-dashboard" className={`tab-content ${activeTab === 'dashboard' ? 'active' : ''}`}>
          <DashboardTab />
        </div>

        {/* RECENT TAB */}
        <div id="tab-recent" className={`tab-content ${activeTab === 'recent' ? 'active' : ''}`}>
          <ExpenseList />
        </div>

        {/* YEARLY TAB */}
        <div id="tab-yearly" className={`tab-content ${activeTab === 'yearly' ? 'active' : ''}`}>
          <YearlyTab />
        </div>
      </div>
      
      {isMounted && <div id="hydrated-marker" style={{ width: 0, height: 0, opacity: 0, position: 'absolute', pointerEvents: 'none' }} />}
    
      {/* Add Expense FAB and Modal */}
      <div className="fab-container">
        <button 
          id="action-elem-7" 
          className={`fab secondary-fab transition-all duration-200 rounded-full ${isCategoryModalOpen ? 'bg-zen-sage text-zen-charcoal shadow-md border-none' : 'bg-white/60 text-zen-charcoal/60 border border-zen-lavender/30 hover:bg-white/80'}`}
          title="Manage Categories" 
          onClick={toggleCategoryModal}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.2-1.8A2 2 0 0 0 7.55 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path></svg>
        </button>
        <button 
          id="action-elem-8" 
          className={`fab secondary-fab transition-all duration-200 rounded-full ${isChatModalOpen ? 'bg-zen-sage text-zen-charcoal shadow-md border-none' : 'bg-white/60 text-zen-charcoal/60 border border-zen-lavender/30 hover:bg-white/80'}`}
          onClick={() => { console.log("FAB_CLICKED_SUCCESSFULLY"); toggleChatModal(); }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>
        </button>
        <button 
          id="fab" 
          className={`fab transition-all duration-200 rounded-full shadow-md border-none cursor-pointer ${isAddModalOpen ? 'bg-zen-sage text-zen-charcoal rotate-45' : 'bg-zen-charcoal text-zen-base hover:bg-zen-charcoal/90'}`}
          onClick={toggleAddModal}
        >
          +
        </button>
      </div>
      
      <AddExpenseModal />
      <EditExpenseModal />
      <CategoryModal />
      <BulkEditModal />
      <ChatBox />
      <SiriModal />
    </>
  );
}
