'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useExpenseStore } from '@/store/useExpenseStore';
import { updateProfile, updateEmail, updatePassword, getProfile } from '@/app/actions/profile';
import { SupportedCurrency } from '@/types/database';

interface SettingsFormProps {
  userEmail: string;
}

export default function SettingsForm({ userEmail }: SettingsFormProps) {
  const { profile, hydrate } = useExpenseStore();

  // 1. Edit Toggle States (Accidental Changes Prevention)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);

  // 2. Profile Form States
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(userEmail);
  const [baseCurrency, setBaseCurrency] = useState<SupportedCurrency>('CAD');
  const [budgetResetDay, setBudgetResetDay] = useState(1);
  // Keep aiTone backend state for seamless under-the-hood syncing!
  const [aiTone, setAiTone] = useState('nurturing');

  // 3. Password Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 4. Notification & Loading States
  const [profileMessage, setProfileMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [emailMessage, setEmailMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
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

  // Cancel edits and restore cached states
  const handleCancelProfileEdit = () => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBaseCurrency(profile.base_currency || 'CAD');
      setBudgetResetDay(profile.budget_reset_day || 1);
      setAiTone(profile.ai_tone || 'nurturing');
    }
    setProfileMessage(null);
    setIsEditingProfile(false);
  };

  const handleCancelEmailEdit = () => {
    setEmail(userEmail);
    setEmailMessage(null);
    setIsEditingEmail(false);
  };

  const handleCancelPasswordEdit = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage(null);
    setIsEditingPassword(false);
  };

  // Save General Details Metadata
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    setIsSavingProfile(true);

    try {
      const response = await updateProfile({
        display_name: displayName,
        base_currency: baseCurrency,
        budget_reset_day: budgetResetDay,
        ai_tone: aiTone, // Saved under the hood!
      });

      if (response.success) {
        setProfileMessage({ text: response.message || 'General details updated!', isError: false });
        setIsEditingProfile(false); // Lock inputs back
        
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
        setProfileMessage({ text: response.error || 'Failed to save details.', isError: true });
      }
    } catch (err) {
      console.error('Failed to save details:', err);
      setProfileMessage({ text: 'Failed to save details.', isError: true });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Save Email address with RLS validation loop
  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMessage(null);
    setIsSavingEmail(true);

    try {
      const response = await updateEmail(email);

      if (response.success) {
        setEmailMessage({ text: response.message || 'Verification email requested!', isError: false });
        setIsEditingEmail(false); // Lock input back
      } else {
        setEmailMessage({ text: response.error || 'Failed to update email.', isError: true });
      }
    } catch (err) {
      console.error('Failed to update email:', err);
      setEmailMessage({ text: 'Failed to request email change.', isError: true });
    } finally {
      setIsSavingEmail(false);
    }
  };

  // Save New Password with secure credentials re-auth check
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordMessage({ text: 'Please enter your current password.', isError: true });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage({ text: 'New password must be at least 6 characters.', isError: true });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: 'New passwords do not match.', isError: true });
      return;
    }

    setIsSavingPassword(true);
    try {
      const response = await updatePassword({
        currentPassword,
        newPassword,
      });

      if (response.success) {
        setPasswordMessage({ text: response.message || 'Password updated successfully!', isError: false });
        handleCancelPasswordEdit(); // Lock and clear
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
      {/* Back Navigation link to App Route Dashboard */}
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

      {/* CARD 1: General Details (Read-Only Locked by Default) */}
      <div className="bg-white/40 backdrop-blur-md border border-white/20 shadow-xl rounded-3xl p-6 text-left relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-zen-charcoal my-0">General Details</h2>
          
          {/* Edit Toggler Pencil Icon */}
          {!isEditingProfile ? (
            <button 
              id="edit-profile-btn"
              aria-label="Edit Profile"
              onClick={() => setIsEditingProfile(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-zen-lavender/40 bg-white/60 hover:bg-white/80 text-zen-charcoal font-semibold text-xs cursor-pointer transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Edit</span>
            </button>
          ) : (
            <button 
              onClick={handleCancelProfileEdit}
              className="px-3 py-1.5 rounded-full border border-zen-peach bg-white/60 hover:bg-zen-peach/20 text-zen-charcoal font-semibold text-xs cursor-pointer transition-all"
            >
              Cancel
            </button>
          )}
        </div>
        
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
              disabled={!isEditingProfile}
              onChange={e => setDisplayName(e.target.value)} 
              placeholder="Name"
              required
              className={`w-full px-4 py-3 rounded-full bg-white/50 border focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/30 text-base box-border transition-all ${
                !isEditingProfile ? 'border-transparent opacity-75 bg-transparent cursor-default select-none' : 'border-zen-lavender/60'
              }`}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">Base Currency</label>
            <select 
              value={baseCurrency} 
              disabled={!isEditingProfile}
              aria-label="Base Currency"
              onChange={e => setBaseCurrency(e.target.value as any)}
              className={`w-full px-4 py-3 rounded-full bg-white/50 border focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-base appearance-none h-12 box-border transition-all ${
                !isEditingProfile ? 'border-transparent opacity-75 bg-transparent cursor-default pointer-events-none' : 'border-zen-lavender/60 cursor-pointer'
              }`}
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
              disabled={!isEditingProfile}
              aria-label="Budget Reset Day"
              onChange={e => setBudgetResetDay(parseInt(e.target.value, 10))}
              className={`w-full px-4 py-3 rounded-full bg-white/50 border focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal text-base appearance-none h-12 box-border transition-all ${
                !isEditingProfile ? 'border-transparent opacity-75 bg-transparent cursor-default pointer-events-none' : 'border-zen-lavender/60 cursor-pointer'
              }`}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>Day {day} of the month</option>
              ))}
            </select>
          </div>

          {/* NOTE: AI Coach Persona Tone setting remains fully active on the backend, but is completely hidden from the end-user UI here */}

          {/* Submit button only displays when editing is active! */}
          {isEditingProfile && (
            <button 
              type="submit" 
              disabled={isSavingProfile}
              className="w-full py-4 mt-2 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-lg cursor-pointer border-none disabled:opacity-50"
            >
              {isSavingProfile ? 'Saving...' : 'Save Details'}
            </button>
          )}
        </form>
      </div>

      {/* CARD 2: Email Address Card (Split Section) */}
      <div className="bg-white/40 backdrop-blur-md border border-white/20 shadow-xl rounded-3xl p-6 text-left relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-zen-charcoal my-0">Email Address Settings</h2>
          
          {!isEditingEmail ? (
            <button 
              id="edit-email-btn"
              aria-label="Edit Email"
              onClick={() => setIsEditingEmail(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-zen-lavender/40 bg-white/60 hover:bg-white/80 text-zen-charcoal font-semibold text-xs cursor-pointer transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Change</span>
            </button>
          ) : (
            <button 
              onClick={handleCancelEmailEdit}
              className="px-3 py-1.5 rounded-full border border-zen-peach bg-white/60 hover:bg-zen-peach/20 text-zen-charcoal font-semibold text-xs cursor-pointer transition-all"
            >
              Cancel
            </button>
          )}
        </div>

        {emailMessage && (
          <div className={`p-4 rounded-2xl mb-4 text-sm font-medium border ${
            emailMessage.isError 
              ? 'bg-zen-peach/20 border-zen-peach text-zen-charcoal' 
              : 'bg-zen-sage/20 border-zen-sage text-zen-charcoal'
          }`}>
            {emailMessage.text}
          </div>
        )}

        <form onSubmit={handleSaveEmail} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">Current / New Email</label>
            <input 
              type="email" 
              value={email} 
              disabled={!isEditingEmail}
              onChange={e => setEmail(e.target.value)} 
              placeholder="Email"
              required
              className={`w-full px-4 py-3 rounded-full bg-white/50 border focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/30 text-base box-border transition-all ${
                !isEditingEmail ? 'border-transparent opacity-75 bg-transparent cursor-default select-none' : 'border-zen-lavender/60'
              }`}
            />
            {isEditingEmail && (
              <p className="text-xs text-zen-charcoal/50 ml-2 mt-1 leading-relaxed">
                ℹ️ Changing your email requires clicking the verification links sent to both your old and new email addresses. Your profile settings will update once fully verified.
              </p>
            )}
          </div>

          {isEditingEmail && (
            <button 
              type="submit" 
              disabled={isSavingEmail}
              className="w-full py-4 mt-2 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-lg cursor-pointer border-none disabled:opacity-50"
            >
              {isSavingEmail ? 'Saving...' : 'Update Email'}
            </button>
          )}
        </form>
      </div>

      {/* CARD 3: Security Password card (Collapsible by Default) */}
      <div className="bg-white/40 backdrop-blur-md border border-white/20 shadow-xl rounded-3xl p-6 text-left">
        <h2 className="text-lg font-bold text-zen-charcoal mb-4 mt-0">Security & Password</h2>

        {passwordMessage && (
          <div className={`p-4 rounded-2xl mb-4 text-sm font-medium border ${
            passwordMessage.isError 
              ? 'bg-zen-peach/20 border-zen-peach text-zen-charcoal' 
              : 'bg-zen-sage/20 border-zen-sage text-zen-charcoal'
          }`}>
            {passwordMessage.text}
          </div>
        )}

        {/* Collapsible Trigger: show button when closed, reveal re-auth form when active */}
        {!isEditingPassword ? (
          <button 
            id="change-password-btn"
            onClick={() => setIsEditingPassword(true)}
            className="w-full py-4 bg-white/60 border border-zen-lavender/40 hover:bg-white/80 text-zen-charcoal rounded-full font-bold text-base cursor-pointer transition-all"
          >
            🔐 Change Account Password
          </button>
        ) : (
          <form onSubmit={handleSavePassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">Current Password</label>
              <input 
                type="password" 
                value={currentPassword} 
                onChange={e => setCurrentPassword(e.target.value)} 
                placeholder="Verify current password"
                required
                className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/30 text-base box-border"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">New Password</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                placeholder="At least 6 characters"
                required
                className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/30 text-base box-border"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">Confirm New Password</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                placeholder="Repeat new password"
                required
                className="w-full px-4 py-3 rounded-full bg-white/50 border border-zen-lavender/60 focus:outline-none focus:ring-2 focus:ring-zen-sage text-zen-charcoal placeholder-zen-charcoal/30 text-base box-border"
              />
            </div>

            <div className="flex gap-3 mt-2">
              <button 
                type="button"
                onClick={handleCancelPasswordEdit}
                className="flex-1 py-4 border border-zen-lavender/40 hover:bg-white/80 text-zen-charcoal rounded-full font-bold text-base cursor-pointer transition-all bg-transparent"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSavingPassword}
                className="flex-1 py-4 bg-zen-charcoal text-zen-base rounded-full font-bold hover:bg-zen-charcoal/90 transition-all text-base cursor-pointer border-none disabled:opacity-50"
              >
                {isSavingPassword ? 'Updating...' : 'Save Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
