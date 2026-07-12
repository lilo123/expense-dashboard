'use client';

import { useState, useEffect, useRef } from 'react';
import { InviteRequest, EmailTemplate, Profile } from '@/types/database';
import { updateInviteStatusAction, updateEmailTemplateAction, updateUserTierAction } from '@/app/actions/admin';
import { Check, X, Clock, AlertCircle, ShieldCheck, UserCheck, Copy, Save, Eye, Edit, Loader2 } from 'lucide-react';

interface AdminDashboardViewProps {
  initialInvites: InviteRequest[];
  initialProfiles: Profile[];
  initialEmailTemplate?: EmailTemplate;
  initialError?: string | null;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'claimed' | 'rejected';
type ViewMode = 'requests' | 'template' | 'users';

export default function AdminDashboardView({ initialInvites, initialProfiles, initialEmailTemplate, initialError }: AdminDashboardViewProps) {
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [loadingTierIds, setLoadingTierIds] = useState<Set<string>>(new Set());
  const [optimisticTiers, setOptimisticTiers] = useState<Record<string, 'standard' | 'premium'>>({});
  const [error, setError] = useState<string | null>(initialError || null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // Decoupled View Modes
  const [viewMode, setViewMode] = useState<ViewMode>('requests');
  const [activeTab, setActiveTab] = useState<FilterStatus>('all');
  const [copiedGlobal, setCopiedGlobal] = useState(false);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Template Studio States
  const [subject, setSubject] = useState(initialEmailTemplate?.subject || 'Welcome to An-yen — Your Private Early Adopter Access');
  const [htmlBody, setHtmlBody] = useState(initialEmailTemplate?.html_body || '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; color: #1c1917;">\n  <h1 style="color: #1c1917; font-size: 24px; font-weight: bold;">Your Private Access Granted</h1>\n  <p style="font-size: 16px; line-height: 1.5; color: #444;">\n    Thank you for sharing your motivation with us. We are incredibly thrilled to welcome you into the An-yen early adopter cohort!\n  </p>\n  <div style="margin: 30px 0;">\n    <a href="https://an-yen.com/login?secret=flow-vip#toggle-to-signup" \n       style="background-color: #1c1917; color: #fbf9f4; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block;">\n      Access An-yen Platform\n    </a>\n  </div>\n  <p style="font-size: 13px; color: #888;">\n    Please note: This access URL is protected. Our backend verifies your exact email address prior to profile creation.\n  </p>\n</div>');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateSuccess, setTemplateSuccess] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => { 
     
    setIsMounted(true); 
    return () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current); };
  }, []);

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setLoadingIds(prev => new Set(prev).add(id));
    setError(null); setSuccessMsg(null);
    try {
      const res = await updateInviteStatusAction(id, status);
      if (res.success && res.data) {
        setSuccessMsg(`Invitation successfully ${status}.`);
      } else setError(res.error || 'Failed to update status.');
    } catch (err: unknown) { 
      setError(err instanceof Error ? err.message : 'Error communicating with server.'); 
    } finally { 
      setLoadingIds(prev => { const next = new Set(prev); next.delete(id); return next; }); 
    }
  };

  const handleUpdateUserTier = async (id: string, tier: 'standard' | 'premium', currentActiveTier: 'standard' | 'premium') => {
    setLoadingTierIds(prev => new Set(prev).add(id));
    setOptimisticTiers(prev => ({ ...prev, [id]: tier }));
    setError(null); setSuccessMsg(null);
    try {
      const res = await updateUserTierAction(id, tier);
      if (res.success && res.data && res.data.tier) {
        setSuccessMsg(`User tier successfully updated to ${tier.toUpperCase()}.`);
        const confirmedTier = res.data.tier;
        setOptimisticTiers(prev => ({ ...prev, [id]: confirmedTier }));
      } else {
        setError(res.error || 'Failed to update user tier.');
        // Revert cleanly to confirmed preceding state
        setOptimisticTiers(prev => ({ ...prev, [id]: currentActiveTier }));
      }
    } catch (err: unknown) { 
      setError(err instanceof Error ? err.message : 'Error communicating with server.'); 
      setOptimisticTiers(prev => ({ ...prev, [id]: currentActiveTier }));
    } finally { 
      setLoadingTierIds(prev => { const next = new Set(prev); next.delete(id); return next; }); 
    }
  };

  const handleCopyGlobalVipLink = async () => {
    setError(null); setSuccessMsg(null);
    const url = `${window.location.origin}/login?secret=flow-vip#toggle-to-signup`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedGlobal(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => { setCopiedGlobal(false); copyTimeoutRef.current = null; }, 2000);
    } catch (err: unknown) { 
      console.error('Clipboard access denied:', err);
      setError('Failed to copy invite link to clipboard. Check browser permissions.'); 
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTemplate(true); setTemplateError(null); setTemplateSuccess(null);
    try {
      const res = await updateEmailTemplateAction(subject, htmlBody);
      if (res.success && res.data) {
        setSubject(res.data.subject);
        setHtmlBody(res.data.html_body);
        setTemplateSuccess('Email template saved successfully! Incoming approved users will receive this copy.');
      } else setTemplateError(res.error || 'Failed to save email template.');
    } catch {
      setTemplateError('Error updating template.');
    } finally { setIsSavingTemplate(false); }
  };

  const filteredInvites = initialInvites.filter(inv => activeTab === 'all' ? true : inv.status === activeTab);
  const countByStatus = (status: FilterStatus) => initialInvites.filter(inv => status === 'all' ? true : inv.status === status).length;

  const tabs: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'claimed', label: 'Claimed' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="bg-white/40 backdrop-blur-md border border-white/20 shadow-lg rounded-2xl p-6 flex flex-col gap-5">
      {/* Dismissible Action Alerts - Hides completely when empty to avoid whitespace void */}
      {error || successMsg ? (
        <div className="flex flex-col gap-3">
          {error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-xl flex items-center justify-between gap-3 text-xs font-bold shadow-sm" role="alert">
              <div className="flex items-center gap-3"><AlertCircle size={16} className="shrink-0" /><span>{error}</span></div>
              <button onClick={() => setError(null)} aria-label="Dismiss alert" className="p-1 hover:bg-red-200 rounded-lg text-red-700 cursor-pointer"><X size={14} /></button>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl flex items-center justify-between gap-3 text-xs font-bold shadow-sm" role="status">
              <div className="flex items-center gap-3"><ShieldCheck size={16} className="shrink-0" /><span>{successMsg}</span></div>
              <button onClick={() => setSuccessMsg(null)} aria-label="Dismiss success message" className="p-1 hover:bg-emerald-200 rounded-lg text-emerald-700 cursor-pointer"><X size={14} /></button>
            </div>
          )}
        </div>
      ) : null}

      {/* Dedicated Top Title Bar & View Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
        <h2 className="text-lg font-bold text-zen-charcoal">
          {viewMode === 'requests' ? 'Invitation Requests' : viewMode === 'users' ? 'User Tier Control' : 'Automated Email Studio'}
        </h2>
        {/* Single Consolidated Global Access Link Trigger */}
        <button
          onClick={handleCopyGlobalVipLink}
          aria-label="Copy Global VIP invite link"
          className={`min-w-[190px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm border shrink-0 ${
            copiedGlobal 
              ? 'bg-emerald-100 border-emerald-300 text-emerald-800' 
              : 'bg-white/80 hover:bg-white text-zen-charcoal border-white/40'
          }`}
        >
          {copiedGlobal ? (
            <><Check size={14} className="text-emerald-600 shrink-0" /> Copied Link!</>
          ) : (
            <><Copy size={14} className="shrink-0" /> Copy Global Access URL</>
          )}
        </button>
      </div>

      {/* Navigation & Filtering Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2 pb-4 border-b border-white/30 flex-wrap">
        {/* View Mode Switching - WAI-ARIA tablist mutually exclusive navigation tabs with correct unmounted aria-controls pairing */}
        <div className="flex items-center bg-white/40 p-1 rounded-xl border border-white/30 gap-1 shrink-0" role="tablist" aria-label="Dashboard view navigation">
          <button
            id="tab-view-requests"
            role="tab"
            aria-selected={viewMode === 'requests'}
            aria-controls={viewMode === 'requests' ? 'panel-view-requests' : undefined}
            onClick={() => setViewMode('requests')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'requests' ? 'bg-zen-charcoal text-zen-base shadow-sm' : 'text-zen-charcoal/80 hover:text-zen-charcoal bg-transparent border-none'
            }`}
          >
            Invites ({initialInvites.length})
          </button>
          <button
            id="tab-view-users"
            role="tab"
            aria-selected={viewMode === 'users'}
            aria-controls={viewMode === 'users' ? 'panel-view-users' : undefined}
            onClick={() => setViewMode('users')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'users' ? 'bg-zen-charcoal text-zen-base shadow-sm' : 'text-zen-charcoal/80 hover:text-zen-charcoal bg-transparent border-none'
            }`}
          >
            User Tiers ({initialProfiles.length})
          </button>
          <button
            id="tab-view-template"
            role="tab"
            aria-selected={viewMode === 'template'}
            aria-controls={viewMode === 'template' ? 'panel-view-template' : undefined}
            onClick={() => setViewMode('template')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'template' ? 'bg-zen-charcoal text-zen-base shadow-sm' : 'text-zen-charcoal/80 hover:text-zen-charcoal bg-transparent border-none'
            }`}
          >
            Email Template Studio
          </button>
        </div>

        {/* Scrollbar-Free Glassmorphic Filter Group Deck (Visible in Requests Mode Only) */}
        {viewMode === 'requests' && (
          <div className="flex flex-wrap items-center bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/30 gap-1.5" role="group" aria-label="Filter invitation requests">
            {tabs.map(tab => (
              <button
                key={tab.key}
                id={`filter-${tab.key}`}
                aria-pressed={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                  activeTab === tab.key 
                    ? 'bg-zen-charcoal text-zen-base shadow-sm border-zen-charcoal' 
                    : 'text-zen-charcoal/80 hover:bg-white/60 hover:text-zen-charcoal border-none bg-transparent'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${activeTab === tab.key ? 'bg-zen-base/20 text-zen-base' : 'bg-zen-charcoal/10 text-zen-charcoal'}`}>
                  {countByStatus(tab.key)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dynamic Layout Panels: Mutually exclusive WAI-ARIA tabpanel views */}
      {viewMode === 'users' ? (
        <div id="panel-view-users" role="tabpanel" aria-labelledby="tab-view-users" tabIndex={0} className="bg-white/20 border border-white/30 rounded-2xl divide-y divide-white/20 overflow-y-auto overflow-x-auto max-h-[500px] scrollbar-thin shadow-inner focus:outline-none focus:ring-1 focus:ring-zen-charcoal/20">
          {initialProfiles.length === 0 ? (
            <div className="text-center py-10 text-zen-charcoal/80 bg-white/10 backdrop-blur-sm">
              <p className="font-bold text-sm">No registered user profiles found.</p>
              <p className="text-xs mt-1 text-zen-charcoal/60">Verified user accounts will populate here.</p>
            </div>
          ) : (
            <div className="w-full">
              {initialProfiles.map((profile) => {
                const effectiveTier = optimisticTiers[profile.id] || profile.tier || 'standard';
                const isLoading = loadingTierIds.has(profile.id);
                return (
                  <div 
                    key={profile.id} 
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 hover:bg-white/40 transition-all gap-4 text-sm border-b border-white/10 last:border-none"
                  >
                    {/* Account Information */}
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <span className="font-bold text-sm text-zen-charcoal break-words whitespace-normal">
                        {profile.email || 'No Email'}
                      </span>
                      <span className="text-xs text-zen-charcoal/70 font-medium">
                        Display Name: {profile.display_name || 'Not configured'}
                      </span>
                      <div className="min-h-[20px]">
                        {isMounted && (
                          <span className="text-[11px] text-zen-charcoal/60 font-medium">
                            Joined: {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Current Tier Status and Interactive Toggle Group */}
                    <div className="flex flex-wrap items-center gap-4 shrink-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${
                        effectiveTier === 'premium'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-white/60 text-zen-charcoal/80 border-white/40'
                      }`}>
                        {effectiveTier === 'premium' ? '★ Premium' : 'Standard'}
                      </span>

                      <div 
                        role="radiogroup" 
                        aria-label="User subscription tier selection" 
                        aria-busy={isLoading}
                        className="flex items-center bg-white/30 backdrop-blur-md p-1 rounded-xl border border-white/30 gap-1 shadow-sm overflow-visible shrink-0 whitespace-nowrap"
                      >
                        <button
                          role="radio"
                          aria-disabled={isLoading}
                          aria-checked={effectiveTier === 'standard'}
                          aria-label={`Set subscription to standard for ${profile.email || 'user'}`}
                          onClick={() => { if (!isLoading && effectiveTier !== 'standard') handleUpdateUserTier(profile.id, 'standard', effectiveTier); }}
                          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer aria-disabled:opacity-50 whitespace-nowrap shrink-0 ${
                            effectiveTier === 'standard'
                              ? 'bg-white/80 text-zen-charcoal shadow-sm border border-white/50 cursor-default'
                              : 'text-zen-charcoal/80 hover:text-zen-charcoal hover:bg-white/40 border border-transparent'
                          }`}
                        >
                          {isLoading && effectiveTier === 'standard' ? <Loader2 size={12} className="animate-spin shrink-0" /> : null}
                          Standard
                        </button>
                        <button
                          role="radio"
                          aria-disabled={isLoading}
                          aria-checked={effectiveTier === 'premium'}
                          aria-label={`Set subscription to premium for ${profile.email || 'user'}`}
                          onClick={() => { if (!isLoading && effectiveTier !== 'premium') handleUpdateUserTier(profile.id, 'premium', effectiveTier); }}
                          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer aria-disabled:opacity-50 whitespace-nowrap shrink-0 ${
                            effectiveTier === 'premium'
                              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md border border-amber-400 cursor-default'
                              : 'bg-transparent text-zen-charcoal/80 hover:text-zen-charcoal hover:bg-amber-500/10 border border-transparent'
                          }`}
                        >
                          {isLoading && effectiveTier === 'premium' ? <Loader2 size={12} className="animate-spin shrink-0" /> : null}
                          ★ Premium
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : viewMode === 'template' ? (
        <form id="panel-view-template" role="tabpanel" aria-labelledby="tab-view-template" tabIndex={0} onSubmit={handleSaveTemplate} className="bg-white/60 border border-white/30 rounded-2xl p-6 shadow-inner flex flex-col gap-6 focus:outline-none focus:ring-1 focus:ring-zen-charcoal/20">
          <div className="flex items-center justify-between border-b border-white/30 pb-4 flex-wrap gap-4">
            <div>
              <h3 className="text-base font-bold text-zen-charcoal">Resend Automated Invitation Email Copy</h3>
              <p className="text-xs text-zen-charcoal/80">Design custom HTML markup and subjects for onboarding approved members.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className="px-3 py-2 bg-white/80 hover:bg-white text-zen-charcoal font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 border border-white/40 shadow-sm cursor-pointer"
              >
                {previewMode ? <><Edit size={14} /> Edit Code</> : <><Eye size={14} /> Preview Layout</>}
              </button>
              <button
                type="submit"
                disabled={isSavingTemplate || previewMode}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <Save size={14} /> {isSavingTemplate ? 'Saving...' : 'Update Template'}
              </button>
            </div>
          </div>

          {/* Form Studio Notifications */}
          {templateError || templateSuccess ? (
            <div className="flex flex-col gap-2">
              {templateError && <div className="p-3 bg-red-100 text-red-800 text-xs font-bold rounded-xl">{templateError}</div>}
              {templateSuccess && <div className="p-3 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl">{templateSuccess}</div>}
            </div>
          ) : null}

          {/* Sandboxed Opaque Iframe Preview Mode vs Raw DOM Editor */}
          {previewMode ? (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-white/80 border border-white/40 rounded-xl text-sm font-bold text-zen-charcoal">
                Subject: {subject}
              </div>
              <div className="border border-white/40 rounded-xl bg-white overflow-hidden shadow-inner">
                <iframe sandbox="" srcDoc={htmlBody} title="HTML Mail Preview" className="w-full h-[400px] border-none bg-white" />
              </div>
            </div>
          ) : null}

          {/* Retain Inputs in DOM during preview mode for strict validation */}
          <div className={`flex flex-col gap-4 ${previewMode ? 'hidden' : 'flex'}`}>
            <div>
              <label htmlFor="template-subject" className="block text-xs font-bold text-zen-charcoal uppercase tracking-wider mb-2">Email Subject</label>
              <input
                id="template-subject"
                type="text"
                required
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setTemplateSuccess(null); setTemplateError(null); }}
                className="w-full px-4 py-3 bg-white/80 text-zen-charcoal border border-white/40 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-zen-charcoal/20"
              />
            </div>

            <div>
              <label htmlFor="template-body" className="block text-xs font-bold text-zen-charcoal uppercase tracking-wider mb-2">HTML Mail Template</label>
              <textarea
                id="template-body"
                rows={14}
                required
                value={htmlBody}
                onChange={(e) => { setHtmlBody(e.target.value); setTemplateSuccess(null); setTemplateError(null); }}
                className="w-full p-4 bg-zen-charcoal/95 text-zen-base font-mono text-xs rounded-xl outline-none focus:ring-2 focus:ring-zen-charcoal/40 shadow-inner resize-y leading-relaxed"
              />
            </div>
          </div>
        </form>
      ) : (
        <div id="panel-view-requests" role="tabpanel" aria-labelledby="tab-view-requests" tabIndex={0} className="bg-white/20 border border-white/30 rounded-2xl divide-y divide-white/20 overflow-y-auto overflow-x-auto max-h-[400px] scrollbar-thin shadow-inner focus:outline-none focus:ring-1 focus:ring-zen-charcoal/20">
          {filteredInvites.length === 0 ? (
            <div className="text-center py-10 text-zen-charcoal/80 bg-white/10 backdrop-blur-sm">
              <p className="font-bold text-sm">No {activeTab !== 'all' ? activeTab : 'invitation'} requests found.</p>
              <p className="text-xs mt-1 text-zen-charcoal/60">Incoming access applications will populate in this table.</p>
            </div>
          ) : (
            <div className="min-w-[500px]">
              {filteredInvites.map((invite) => (
                <div 
                  key={invite.id} 
                  className="grid grid-cols-1 md:grid-cols-12 items-start md:items-center justify-between p-4 hover:bg-white/40 transition-all gap-4 text-sm"
                >
                  {/* Column 1: Spacious Email & Status Header */}
                  <div className="md:col-span-4 flex flex-col gap-1.5 min-w-0 w-full">
                    <span className="font-bold text-sm text-zen-charcoal break-words whitespace-normal">{invite.email}</span>
                    <span className={`w-fit px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                      invite.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                      invite.status === 'claimed' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                      invite.status === 'rejected' ? 'bg-red-100 text-red-800 border border-red-300' :
                      'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {invite.status === 'pending' && <Clock size={10} />}
                      {invite.status === 'approved' && <Check size={10} />}
                      {invite.status === 'claimed' && <UserCheck size={10} />}
                      {invite.status === 'rejected' && <X size={10} />}
                      {invite.status}
                    </span>
                  </div>

                  {/* Column 2: Full Motivation Quote Box */}
                  <div className="md:col-span-4 lg:col-span-5 min-w-0 w-full">
                    <p className="text-zen-charcoal/80 text-xs italic bg-white/30 px-3 py-2 rounded-lg border border-white/20 m-0 whitespace-normal">
                      &ldquo;{invite.message || 'No motivation message provided.'}&rdquo;
                    </p>
                  </div>

                  {/* Column 3: Stable Timestamps & Action Targets */}
                  <div className="md:col-span-4 lg:col-span-3 flex flex-col items-start md:items-end gap-2 min-w-0 w-full shrink-0">
                    <div className="min-h-[20px]">
                      {isMounted && (
                        <div className="text-xs text-zen-charcoal/80 font-medium whitespace-nowrap">
                          {new Date(invite.created_at).toLocaleDateString()} {new Date(invite.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 w-full justify-start md:justify-end">
                      {invite.status === 'pending' ? (
                        <>
                          <button
                            disabled={loadingIds.has(invite.id)}
                            aria-label={`Reject request for ${invite.email}`}
                            onClick={() => handleUpdateStatus(invite.id, 'rejected')}
                            className="flex-1 md:flex-none px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            <X size={14} /> Reject
                          </button>
                          <button
                            disabled={loadingIds.has(invite.id)}
                            aria-label={`Approve request for ${invite.email}`}
                            onClick={() => handleUpdateStatus(invite.id, 'approved')}
                            className="flex-1 md:flex-none px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
                          >
                            <Check size={14} /> Approve
                          </button>
                        </>
                      ) : (
                        <div className="text-xs text-zen-charcoal/70 italic flex items-center justify-start md:justify-end w-full">
                          {invite.status === 'approved' && 'Auth Authorized'}
                          {invite.status === 'claimed' && 'Active Member'}
                          {invite.status === 'rejected' && 'Uninvited'}
                        </div>
                      )}       
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
