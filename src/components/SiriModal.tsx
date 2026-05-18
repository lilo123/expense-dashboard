'use client';
import { useState, useEffect } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { generateSiriTokenAction } from '@/app/actions/siri';

export default function SiriModal() {
  const { isSiriModalOpen, toggleSiriModal } = useExpenseStore();
  const [token, setToken] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (isSiriModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isSiriModalOpen]);

  if (!isSiriModalOpen) return null;

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const res = await generateSiriTokenAction();
      if (res.success && res.token) {
        setToken(res.token);
      } else {
        alert(res.error || 'Failed to generate token');
      }
    } catch {
      alert('Failed to generate token');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (token) {
      try {
        await navigator.clipboard.writeText(token);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1500);
      } catch {
        // Fallback copy
      }
    }
  };

  return (
    <div id="siri-modal" className="modal" style={{ display: 'flex' }} onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) toggleSiriModal();
    }}>
        <div className="modal-content bg-white/40 backdrop-blur-md border border-white/20 shadow-xl text-zen-charcoal rounded-3xl" style={{ maxWidth: '500px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-zen-charcoal font-bold m-0 text-left pr-10 leading-snug w-fit" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.5em', marginBottom: '16px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
              Connect with Siri
            </h2>
            <button 
              id="action-elem-12" 
              className="close-btn rounded-full" 
              onClick={toggleSiriModal}
              aria-label="Close Modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <p style={{ color: 'var(--secondary-text)', marginBottom: '20px', fontSize: '14px', lineHeight: '1.5' }}>
                Generate a secure API token to allow Siri to add expenses without logging in every time. Keep this token secret!
            </p>
            
            <div className="bg-white/60 border border-zen-lavender/40 p-4 rounded-2xl mb-5 text-left shadow-sm">
                <p style={{ marginTop: 0, fontWeight: 500, fontSize: '14px' }}>Your Personal API Token (Click token to copy):</p>
                <div className="flex gap-2 mt-3 flex-wrap items-center w-full">
                    <input 
                      type="text" 
                      id="siri-token-display" 
                      readOnly 
                      value={isCopied ? "Copied to clipboard!" : token} 
                      onClick={handleCopy}
                      className={`flex-1 min-w-[200px] font-mono px-4 py-2 rounded-full outline-none text-sm h-9 cursor-pointer text-center transition-all border ${
                        isCopied 
                          ? 'bg-zen-sage/20 border-zen-sage text-zen-charcoal font-bold' 
                          : 'bg-white/50 border-zen-lavender/60 text-zen-charcoal placeholder-zen-charcoal/50'
                      }`}
                      placeholder="Click Generate..." 
                    />
                    <button id="generate-siri-btn" onClick={handleGenerate} disabled={isLoading} className="px-6 bg-zen-sage text-zen-charcoal rounded-full font-bold hover:bg-zen-sage/90 cursor-pointer text-sm transition-colors border-none h-9 flex items-center justify-center">
                      {isLoading ? 'Generating...' : 'Generate'}
                    </button>
                </div>
            </div>
            
            {/* RESTORED SETUP INSTRUCTIONS */}
            <div style={{ marginTop: '25px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <h3 className="text-zen-charcoal font-bold m-0" style={{ fontSize: '16px', marginBottom: '10px' }}>How to set up:</h3>
                <ol style={{ paddingLeft: '20px', fontSize: '14px', color: 'var(--secondary-text)', lineHeight: '1.6' }}>
                    <li><strong>Generate and Copy</strong> your token above.</li>
                    <li>Open the <strong>Shortcuts app</strong> on your iPhone and tap <strong>+</strong>. Name it &ldquo;Log Expense&rdquo;.</li>
                    <li>Add an <strong>Ask for Input</strong> action. Set the prompt to <em>&ldquo;What did you spend?&rdquo;</em></li>
                    <li>Add a <strong>Get Contents of URL</strong> action and configure it:
                        <ul className="pl-6 pr-3 py-3 my-2 bg-white/60 border border-zen-lavender/40 rounded-2xl list-disc text-left shadow-sm">
                            <li><strong>URL:</strong> <code id="siri-endpoint-url" className="bg-zen-lavender/30 px-2 py-0.5 rounded font-mono text-sm">https://expense-dashboard-blond.vercel.app/api/siri</code></li>
                            <li><strong>Method:</strong> POST</li>
                            <li><strong>Headers:</strong> Add new header <code>Authorization</code> with value <code>Bearer [PASTE_YOUR_TOKEN_HERE]</code></li>
                            <li><strong>Request Body:</strong> Select <strong>JSON</strong>. Tap <strong>Add new field</strong> &rarr; <strong>Text</strong>.
                                <ul style={{ marginTop: '3px', paddingLeft: '15px', listStyleType: 'square', color: 'var(--text)' }}>
                                    <li>Key: <code>message</code></li>
                                    <li>Text: Tap and select the <strong>Provided Input</strong> variable.</li>
                                </ul>
                            </li>
                        </ul>
                    </li>
                    <li>Save it. Now just say: <em>&ldquo;Hey Siri, Log Expense!&rdquo;</em></li>
                </ol>
            </div>
        </div>
    </div>
  );
}
