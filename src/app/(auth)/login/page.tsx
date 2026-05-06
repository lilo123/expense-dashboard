'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Handle URL hash on load for deep linking
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#toggle-to-signup') {
      setIsSignUp(true);
    } else if (hash === '#toggle-to-signin') {
      setIsSignUp(false);
    }
  }, []);

  const handleHashToggle = (e: React.MouseEvent<HTMLAnchorElement>, toSignUp: boolean) => {
    e.preventDefault();
    setIsSignUp(toSignUp);
    setError(null);
    setMessage(null);
    window.history.pushState(null, '', toSignUp ? '#toggle-to-signup' : '#toggle-to-signin');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (isSignUp) {
      if (password !== confirmPassword) {
        setError("Passwords don't match");
        return;
      }
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage('Check your email for the confirmation link.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else window.location.href = '/dashboard';
    }
  };

  const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  );

  const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" id="auth-screen">
      <Link 
        href="/" 
        className="absolute top-6 left-6 flex items-center gap-2 text-zen-charcoal/60 hover:text-zen-charcoal font-semibold transition-colors z-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Back to Home
      </Link>
      <div className="w-full max-w-md bg-white/40 backdrop-blur-md border border-white/20 shadow-xl rounded-3xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-zen-charcoal mb-2">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-zen-charcoal/70">
            {isSignUp ? 'Sign up to start tracking your expenses.' : 'Please sign in to manage your expenses.'}
          </p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div className="relative">
            <input 
              type="email" 
              placeholder="Email Address" 
              autoComplete="email" 
              inputMode="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-4 rounded-xl bg-white/50 border border-white/30 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50"
            />
          </div>
          
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              autoComplete={isSignUp ? "new-password" : "current-password"} 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 rounded-xl bg-white/50 border border-white/30 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50"
            />
            <button 
              type="button" 
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zen-charcoal/60 hover:text-zen-charcoal transition-colors"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {isSignUp && (
            <div className="relative">
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                placeholder="Confirm Password" 
                autoComplete="new-password" 
                required 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-white/50 border border-white/30 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/50"
              />
              <button 
                type="button" 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zen-charcoal/60 hover:text-zen-charcoal transition-colors"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          )}

          {!isSignUp && (
            <div className="flex justify-between items-center text-sm px-1">
              <label className="flex items-center cursor-pointer text-zen-charcoal/80">
                <input type="checkbox" id="remember-me" defaultChecked className="mr-2 accent-zen-sage" /> 
                Remember me
              </label>
              <a href="#" onClick={e => e.preventDefault()} className="text-zen-charcoal font-semibold hover:underline">
                Forgot Password?
              </a>
            </div>
          )}

          <button 
            type="submit" 
            className="w-full py-4 mt-4 rounded-xl bg-zen-charcoal text-zen-base font-bold text-lg hover:bg-zen-charcoal/90 hover:scale-[0.99] transition-all shadow-md"
          >
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zen-charcoal/80">
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <a 
            href={isSignUp ? '#toggle-to-signin' : '#toggle-to-signup'} 
            onClick={(e) => handleHashToggle(e, !isSignUp)} 
            className="text-zen-charcoal font-bold hover:underline"
          >
            {isSignUp ? 'Sign in here' : 'Sign up here'}
          </a>
        </p>
        
        {error && <p className="mt-4 text-center text-sm font-semibold text-red-500 bg-red-50/50 p-2 rounded-lg">{error}</p>}
        {message && <p className="mt-4 text-center text-sm font-semibold text-green-600 bg-green-50/50 p-2 rounded-lg">{message}</p>}
      </div>
    </div>
  );
}
