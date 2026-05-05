'use client';
import { useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useExpenseStore } from '@/store/useExpenseStore';
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
  const { 
    hydrate, globalError, activeTab, 
    toggleAddModal, toggleCategoryModal, toggleChatModal, toggleSiriModal, 
    isCategoryModalOpen, isChatModalOpen, isAddModalOpen,
    reset 
  } = useExpenseStore();
  const hydrated = useRef(false);
  const router = useRouter();
  const supabase = createClient();

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

  if (!hydrated.current) {
    hydrate({
      expenses: initialExpenses,
      categories: initialCategories,
      user: initialUser,
      error: initialError
    });
    hydrated.current = true;
  }

  return (
    <>
      <div className="container">
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Expenses</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button id="siri-btn" style={{ display: "flex", alignItems: "center", padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', cursor: 'pointer' }} onClick={toggleSiriModal}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg> 
              <span style={{ marginLeft: '6px' }}>Siri Setup</span>
            </button>
            <button id="logout-btn" style={{ display: "block", padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', cursor: 'pointer' }} onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>

        {globalError && (
          <div style={{ color: 'red', padding: '10px', background: '#ffebee', borderRadius: '4px', marginBottom: '10px' }}>
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
    
      {/* Add Expense FAB and Modal */}
      <div className="fab-container">
        <button 
          id="action-elem-7" 
          className={`fab secondary-fab ${isCategoryModalOpen ? 'active' : ''}`} 
          style={{ 
            background: isCategoryModalOpen ? 'var(--accent)' : 'var(--card-bg)',
            color: isCategoryModalOpen ? 'white' : 'var(--text)'
          }} 
          title="Manage Categories" 
          onClick={toggleCategoryModal}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.2-1.8A2 2 0 0 0 7.55 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path></svg>
        </button>
        <button 
          id="action-elem-8" 
          className={`fab secondary-fab ${isChatModalOpen ? 'active' : ''}`} 
          style={{ 
            background: isChatModalOpen ? 'var(--accent)' : 'var(--card-bg)',
            color: isChatModalOpen ? 'white' : 'var(--text)'
          }}
          onClick={toggleChatModal}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>
        </button>
        <button 
          id="fab" 
          className={`fab ${isAddModalOpen ? 'active' : ''}`}
          style={{ transform: isAddModalOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}
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
