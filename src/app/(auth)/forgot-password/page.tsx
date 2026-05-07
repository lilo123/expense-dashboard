'use client';

import { useState } from 'react';
import Link from 'next/link';
import { forgotPasswordAction } from './actions';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const result = await forgotPasswordAction(email);
      if (result?.error) {
        setError(result.error);
      } else {
        setMessage('Check your email for the password reset link.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" id="auth-screen">
      <Link 
        href="/login" 
        className="absolute top-6 left-6 flex items-center gap-2 text-zen-charcoal/60 hover:text-zen-charcoal font-semibold transition-colors z-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Back to Sign In
      </Link>
      
      <div className="w-full max-w-md bg-white/30 backdrop-blur-md border border-white/20 shadow-xl rounded-3xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-zen-charcoal mb-2">Reset Password</h2>
          <p className="text-zen-charcoal/70">
            Enter your email address and we will send you a link to reset your password.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input 
              type="email" 
              placeholder="Email Address" 
              autoComplete="email" 
              inputMode="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-6 py-4 rounded-full bg-white/50 border border-white/30 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 mt-4 rounded-full bg-zen-charcoal text-zen-base font-bold text-lg hover:bg-zen-charcoal/90 hover:scale-[0.99] transition-all shadow-md disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        
        {error && <p className="mt-4 text-center text-sm font-semibold text-zen-charcoal bg-zen-peach/20 border border-zen-peach/50 p-3 rounded-full">{error}</p>}
        {message && <p className="mt-4 text-center text-sm font-semibold text-zen-charcoal bg-zen-sage/20 border border-zen-sage/50 p-3 rounded-full">{message}</p>}
      </div>
    </div>
  );
}
