'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useExpenseStore } from '@/store/useExpenseStore';
import { updateProfile, updatePassword, getProfile } from '@/app/actions/profile';
import { SupportedCurrency } from '@/types/database';

interface SettingsFormProps {
  userEmail: string;
}

export default function SettingsForm({ userEmail }: SettingsFormProps) {
  const router = useRouter();
  const { profile, hydrate } = useExpenseStore();

  // 1. Profile Form States
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(userEmail);
  const [baseCurrency, setBaseCurrency] = useState<SupportedCurrency>('CAD');
  const [budgetResetDay, setBudgetResetDay] = useState(1);
  const [aiTone, setAiTone] = useState('nurturing');

  // 2. Password Form States
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 3. Notification & Loading States
  const [profileMessage, setProfileMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Sync local state with Zustand profile loaded on mount
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBaseCurrency(profile.base_currency || 'CAD');
      setBudgetResetDay(profile.budget_reset_day || 1);
      setAiTone(profile.ai_tone || 'nurturing');
    }
  }, [profile]);

  // Fetch profile from Supabase if not cached in store yet
  useEffect(() => {
    async function loadProfile() {
      if (!profile) {
        try {
          const response = await getProfile();
          if (response.success && response.data) {
            hydrate({ profile: response.data });
          }
        } catch (err) {
          console.error('[SETTINGS ON-MOUNT PROFILE FETCH FAILURE]:', err);
        }
      }
    }
    loadProfile();
  }, [profile, hydrate]);

  // Handle profile save action
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    setIsSavingProfile(true);

    try {
      const response = await updateProfile({
        display_name: displayName,
        email: email,
        base_currency: baseCurrency,
        budget_reset_day: budgetResetDay,
        ai_tone: aiTone,
      });

      if (response.success) {
        setProfileMessage({ text: response.message || 'Profile updated successfully!', isError: false });
        
        // Hydrate local Zustand store with new saved profile metadata
        if (profile) {
          hydrate({
            profile: {
              ...profile,
              display_name: displayName,
              base_currency: baseCurrency,
              budget_reset_day: budgetResetDay,
              ai_tone: aiTone,
            }
          });
        }
      } else {
        setProfileMessage({ text: response.error || 'Failed to save profile.', isError: true });
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
      setProfileMessage({ text: 'Failed to save profile.', isError: true });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle password save action
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage({ text: 'Password must be at least 6 characters long.', isError: true });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: 'Passwords do not match.', isError: true });
      return;
    }

    setIsSavingPassword(true);
    try {
      const response = await updatePassword(newPassword);

      if (response.success) {
        setPasswordMessage({ text: response.message || 'Password updated successfully!', isError: false });
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMessage({ text: response.error || 'Failed to update password.', isError: true });
      }
    } catch (err) {
      console.error('Failed to save password:', err);
      setPasswordMessage({ text: 'Failed to save password.', isError: true });
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation Link Back to Dashboard */}
      <div className="flex items-center justify-between">
        <Link 
          href="/dashboard" 
          className="flex items-center gap-2 text-zen-charcoal hover:opacity-80 transition-all text-sm font-semibold no-underline cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="text-zen-charcoal font-bold text-xl margin-0">Account Overview</h1>
      </div>

      {/* 1. Profile Settings Form Glassmorphism card */}
      <div className="bg-white/40 backdrop-blur-md border border-white/20 shadow-xl rounded-3xl p-6 text-left">
        <h2 className="text-lg font-bold text-zen-charcoal mb-4">General Details</h2>
        
        {profileMessage && (
          <div className={`p-4 rounded-2xl mb-4 text-sm font-medium border ${
            profileMessage.isError 
              ? 'bg-zen-peach/20 border-zen-peach text-zen-charcoal' 
              : 'bg-zen-sage/20 border-zen-sage text-zen-charcoal'
          }`}>
            {profileMessage.text}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">Display Name</label>
            <input 
              type="text" 
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)} 
              placeholder="Name"
              required
              className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/30 text-base box-border"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="Email"
              required
              className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/30 text-base box-border"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">Base Currency</label>
            <select 
              value={baseCurrency} 
              aria-label="Base Currency"
              onChange={e => setBaseCurrency(e.target.value as any)}
              className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-base appearance-none h-12 box-border cursor-pointer"
            >
              <option value="CAD">CAD (C$)</option>
              <option value="VND">VND (₫)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="GBP">GBP (£)</option>
              <option value="SGD">SGD (S$)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">Budget Reset Day</label>
            <select 
              value={budgetResetDay} 
              aria-label="Budget Reset Day"
              onChange={e => setBudgetResetDay(parseInt(e.target.value, 10))}
              className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-base appearance-none h-12 box-border cursor-pointer"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>Day {day} of the month</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">AI Coach Persona Tone</label>
            <select 
              value={aiTone} 
              aria-label="AI Coach Tone"
              onChange={e => setAiTone(e.target.value)}
              className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-base appearance-none h-12 box-border cursor-pointer"
            >
              <option value="nurturing">Nurturing & Encouraging Coach 🌟</option>
              <option value="strict">Strict & Disciplined Accountant 📊</option>
              <option value="humorous">Humorous & Sarcastic Companion 🎭</option>
            </select>
          </div>

          <button 
            type="submit" 
            disabled={isSavingProfile}
            className="w-full py-4 mt-2 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-lg cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingProfile ? 'Saving...' : 'Save Overview'}
          </button>
        </form>
      </div>

      {/* 2. Security Password Reset Form Glassmorphism card */}
      <div className="bg-white/40 backdrop-blur-md border border-white/20 shadow-xl rounded-3xl p-6 text-left">
        <h2 className="text-lg font-bold text-zen-charcoal mb-4">Security & Password</h2>

        {passwordMessage && (
          <div className={`p-4 rounded-2xl mb-4 text-sm font-medium border ${
            passwordMessage.isError 
              ? 'bg-zen-peach/20 border-zen-peach text-zen-charcoal' 
              : 'bg-zen-sage/20 border-zen-sage text-zen-charcoal'
          }`}>
            {passwordMessage.text}
          </div>
        )}

        <form onSubmit={handleSavePassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">New Password</label>
            <input 
              type="password" 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              placeholder="At least 6 characters"
              className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/30 text-base box-border"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">Confirm Password</label>
            <input 
              type="password" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              placeholder="Repeat new password"
              className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/30 text-base box-border"
            />
          </div>

          <button 
            type="submit" 
            disabled={isSavingPassword}
            className="w-full py-4 mt-2 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-lg cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
