'use client';
import { useState } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { generateSiriTokenAction } from '@/app/actions/siri';

export default function SiriModal() {
  const { isSiriModalOpen, toggleSiriModal } = useExpenseStore();
  const [token, setToken] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
    } catch (err) {
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
      } catch (err) {
        // Fallback copy
      }
    }
  };

  return (
    <div id="siri-modal" className="modal" style={{ display: 'flex' }} onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) toggleSiriModal();
    }}>
        <div className="modal-content bg-white/40 backdrop-blur-md border border-white/20 shadow-xl text-zen-charcoal rounded-3xl" style={{ maxWidth: '500px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-zen-charcoal font-bold m-0 text-left pr-10 leading-snug">Connect with Siri</h2>
            <button className="close-btn rounded-full" onClick={toggleSiriModal}>×</button>
            <p className="text-sm mb-4">Generate a secure API token to allow Siri to add expenses. Keep this token secret!</p>
            
            <div className="bg-white/60 border border-zen-lavender/40 p-4 rounded-2xl mb-5 text-left shadow-sm">
                <p className="text-sm font-medium">Your Personal API Token:</p>
                <div className="flex gap-2 mt-3 items-center w-full">
                    <input 
                      type="text" 
                      readOnly 
                      value={isCopied ? "Copied to clipboard!" : token} 
                      onClick={handleCopy}
                      className="flex-1 font-mono px-4 py-2 rounded-full text-sm h-9 border bg-white/50 text-center cursor-pointer" 
                      placeholder="Click Generate..." 
                    />
                    <button onClick={handleGenerate} disabled={isLoading} className="px-6 bg-zen-sage text-zen-charcoal rounded-full font-bold text-sm h-9 border-none cursor-pointer">
                      {isLoading ? 'Generating...' : 'Generate'}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}
