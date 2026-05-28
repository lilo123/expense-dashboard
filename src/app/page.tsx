import Link from "next/link";
import Logo from "@/components/Logo";
import WaitlistIntakeForm from "@/components/WaitlistIntakeForm";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-4 relative overflow-hidden bg-zen-base">
      {/* Top Navigation */}
      <nav className="w-full max-w-6xl py-6 flex justify-between items-center z-20">
        <div className="flex items-center gap-2">
          <Logo className="w-20 h-20 sm:w-28 sm:h-28 text-zen-charcoal transition-all" />
        </div>
        <div className="flex items-center gap-4">
          <Link 
            href="/education" 
            className="px-6 py-3 bg-white/40 backdrop-blur-md text-zen-charcoal rounded-full font-semibold text-sm sm:text-base border border-white/30 hover:bg-white/60 transition-all shadow-sm"
          >
            Education Hub
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex flex-col items-center z-10 relative my-auto w-full max-w-4xl px-4 text-center py-16">
        <h1 className="text-6xl sm:text-7xl font-extrabold text-zen-charcoal mb-4 tracking-tight">
          An-yen
        </h1>
        
        <p className="text-xl sm:text-2xl text-zen-charcoal/80 mb-12 max-w-md leading-relaxed font-medium">
          Mindful Wealth Builder
        </p>
        
        {/* Private Access Portal */}
        <div className="w-full flex flex-col items-center gap-4">
          <WaitlistIntakeForm />
          
          <div className="text-sm text-zen-charcoal/70 mt-2">
            Already a member?{" "}
            <Link href="/dashboard" className="font-semibold underline hover:text-zen-charcoal transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl py-8 text-center text-xs text-zen-charcoal/50 flex flex-col sm:flex-row gap-4 justify-between items-center z-10 border-t border-zen-charcoal/10 mt-12">
        <span>© 2026 An-yen Studio. All rights reserved.</span>
        <div className="flex gap-6">
          <Link href="/terms" className="hover:underline font-medium">Terms of Service</Link>
          <Link href="/privacy" className="hover:underline font-medium">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
