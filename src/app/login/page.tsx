'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

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
      else router.push('/');
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
    <div className="auth-overlay" id="auth-screen">
      <div className="auth-card">
        <h2>{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
        <p>
          {isSignUp ? 'Sign up to start tracking your expenses.' : 'Please sign in to manage your expenses.'}
        </p>
        
        <form onSubmit={handleAuth}>
          <div className="input-group">
            <input 
              type="email" 
              placeholder="Email Address" 
              autoComplete="email" 
              inputMode="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div className="input-group password-group">
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              autoComplete={isSignUp ? "new-password" : "current-password"} 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button 
              type="button" 
              className="toggle-password" 
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {isSignUp && (
            <div className="input-group password-group">
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                placeholder="Confirm Password" 
                autoComplete="new-password" 
                required 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button 
                type="button" 
                className="toggle-password" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          )}

          {!isSignUp && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', fontSize: '0.9em' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'var(--text)' }}>
                <input type="checkbox" id="remember-me" defaultChecked style={{ width: 'auto', margin: '0 5px 0 0', accentColor: 'var(--accent)' }} /> Remember me
              </label>
              <a href="#" onClick={e => e.preventDefault()} style={{ color: 'var(--accent)', textDecoration: 'none' }}>Forgot Password?</a>
            </div>
          )}

          <div className="auth-buttons">
            <button type="submit" style={{ width: '100%' }}>
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </div>
        </form>

        <p style={{ marginTop: '15px', fontSize: '0.9em', textAlign: 'center' }}>
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <a 
            href={isSignUp ? '#toggle-to-signin' : '#toggle-to-signup'} 
            onClick={(e) => handleHashToggle(e, !isSignUp)} 
            style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 'bold' }}
          >
            {isSignUp ? 'Sign in here' : 'Sign up here'}
          </a>
        </p>
        
        {error && <p className="auth-message" style={{ color: 'var(--danger)' }}>{error}</p>}
        {message && <p className="auth-message" style={{ color: 'green' }}>{message}</p>}
      </div>
    </div>
  );
}
