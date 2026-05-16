'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useExpenseStore, StoreProvider } from '@/store/useExpenseStore';
import { syncExchangeRates } from '@/app/actions/rates';
import { getProfile, updateProfile } from '@/app/actions/profile';
import { Category } from '@/types/database';
import { Expense, User } from '@/types/database';
import Tabs from './Tabs';
import DashboardTab from './DashboardTab';
import ChatBox from './ChatBox';
import ExpenseList from './ExpenseList';
import YearlyTab from './YearlyTab';
import AddExpenseModal from './AddExpenseModal';
import EditExpenseModal from './EditExpenseModal';
import BulkEditModal from './BulkEditModal';
import SiriModal from './SiriModal';
import RecurringModal from './RecurringModal';
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
    toggleAddModal, toggleChatModal, toggleSiriModal, toggleRecurringModal,
    isChatModalOpen, isAddModalOpen, isRecurringModalOpen,
    reset,
    displayCurrency, setDisplayCurrency, setExchangeRates,
    profile, setProfile, baseCurrency, user,
    addExpense, categories
  } = useExpenseStore(state => state);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Touch states for custom Pull-to-Refresh (PWA fallback)
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullThreshold = 85; // px
  
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

  // Timezone Sync Effect
  useEffect(() => {
    async function syncTimezone() {
      if (profile) {
        const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (profile.timezone !== localTZ) {
          console.log(`[TIMEZONE SYNC] Browser timezone (${localTZ}) differs from profile (${profile.timezone}). Syncing...`);
          try {
            const res = await updateProfile({
              timezone: localTZ
            });
            if (res.success) {
              setProfile({ ...profile, timezone: localTZ });
              console.log('[TIMEZONE SYNC SUCCESS] Database and store updated.');
            } else {
              console.error('[TIMEZONE SYNC FAILED]:', res.error);
            }
          } catch (err) {
            console.error('[TIMEZONE SYNC ERROR]:', err);
          }
        }
      }
    }
    syncTimezone();
  }, [profile, setProfile]);

  // Supabase Realtime Sync for Siri/Out-of-band Expense additions
  useEffect(() => {
    if (!user) return;

    console.log('[REALTIME SUBSCRIPTION] Initializing for user:', user.id);
    const channel = supabase
      .channel('realtime-expenses')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'expenses',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[REALTIME] New expense inserted in DB:', payload.new);
          const newExpense = payload.new as Expense;
          
          // Look up category name from store categories
          const category = categories.find(c => c.id === newExpense.category_id);
          
          const enrichedExpense: Expense = {
            ...newExpense,
            categories: category ? { name: category.name } : undefined
          };

          addExpense(enrichedExpense);
        }
      )
      .subscribe((status) => {
        console.log(`[REALTIME] Subscription status for user ${user.id}: ${status}`);
      });

    return () => {
      console.log('[REALTIME SUBSCRIPTION] Cleaning up for user:', user.id);
      supabase.removeChannel(channel);
    };
  }, [user, supabase, categories, addExpense]);

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

  // Pull-to-Refresh Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (typeof window !== 'undefined' && window.scrollY === 0 && !isRefreshing) {
      setTouchStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - touchStart;

    if (distance > 0 && window.scrollY === 0) {
      // Pulling down - apply resistance
      const resistedDistance = Math.min(distance * 0.35, 120); // cap pull visual at 120px
      setPullDistance(resistedDistance);

      // Prevent iOS default rubber-band scroll if pulling
      if (e.cancelable) {
        e.preventDefault();
      }
    } else {
      // Cancel pull if scrolling up
      setTouchStart(null);
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (touchStart === null || isRefreshing) return;

    if (pullDistance >= pullThreshold) {
      setIsRefreshing(true);
      setPullDistance(0);
      setTouchStart(null);

      console.log('[PULL TO REFRESH] Reloading page...');
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } else {
      setPullDistance(0);
      setTouchStart(null);
    }
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
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen w-full relative"
    >
      {/* Custom Pull-to-Refresh Visual Indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          className="fixed left-1/2 z-50 bg-white/80 backdrop-blur-md border border-zen-lavender/30 shadow-md rounded-full w-10 h-10 flex items-center justify-center pointer-events-none transition-all duration-75 animate-fade-in"
          style={{ 
            top: isRefreshing ? '20px' : `${Math.min(10 + pullDistance, 90)}px`,
            opacity: isRefreshing ? 1 : Math.min(pullDistance / pullThreshold, 1),
            transform: `translateX(-50%) rotate(${pullDistance * 3}deg)`,
          }}
        >
          {isRefreshing ? (
            <svg className="animate-spin h-5 w-5 text-zen-charcoal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-zen-charcoal/70">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.72 2.78L21 8"/>
              <polyline points="21 3 21 8 16 8"/>
            </svg>
          )}
        </div>
      )}
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
                  style={{ minHeight: 0 }}
                  className="w-10 h-10 rounded-full border border-zen-lavender/40 bg-white/60 hover:bg-white/80 text-zen-charcoal font-bold text-sm flex items-center justify-center transition-all cursor-pointer select-none shadow-sm shrink-0 min-h-0"
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
                      onClick={() => { setIsDropdownOpen(false); toggleRecurringModal(); }}
                      className="flex items-center text-left px-3 py-2 rounded-xl hover:bg-zen-sage/10 text-zen-charcoal text-sm font-semibold transition-all cursor-pointer border-none bg-transparent w-full"
                    >
                      Recurring Expense
                    </button>
                    
                    <button 
                      onClick={() => { setIsDropdownOpen(false); toggleSiriModal(); }}
                      className="flex items-center text-left px-3 py-2 rounded-xl hover:bg-zen-sage/10 text-zen-charcoal text-sm font-semibold transition-all cursor-pointer border-none bg-transparent w-full"
                    >
                      Siri Setup
                    </button>



                    <hr className="border-t border-zen-lavender/20 my-1" />

                    <button 
                      onClick={() => { setIsDropdownOpen(false); handleSignOut(); }}
                      className="flex items-center text-left px-3 py-2 rounded-xl hover:bg-zen-peach/30 text-zen-charcoal font-bold text-sm transition-all cursor-pointer border-none bg-transparent w-full"
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
      <BulkEditModal />
      <ChatBox />
      <SiriModal />
      <RecurringModal />
    </div>
  );
}
