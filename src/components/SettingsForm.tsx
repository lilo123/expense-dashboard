'use client';

import { useState, useEffect, memo } from 'react';
import Link from 'next/link';
import { useExpenseStore } from '@/store/useExpenseStore';
import { updateProfile, updateEmail, updatePassword, getProfile } from '@/app/actions/profile';
import { syncExchangeRates } from '@/app/actions/rates';
import { purgeUserAccount } from '@/app/actions/compliance';
import { SupportedCurrency, Profile } from '@/types/database';
import { Info, Lock, ArrowLeft, Edit3 } from 'lucide-react';
import CategoryManager from './CategoryManager';

interface SettingsFormProps {
  userEmail: string;
}

function SettingsForm({ userEmail }: SettingsFormProps) {
  const profile = useExpenseStore(state => state.profile);
  const hydrate = useExpenseStore(state => state.hydrate);
  const displayCurrency = useExpenseStore(state => state.displayCurrency);
  const setDisplayCurrency = useExpenseStore(state => state.setDisplayCurrency);
  const setExchangeRates = useExpenseStore(state => state.setExchangeRates);

  // 1. Edit Toggle States (Accidental Changes Prevention)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);

  // 2. Profile Form States
  const [prevProfile, setPrevProfile] = useState<Profile | null>(null);
  const [prevDisplayCurrency, setPrevDisplayCurrency] = useState<SupportedCurrency | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(userEmail);
  const [baseCurrency, setBaseCurrency] = useState<SupportedCurrency>('CAD');
  const [budgetResetDay, setBudgetResetDay] = useState(1);
  const [tempDisplayCurrency, setTempDisplayCurrency] = useState<SupportedCurrency>('CAD');

  // Synchronously adjust state during render when profile or display currency updates to satisfy set-state-in-effect rules
  if (profile !== prevProfile) {
    setPrevProfile(profile);
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBaseCurrency(profile.base_currency || 'CAD');
      setBudgetResetDay(profile.budget_reset_day || 1);
    }
  }

  if (displayCurrency !== prevDisplayCurrency) {
    setPrevDisplayCurrency(displayCurrency);
    if (displayCurrency) {
      setTempDisplayCurrency(displayCurrency);
    }
  }

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
    }
    setTempDisplayCurrency(displayCurrency);
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

    const isBaseCurrencyChanged = profile && baseCurrency !== profile.base_currency;

    try {
      const response = await updateProfile({
        display_name: displayName,
        base_currency: baseCurrency,
        display_currency: tempDisplayCurrency,
        budget_reset_day: budgetResetDay,
      });

      if (response.success) {
        setDisplayCurrency(tempDisplayCurrency);
        setProfileMessage({ text: response.message || 'General details updated!', isError: false });
        setIsEditingProfile(false); // Lock inputs back
        
        if (profile) {
          hydrate({
            profile: {
              ...profile,
              display_name: displayName,
              base_currency: baseCurrency,
              display_currency: tempDisplayCurrency,
              budget_reset_day: budgetResetDay,
            }
          });
        }

        // Dynamically update exchange rates immediately if base currency changed
        if (isBaseCurrencyChanged) {
          try {
            const rates = await syncExchangeRates();
            setExchangeRates(rates);
            console.log('[SETTINGS SYNCHRONIZATION]: Exchange rates successfully synchronized to new base currency:', baseCurrency);
          } catch (rateErr) {
            console.error('[SETTINGS FX SYNC FAILURE]: Failed to sync exchange rates after base currency change:', rateErr);
          }
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

  // 5. Compliance & Privacy States
  const [isExporting, setIsExporting] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [complianceMessage, setComplianceMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleExportData = async () => {
    setIsExporting(true);
    setComplianceMessage(null);
    try {
      const response = await fetch('/api/compliance/export');
      if (!response.ok) {
        throw new Error('Failed to export data');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers.get('content-disposition');
      let filename = 'anyen-data-export.json';
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) { 
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setComplianceMessage({ text: 'Data exported successfully!', isError: false });
    } catch (err) {
      console.error('[EXPORT DATA FAILED]:', err);
      setComplianceMessage({ text: 'Failed to export data. Please try again.', isError: true });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePurgeAccount = async () => {
    setIsPurging(true);
    setComplianceMessage(null);
    try {
      const response = await purgeUserAccount();
      if (response.success) {
        setComplianceMessage({ text: 'Account and data purged successfully. Redirecting...', isError: false });
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        setComplianceMessage({ text: response.error || 'Failed to purge account.', isError: true });
        setIsPurging(false);
      }
    } catch (err) {
      console.error('[PURGE ACCOUNT FAILED]:', err);
      setComplianceMessage({ text: 'An unexpected error occurred while purging data.', isError: true });
      setIsPurging(false);
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
          <ArrowLeft size={16} />
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
              <Edit3 size={14} />
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
            <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">Base Currency (to record expense)</label>
            <select 
              value={baseCurrency} 
              disabled={!isEditingProfile}
              aria-label="Base Currency"
              onChange={e => setBaseCurrency(e.target.value as SupportedCurrency)}
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
            <label className="text-xs text-zen-charcoal/60 font-semibold ml-1">Display Currency</label>
            <select 
              value={tempDisplayCurrency} 
              disabled={!isEditingProfile}
              aria-label="Display Currency"
              onChange={e => setTempDisplayCurrency(e.target.value as SupportedCurrency)}
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
              <Edit3 size={14} />
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
              <p className="text-xs text-zen-charcoal/50 ml-2 mt-1 leading-relaxed flex items-start gap-1.5">
                <Info size={16} className="text-zen-charcoal/50 shrink-0" />
                <span>Changing your email requires clicking the verification links sent to both your old and new email addresses. Your profile settings will update once fully verified.</span>
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
            className="w-full py-4 bg-white/60 border border-zen-lavender/40 hover:bg-white/80 text-zen-charcoal rounded-full font-bold text-base cursor-pointer transition-all flex items-center justify-center gap-2"
          >
            <Lock size={16} /> Change Account Password
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

      {/* CARD 4: Compliance & Data Privacy */}
      <div className="bg-white/40 backdrop-blur-md border border-white/20 shadow-xl rounded-3xl p-6 text-left">
        <h2 className="text-lg font-bold text-zen-charcoal mb-4 mt-0">Data Privacy & Compliance</h2>
        
        {complianceMessage && (
          <div className={`p-4 rounded-2xl mb-4 text-sm font-medium border ${
            complianceMessage.isError 
              ? 'bg-zen-peach/20 border-zen-peach text-zen-charcoal' 
              : 'bg-zen-sage/20 border-zen-sage text-zen-charcoal'
          }`}>
            {complianceMessage.text}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {/* Export Data Button */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-zen-charcoal my-0">Export Financial Data</h3>
            <p className="text-xs text-zen-charcoal/60 margin-0 leading-relaxed">
              Download a copy of all your personal profiles, expenses, budgets, and recurring transactions in a structured JSON format (CCPA Right to Access).
            </p>
            <button 
              onClick={handleExportData}
              disabled={isExporting}
              className="w-full py-4 bg-white/60 border border-zen-lavender/40 hover:bg-white/80 text-zen-charcoal rounded-full font-bold text-base cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isExporting ? 'Exporting...' : 'Export All My Financial Data'}
            </button>
          </div>

          <hr className="border-t border-zen-lavender/20 my-2" />

          {/* Purge Account / Delete Data Button */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-zen-peach my-0">Delete Account & Purge Data</h3>
            <p className="text-xs text-zen-charcoal/60 margin-0 leading-relaxed">
              Permanently erase your account, profiles, invite logs, and financial transactions from our servers. This action is irreversible (CCPA Right to Delete).
            </p>

            {!showPurgeConfirm ? (
              <button 
                onClick={() => setShowPurgeConfirm(true)}
                className="w-full py-4 bg-zen-peach/10 border border-zen-peach hover:bg-zen-peach/20 text-zen-charcoal rounded-full font-bold text-base cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                Delete Account & Purge My Data
              </button>
            ) : (
              <div className="flex flex-col gap-3 p-4 rounded-2xl bg-zen-peach/15 border border-zen-peach/30 mt-1">
                <p className="text-xs font-bold text-zen-charcoal margin-0">
                  ⚠️ Are you absolutely sure? This will permanently wipe all your data and can NOT be undone.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowPurgeConfirm(false)}
                    className="flex-1 py-3 border border-zen-lavender/40 hover:bg-white/80 text-zen-charcoal rounded-full font-bold text-sm cursor-pointer transition-all bg-transparent"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handlePurgeAccount}
                    disabled={isPurging}
                    className="flex-1 py-3 bg-zen-peach text-white rounded-full font-bold text-sm hover:bg-zen-peach/90 transition-all cursor-pointer border-none disabled:opacity-50"
                  >
                    {isPurging ? 'Purging...' : 'Yes, Purge My Account'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Management Card */}
      <CategoryManager />
    </div>
  );
}

export default memo(SettingsForm);
