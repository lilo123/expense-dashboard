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
        aiContent = "Uh oh, the system tripped up! Don't worry, your data is safe. Let's try that again.";
      }

      setMessages(prev => [...prev, { role: 'ai', content: aiContent }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', content: "Uh oh, the system tripped up! Don't worry, your data is safe. Let's try that again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal" style={{ display: 'flex' }} onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) toggleChatModal();
    }}>
        <div className="modal-content chat-modal-content bg-white/40 backdrop-blur-md border border-white/20 shadow-xl text-zen-charcoal rounded-3xl" style={{ maxWidth: '450px', width: '100%', height: '85vh', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            
            <div className="chat-header bg-white/60 text-zen-charcoal border-b border-zen-lavender/30" style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                <div className="bg-zen-charcoal/20 rounded-full" style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', width: '40px', height: '5px' }} />
                
                <h2 className="text-zen-charcoal font-bold m-0 text-left pr-10 leading-snug w-fit" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg> 
                  AI Assistant
                </h2>
                <button 
                  id="action-elem-13" 
                  className="close-btn rounded-full text-zen-charcoal/60 hover:text-zen-charcoal" 
                  onClick={toggleChatModal}
                  style={{ top: '15px', right: '15px' }}
                  aria-label="Close Modal"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <div id="chat-history" ref={chatHistoryRef} className="chat-history bg-transparent" style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {messages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`chat-message px-4 py-3 max-w-[85%] text-[15px] shadow-sm transition-all duration-200 ${
                      msg.role === 'ai' 
                        ? 'bg-white/60 border border-white/30 text-zen-charcoal rounded-2xl rounded-tl-none self-start' 
                        : 'bg-zen-charcoal text-zen-base rounded-2xl rounded-tr-none self-end'
                    }`}
                  >
                    {msg.content}
                  </div>
                ))}
                {isLoading && (
                  <div className="chat-message px-4 py-3 max-w-[85%] text-[15px] shadow-sm bg-white/60 border border-white/30 text-zen-charcoal rounded-2xl rounded-tl-none self-start">
                    Thinking...
                  </div>
                )}
            </div>

            <div className="chat-input-area bg-white/60 border-t border-zen-lavender/30 flex gap-2 items-center" style={{ padding: '15px' }}>
                <input 
                  type="text" 
                  id="chat-input" 
                  placeholder="e.g., I spent $15 on coffee..." 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  className="flex-1 px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50 text-[15px] outline-none"
                />
                <button 
                  id="send-chat-btn" 
                  onClick={handleSend}
                  disabled={isLoading}
                  className="w-11 h-11 rounded-full bg-zen-charcoal text-zen-base hover:bg-zen-charcoal/90 flex justify-center items-center cursor-pointer transition-transform duration-100 shadow-sm border-none disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
        </div>
    </div>
  );
}
