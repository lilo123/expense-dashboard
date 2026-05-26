'use client';

import { useState, useEffect, useRef } from 'react';
import { InviteRequest } from '@/types/database';
import { updateInviteStatusAction } from '@/app/actions/admin';
import { Check, X, Clock, AlertCircle, ShieldCheck, UserCheck, Copy } from 'lucide-react';

interface AdminDashboardViewProps {
  initialInvites: InviteRequest[];
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'claimed' | 'rejected';

export default function AdminDashboardView({ initialInvites }: AdminDashboardViewProps) {
  const [invites, setInvites] = useState<InviteRequest[]>(initialInvites);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterStatus>('all');
  const [copiedGlobal, setCopiedGlobal] = useState(false);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { 
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true); 
    return () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current); };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInvites(initialInvites);
  }, [initialInvites]);

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setLoadingIds(prev => new Set(prev).add(id));
    setError(null); setSuccessMsg(null);
    try {
      const res = await updateInviteStatusAction(id, status);
      if (res.success && res.data) {
        setInvites(prev => prev.map(inv => inv.id === id ? res.data! : inv));
        setSuccessMsg(`Invitation successfully ${status}.`);
      } else setError(res.error || 'Failed to update status.');
    } catch (err: unknown) { 
      setError(err instanceof Error ? err.message : 'Error communicating with server.'); 
    } finally { 
      setLoadingIds(prev => { const next = new Set(prev); next.delete(id); return next; }); 
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

  const filteredInvites = invites.filter(inv => activeTab === 'all' ? true : inv.status === activeTab);
  const countByStatus = (status: FilterStatus) => invites.filter(inv => status === 'all' ? true : inv.status === status).length;

  const tabs: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'claimed', label: 'Claimed' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="bg-white/40 backdrop-blur-md border border-white/20 shadow-lg rounded-2xl p-6 flex flex-col gap-5">
      {/* Dismissible Action Alerts with Accessible Labeling */}
      <div className="min-h-[44px] flex flex-col justify-center">
        {error ? (
          <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-xl flex items-center justify-between gap-3 text-xs font-bold shadow-sm" role="alert">
            <div className="flex items-center gap-3"><AlertCircle size={16} className="shrink-0" /><span>{error}</span></div>
            <button onClick={() => setError(null)} aria-label="Dismiss alert" className="p-1 hover:bg-red-200 rounded-lg text-red-700 cursor-pointer"><X size={14} /></button>
          </div>
        ) : successMsg ? (
          <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl flex items-center justify-between gap-3 text-xs font-bold shadow-sm" role="status">
            <div className="flex items-center gap-3"><ShieldCheck size={16} className="shrink-0" /><span>{successMsg}</span></div>
            <button onClick={() => setSuccessMsg(null)} aria-label="Dismiss success message" className="p-1 hover:bg-emerald-200 rounded-lg text-emerald-700 cursor-pointer"><X size={14} /></button>
          </div>
        ) : (
          <div className="text-xs text-zen-charcoal/80 font-semibold text-center">
            Tip: Approved users can claim accounts via the Global VIP Access URL.
          </div>
        )}
      </div>

      {/* Dedicated Top Title Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
        <h2 className="text-lg font-bold text-zen-charcoal">Invitation Requests</h2>
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

      {/* Scrollbar-Free Glassmorphic Filter Tabs Deck */}
      <div className="flex flex-wrap items-center bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/30 gap-1.5 mb-2" role="tablist" aria-label="Filter invitation requests">
        {tabs.map(tab => (
          <button
            key={tab.key}
            id={`tab-${tab.key}`}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={activeTab === tab.key ? `panel-${tab.key}` : undefined}
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

      {/* Dense Bounded Cockpit Row Matrix with overflow-x-auto safety to guarantee zero action truncation */}
      <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} tabIndex={0} className="bg-white/20 border border-white/30 rounded-2xl divide-y divide-white/20 overflow-y-auto overflow-x-auto max-h-[400px] scrollbar-thin shadow-inner focus:outline-none focus:ring-1 focus:ring-zen-charcoal/20">
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
                {/* Column 1: Spacious Email & Status Header (Cols 1-4) */}
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

                {/* Column 2: Full Motivation Quote Box (Cols 5-8) */}
                <div className="md:col-span-4 lg:col-span-5 min-w-0 w-full">
                  <p className="text-zen-charcoal/80 text-xs italic bg-white/30 px-3 py-2 rounded-lg border border-white/20 m-0 whitespace-normal">
                    &ldquo;{invite.message || 'No motivation message provided.'}&rdquo;
                  </p>
                </div>

                {/* Column 3: Stable Timestamps & Action Targets (Cols 9-12 permanently visible) */}
                <div className="md:col-span-4 lg:col-span-3 flex flex-col items-start md:items-end gap-2 min-w-0 w-full shrink-0">
                  <div className="min-h-[16px]">
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
    </div>
  );
}
