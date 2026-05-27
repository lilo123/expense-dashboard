import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getInviteRequestsAction } from '@/app/actions/admin';
import AdminDashboardView from './AdminDashboardView';
import { ArrowLeft, Users, Activity } from 'lucide-react';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) redirect('/login');

  const jwtAdmin = authData.user.app_metadata?.role === 'admin' || authData.user.user_metadata?.role === 'admin';
  if (!jwtAdmin) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single();
    if (profile?.role !== 'admin') redirect('/dashboard');
  }

  const invitesRes = await getInviteRequestsAction();
  const initialInvites = invitesRes.success ? invitesRes.data || [] : [];
  const totalRegisteredAccounts = invitesRes.success ? invitesRes.totalRegisteredAccounts || 0 : 0;
  const activePast7Days = invitesRes.success ? invitesRes.activePast7Days || 0 : 0;
  const initialEmailTemplate = invitesRes.success ? invitesRes.emailTemplate : undefined;

  return (
    <div className="container p-4 max-w-6xl">
      {/* Top Navigation Back Link with WCAG AA Contrast */}
      <div className="mb-6">
        <Link 
          href="/dashboard" 
          className="flex items-center gap-2 text-zen-charcoal/80 hover:text-zen-charcoal font-bold transition-all no-underline text-sm"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>

      {/* Dedicated Executive Control Deck Header - Requested Subtitle Paragraph Stripped Clean */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 flex-wrap bg-white/40 backdrop-blur-md border border-white/20 shadow-lg rounded-3xl p-8 mb-8">
        <div className="flex-1 min-w-[280px]">
          <h1 className="text-2xl font-bold tracking-tight text-zen-charcoal m-0">Manage Platform</h1>
        </div>

        {/* Spacious Luxury Glassmorphic Metrics Summary Flexbox */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
          <div className="bg-white/60 border border-white/30 backdrop-blur-md px-6 py-4 rounded-2xl shadow-sm min-w-[200px] flex items-center gap-4">
            <div className="p-2.5 bg-zen-charcoal text-zen-base rounded-xl shrink-0">
              <Users size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-zen-charcoal/80 uppercase tracking-wider whitespace-nowrap">Total Accounts</span>
              <span className="text-xl font-extrabold text-zen-charcoal">{totalRegisteredAccounts}</span>
            </div>
          </div>

          <div className="bg-white/60 border border-white/30 backdrop-blur-md px-6 py-4 rounded-2xl shadow-sm min-w-[200px] flex items-center gap-4">
            <div className="p-2.5 bg-emerald-700 text-white rounded-xl shadow-sm shrink-0">
              <Activity size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-zen-charcoal/80 uppercase tracking-wider whitespace-nowrap">Active Past 7 Days</span>
              <span className="text-xl font-extrabold text-zen-charcoal">{activePast7Days}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Cockpit Request Matrix */}
      <AdminDashboardView 
        initialInvites={initialInvites} 
        initialProfiles={invitesRes.success && invitesRes.profiles ? invitesRes.profiles : []} 
        initialEmailTemplate={initialEmailTemplate} 
        initialError={invitesRes.error || null}
      />
    </div>
  );
}
