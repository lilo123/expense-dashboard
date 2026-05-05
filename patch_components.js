const fs = require('fs');

// 1. ClientDashboard.tsx
const clientDashboardContent = `'use client';
import { useRef } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { Expense, User } from '@/types/database';
import Tabs from './Tabs';
import DashboardTab from './DashboardTab';
import ChatBox from './ChatBox';
import ExpenseList from './ExpenseList';
import YearlyTab from './YearlyTab';
import AddExpenseModal from './AddExpenseModal';
import EditExpenseModal from './EditExpenseModal';
import ManageCategoriesModal from './ManageCategoriesModal';

interface ClientDashboardProps {
  initialExpenses: Expense[];
  initialCategories: string[];
  initialUser: User | null;
  initialError: string | null;
}

export default function ClientDashboard({
  initialExpenses,
  initialCategories,
  initialUser,
  initialError
}: ClientDashboardProps) {
  const { hydrate, globalError, activeTab, toggleAddModal, toggleCategoryModal, toggleChatModal } = useExpenseStore();
  const hydrated = useRef(false);

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
          <button id="siri-btn" style={{ display: 'none', marginRight: '10px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', cursor: 'pointer' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg> Siri Setup
          </button>
          <button id="logout-btn" style={{ display: 'none', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>

        {globalError && (
          <div style={{ color: 'red', padding: '10px', background: '#ffebee', borderRadius: '4px', marginBottom: '10px' }}>
            Error: {globalError}
          </div>
        )}

        <Tabs />

        {/* DASHBOARD TAB */}
        <div id="tab-dashboard" className={activeTab === \'dashboard\' ? \'tab-content active\' : \'tab-content\'}>
          <DashboardTab />
        </div>

        {/* RECENT TAB */}
        <div id="tab-recent" className={activeTab === \'recent\' ? \'tab-content active\' : \'tab-content\'}>
          <ExpenseList />
        </div>

        {/* YEARLY TAB */}
        <div id="tab-yearly" className={activeTab === \'yearly\' ? \'tab-content active\' : \'tab-content\'}>
          <YearlyTab />
        </div>
      </div>
    
      {/* Add Expense FAB and Modal */}
      <div className="fab-container">
        <button id="action-elem-7" className="fab secondary-fab" style={{ bottom: '140px' }} title="Manage Categories" onClick={toggleCategoryModal}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.2-1.8A2 2 0 0 0 7.55 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path></svg>
        </button>
        <button id="action-elem-8" className="fab secondary-fab" onClick={toggleChatModal}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>
        </button>
        <button id="fab" className="fab" onClick={toggleAddModal}>+</button>
      </div>
      
      <AddExpenseModal />
      <EditExpenseModal />
      <ChatBox />
      {/* Assuming ManageCategoriesModal already exists or handles itself if absent */}
    </>
  );
}';
fs.writeFileSync('src/components/ClientDashboard.tsx', clientDashboardContent);

// 2. ChatBox.tsx
const chatBoxContent = `'use client';
import { useState } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';

export default function ChatBox() {
  const { isChatModalOpen, toggleChatModal } = useExpenseStore();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string}[]>([
    { role: 'ai', content: 'Hi! I can help you add, delete, or summarize expenses. How can I help today?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  if (!isChatModalOpen) return null;

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      
      if (response.ok) {
        setMessages(prev => [...prev, { role: 'ai', content: 'Expense processed!' }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: 'Sorry, there was an error processing your request.' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Network error.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="chat-modal" className="modal" style={{ display: 'flex' }} onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) toggleChatModal();
    }}>
        <div className="modal-content chat-modal-content" style={{ borderRadius: '16px', overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column', maxWidth: '450px', background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--accent)', color: 'white', padding: '15px 20px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', textAlign: 'left', flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg> 
                  AI Assistant
                </h2>
                <span id="action-elem-13" className="close" onClick={toggleChatModal} style={{ position: 'relative', top: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer', fontSize: '24px', lineHeight: 0, padding: 0, margin: 0, boxSizing: 'border-box', transition: 'background 0.2s' }}>&times;</span>
            </div>
            <div id="chat-history" className="chat-history" style={{ flex: 1, padding: '20px', overflowY: 'auto', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {messages.map((msg, idx) => (
                  <div key={idx} className={msg.role === \'ai\' ? \'chat-message ai-message\' : \'chat-message user-message\'} style={{
                    background: msg.role === 'ai' ? 'var(--card-bg)' : 'var(--accent)',
                    border: msg.role === 'ai' ? '1px solid var(--border)' : 'none',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    borderTopLeftRadius: msg.role === 'ai' ? '2px' : '12px',
                    borderTopRightRadius: msg.role === 'user' ? '2px' : '12px',
                    alignSelf: msg.role === 'ai' ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    fontSize: '15px',
                    color: msg.role === 'ai' ? 'var(--text)' : 'white',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    {msg.content}
                  </div>
                ))}
                {isLoading && (
                  <div className="chat-message ai-message" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: '12px', borderTopLeftRadius: '2px', alignSelf: 'flex-start', maxWidth: '85%', fontSize: '15px', color: 'var(--text)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    ...
                  </div>
                )}
            </div>
            <div className="chat-input-area" style={{ padding: '15px', background: 'var(--card-bg)', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  id="chat-input" 
                  placeholder="e.g., I spent $15 on coffee..." 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: '24px', border: '1px solid var(--border)', fontSize: '15px', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }} 
                />
                <button id="send-chat-btn" onClick={handleSend} disabled={isLoading} style={{ background: 'var(--accent)', color: 'white', border: 'none', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: isLoading ? 'default' : 'pointer', transition: 'transform 0.1s', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', opacity: isLoading ? 0.7 : 1 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
        </div>
    </div>
  );
}';
fs.writeFileSync('src/components/ChatBox.tsx', chatBoxContent);

// 3. EditExpenseModal.tsx
const editExpenseContent = `'use client';
import { useState, useEffect } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';

export default function EditExpenseModal() {
  const { isEditModalOpen, toggleEditModal, editingExpense, categories } = useExpenseStore();
  const [date, setDate] = useState('');
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (editingExpense) {
      setDate(editingExpense.date || '');
      setItem(editingExpense.item || '');
      setAmount(editingExpense.amount?.toString() || '');
      setCategory(editingExpense.category || '');
    }
  }, [editingExpense]);

  if (!isEditModalOpen) return null;

  const handleSave = () => {
    // TODO: implement save
    toggleEditModal();
  };

  const handleDelete = () => {
    // TODO: implement delete
    toggleEditModal();
  };

  return (
    <div id="edit-modal" className="modal" style={{ display: 'flex' }} onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) toggleEditModal();
    }}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            <span id="action-elem-6" className="close" onClick={toggleEditModal}>&times;</span>
            <h2>Edit Expense</h2>
            <input type="hidden" id="edit-row" />
            <input type="date" id="edit-date" value={date} onChange={e => setDate(e.target.value)} />
            <input type="text" id="edit-item" placeholder="Item Name" value={item} onChange={e => setItem(e.target.value)} />
            <input type="number" id="edit-amount" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
            <select id="edit-category" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="" disabled>Select category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <button id="save-edit-btn" onClick={handleSave}>Save Changes</button>
            <button id="delete-edit-btn" className="danger-btn" style={{ marginTop: '10px' }} onClick={handleDelete}>Delete</button>
        </div>
    </div>
  );
}';
fs.writeFileSync('src/components/EditExpenseModal.tsx', editExpenseContent);

// 4. AddExpenseModal.tsx
const addExpenseContent = `'use client';
import { useState } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';

export default function AddExpenseModal() {
  const { isAddModalOpen, toggleAddModal, categories } = useExpenseStore();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');

  if (!isAddModalOpen) return null;

  const handleAdd = () => {
    // TODO: implement add
    toggleAddModal();
  };

  return (
    <div id="add-modal" className="modal" style={{ display: 'flex' }} onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) toggleAddModal();
    }}>
        <div className="modal-content" style={{ maxWidth: '400px', padding: '25px', borderRadius: '12px', maxHeight: '90dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <span id="action-elem-9" className="close" style={{ fontSize: '24px' }} onClick={toggleAddModal}>&times;</span>
            <h2 style={{ marginBottom: '20px', fontSize: '1.5em', color: 'var(--text)' }}>Add Expense</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input type="date" id="add-date" required value={date} onChange={e => setDate(e.target.value)} style={{ WebkitAppearance: 'none', appearance: 'none', display: 'block', maxWidth: '100%', margin: 0, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px', width: '100%', boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text)' }} />
                <input type="text" id="add-item" placeholder="What did you buy?" required value={item} onChange={e => setItem(e.target.value)} style={{ WebkitAppearance: 'none', appearance: 'none', display: 'block', maxWidth: '100%', margin: 0, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px', width: '100%', boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text)' }} />
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 12px', overflow: 'hidden', boxSizing: 'border-box', height: '46px' }}>
                    <span style={{ color: '#666', fontSize: '16px', marginRight: '6px', display: 'flex', alignItems: 'center', lineHeight: 1, height: '100%', marginTop: '2px' }}>$</span>
                    <input type="number" id="add-amount" placeholder="0.00" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text)', padding: 0, margin: 0, fontSize: '16px', boxSizing: 'border-box', outline: 'none', WebkitAppearance: 'none', height: '100%', lineHeight: '44px', display: 'flex', alignItems: 'center' }} />
                </div>
                <select id="add-category" value={category} onChange={e => setCategory(e.target.value)} style={{ WebkitAppearance: 'none', appearance: 'none', display: 'block', maxWidth: '100%', margin: 0, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px', width: '100%', boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text)' }}>
                  <option value="" disabled>Select category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <button id="add-expense-btn" onClick={handleAdd} style={{ padding: '14px', borderRadius: '8px', fontWeight: 'bold', background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', marginTop: '5px', fontSize: '16px', transition: 'opacity 0.2s' }}>Add Expense</button>
            </div>
        </div>
    </div>
  );
}';
fs.writeFileSync('src/components/AddExpenseModal.tsx', addExpenseContent);
