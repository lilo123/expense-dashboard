'use client';
import { useState, useRef, useEffect } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';

export default function ChatBox() {
  const { isChatModalOpen, toggleChatModal, addExpense } = useExpenseStore();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: string, content: string}[]>([
    { role: 'ai', content: 'Hi! I can help you add, delete, or summarize expenses. How can I help today?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (!isChatModalOpen) return null;

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content })
      });
      const data = await res.json();
      
      let aiContent = data.reply;
      
      if (res.ok && data.expense) {
        // Immediately update the local Zustand store
        addExpense(data.expense);
        if (!aiContent) {
           aiContent = `Got it! I've added $${data.expense.amount} for ${data.expense.item} under ${(data.expense.categories?.name || data.expense.category_id)}.`;
        }
      } else if (!res.ok) {
        aiContent = data.error || 'Failed to process request.';
      }

      setMessages(prev => [...prev, { role: 'ai', content: aiContent }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Network error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal" style={{ display: 'flex' }} onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) toggleChatModal();
    }}>
        <div className="modal-content chat-modal-content" style={{ maxWidth: '450px', width: '100%', height: '85vh', padding: 0, borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            
            <div className="chat-header" style={{ padding: '15px', background: '#000', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', width: '40px', height: '5px', background: 'rgba(255,255,255,0.5)', borderRadius: '3px' }} />
                
                <h2 style={{ margin: 0, fontSize: '1.2rem', textAlign: 'left', flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg> 
                  AI Assistant
                </h2>
                <span id="action-elem-13" className="close" onClick={toggleChatModal} style={{ position: 'relative', top: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer', fontSize: '24px', lineHeight: 0, padding: 0, margin: 0, boxSizing: 'border-box', transition: 'background 0.2s' }}>&times;</span>
            </div>

            <div id="chat-history" ref={chatHistoryRef} className="chat-history" style={{ flex: 1, padding: '20px', overflowY: 'auto', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {messages.map((msg, idx) => (
                  <div key={idx} className={`chat-message ${msg.role === 'ai' ? 'ai-message' : 'user-message'}`} style={{
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
                    Thinking...
                  </div>
                )}
            </div>

            <div className="chat-input-area" style={{ padding: '15px', background: 'var(--card-bg)', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  id="chat-input" 
                  placeholder="e.g., I spent $15 on coffee..." 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: '24px', border: '1px solid var(--border)', fontSize: '15px', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }} 
                />
                <button 
                  id="send-chat-btn" 
                  onClick={handleSend}
                  disabled={isLoading}
                  style={{ background: 'var(--accent)', color: 'white', border: 'none', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', transition: 'transform 0.1s', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', opacity: isLoading ? 0.7 : 1 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
        </div>
    </div>
  );
}
