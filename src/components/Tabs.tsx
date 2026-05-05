'use client';
import { useExpenseStore } from '@/store/useExpenseStore';

export default function Tabs() {
  const { activeTab, setActiveTab } = useExpenseStore();

  return (
    <div className="tabs">
      <button 
        id="action-elem-1" 
        className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => setActiveTab('dashboard')}
      >
        Dashboard
      </button>
      <button 
        id="action-elem-2" 
        className={`tab-btn ${activeTab === 'recent' ? 'active' : ''}`}
        onClick={() => setActiveTab('recent')}
      >
        Recent
      </button>
      <button 
        id="action-elem-3" 
        className={`tab-btn ${activeTab === 'yearly' ? 'active' : ''}`}
        onClick={() => setActiveTab('yearly')}
      >
        Yearly
      </button>
    </div>
  );
}
