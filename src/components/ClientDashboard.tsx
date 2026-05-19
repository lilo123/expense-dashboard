'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useExpenseStore, StoreProvider } from '@/store/useExpenseStore';
import { syncExchangeRates } from '@/app/actions/rates';
import { getProfile, updateProfile } from '@/app/actions/profile';
import { Category } from '@/types/database';
import { Expense, User, Profile, Budget } from '@/types/database';
import { Settings, Sliders, Repeat, Mic, LogOut, Bot, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';

import Tabs from './Tabs';
import DashboardTab from './DashboardTab';
import ExpenseList from './ExpenseList';
import YearlyTab from './YearlyTab';
import Logo from './Logo';

// Dynamic lazy-loaded modals for optimal code-splitting and free-tier Vercel optimization
const AddExpenseModal = dynamic(() => import('./AddExpenseModal'), { ssr: false });
const EditExpenseModal = dynamic(() => import('./EditExpenseModal'), { ssr: false });
const BulkEditModal = dynamic(() => import('./BulkEditModal'), { ssr: false });
const SiriModal = dynamic(() => import('./SiriModal'), { ssr: false });
const RecurringModal = dynamic(() => import('./RecurringModal'), { ssr: false });
const ChatBox = dynamic(() => import('./ChatBox'), { ssr: false });
const OnboardingModal = dynamic(() => import('./OnboardingModal'), { ssr: false });

interface ClientDashboardProps {
  initialExpenses: Expense[];
  initialCategories: Category[];
  initialUser: User | null;
  initialError: string | null;
  initialProfile?: Profile | null;
  initialExchangeRates?: Record<string, number>;
  initialBudgets?: Budget[];
}

export default function ClientDashboard({
  initialExpenses,
  initialCategories,
  initialUser,
  initialError,
  initialProfile,
  initialExchangeRates,
  initialBudgets
}: ClientDashboardProps) {
  return (
    <StoreProvider initialData={{ 
      expenses: initialExpenses, 
      categories: initialCategories, 
      user: initialUser, 
      globalError: initialError,
      profile: initialProfile || null,
      exchangeRates: initialExchangeRates || { CAD: 1.0 },
      displayCurrency: initialProfile?.display_currency || 'CAD',
      baseCurrency: initialProfile?.base_currency || 'CAD',
      budgets: initialBudgets || []
    }}>
      <ClientDashboardContent />
    </StoreProvider>
  );
}

function ClientDashboardContent() {
  const { 
    globalError, activeTab, 
    toggleAddModal, toggleChatModal, toggleSiriModal, toggleRecurringModal, toggleOnboarding,
    isChatModalOpen, isAddModalOpen, isRecurringModalOpen, isOnboardingOpen,
    reset,
    displayCurrency, setDisplayCurrency, setExchangeRates,
    profile, setProfile, baseCurrency, user,
    addExpense, categories
  } = useExpenseStore(state => state);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // Timezone Sync Effect
  useEffect(() => {
    async function syncTimezone() {
      if (profile) {
        const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (profile.timezone !== localTZ) {
          try {
            const res = await updateProfile({ timezone: localTZ });
            if (res.success) {
              setProfile({ ...profile, timezone: localTZ });
            }
          } catch (err) {
            console.error('[TIMEZONE SYNC ERROR]:', err);
          }
        }
      }
    }
    syncTimezone();
  }, [profile, setProfile]);

  // Automatically sync & refresh exchange rates on startup
  useEffect(() => {
    async function refreshRates() {
      try {
        const rates = await syncExchangeRates();
        setExchangeRates(rates);
      } catch (err) {
        console.error('[EXCHANGE RATES AUTO-SYNC FAILURE]:', err);
      }
    }
    refreshRates();
  }, [setExchangeRates]);

  // Stable Ref for categories to prevent Supabase Realtime subscription churn
  const categoriesRef = useRef(categories);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  // Supabase Realtime Sync for Siri/Out-of-band Expense additions
  useEffect(() => {
    if (!user) return;

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
          const newExpense = payload.new as Expense;
          const category = categoriesRef.current.find(c => c.id === newExpense.category_id);
          const enrichedExpense: Expense = {
            ...newExpense,
            categories: category ? { name: category.name } : undefined
          };
          addExpense(enrichedExpense);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, addExpense]);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Cleanly redirect to login if unauthenticated (Hydration-Safe fallback for Server Action transitions)
  useEffect(() => {
    if (isMounted && !user) {
      window.location.href = '/login';
    }
  }, [isMounted, user]);

  // Trigger Onboarding Modal if pending
  useEffect(() => {
    if (isMounted && profile && profile.onboarding_status === 'pending' && !isOnboardingOpen) {
      toggleOnboarding();
    }
  }, [isMounted, profile, isOnboardingOpen, toggleOnboarding]);

  // E2E test simulation listener for OnboardingModal
  useEffect(() => {
    const handleSim = () => toggleOnboarding();
    window.addEventListener('onboarding-sim', handleSim);
    return () => window.removeEventListener('onboarding-sim', handleSim);
  }, [toggleOnboarding]);

  // Hydration-Safe Restore preferred display currency
  useEffect(() => {
    if (isMounted) {
      const stored = localStorage.getItem('displayCurrency');
      if (stored) {
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

                {isDropdownOpen && (
                  <div 
                    id="profile-dropdown"
                    className="absolute right-0 mt-2 w-48 bg-white/60 backdrop-blur-md border border-white/20 shadow-lg rounded-2xl p-2 flex flex-col gap-1 z-50 text-left"
                    style={{ transformOrigin: 'top right' }}
                  >
                    <Link 
                      href="/settings" 
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-zen-sage/10 text-zen-charcoal text-sm font-semibold transition-all no-underline cursor-pointer"
                    >
                      <Settings size={16} /> Account Overview
                    </Link>

                    <Link 
                      href="/budget"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-zen-sage/10 text-zen-charcoal text-sm font-semibold transition-all no-underline cursor-pointer"
                    >
                      <Sliders size={16} /> Set Monthly Budget
                    </Link>

                    <button 
                      onClick={() => { setIsDropdownOpen(false); toggleRecurringModal(); }}
                      className="flex items-center gap-2 text-left px-3 py-2 rounded-xl hover:bg-zen-sage/10 text-zen-charcoal text-sm font-semibold transition-all cursor-pointer border-none bg-transparent w-full"
                    >
                      <Repeat size={16} /> Recurring Expense
                    </button>
                    
                    <button 
                      onClick={() => { setIsDropdownOpen(false); toggleSiriModal(); }}
                      className="flex items-center gap-2 text-left px-3 py-2 rounded-xl hover:bg-zen-sage/10 text-zen-charcoal text-sm font-semibold transition-all cursor-pointer border-none bg-transparent w-full"
                    >
                      <Mic size={16} /> Siri Setup
                    </button>

                    <hr className="border-t border-zen-lavender/20 my-1" />

                    <button 
                      onClick={() => { setIsDropdownOpen(false); handleSignOut(); }}
                      className="flex items-center gap-2 text-left px-3 py-2 rounded-xl hover:bg-zen-peach/30 text-zen-charcoal font-bold text-sm transition-all cursor-pointer border-none bg-transparent w-full"
                    >
                      <LogOut size={16} /> Sign Out
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
          className={`fab secondary-fab transition-all duration-200 rounded-full flex items-center justify-center ${isChatModalOpen ? 'bg-zen-sage text-zen-charcoal shadow-md border-none' : 'bg-white/60 text-zen-charcoal/60 border border-zen-lavender/30 hover:bg-white/80'}`}
          onClick={() => { console.log("FAB_CLICKED_SUCCESSFULLY"); toggleChatModal(); }}
        >
          <Bot size={24} />
        </button>
        <button 
          id="fab" 
          className={`fab transition-all duration-200 rounded-full shadow-md border-none cursor-pointer flex items-center justify-center ${isAddModalOpen ? 'bg-zen-sage text-zen-charcoal rotate-45' : 'bg-zen-charcoal text-zen-base hover:bg-zen-charcoal/90'}`}
          onClick={toggleAddModal}
        >
          <Plus size={24} />
        </button>
      </div>
      
      <AddExpenseModal />
      <EditExpenseModal />
      <BulkEditModal />
      <ChatBox />
      <SiriModal />
      <RecurringModal />
      <OnboardingModal />
    </>
  );
}
