import Link from "next/link";
import Logo from "@/components/Logo";
import WaitlistIntakeForm from "@/components/WaitlistIntakeForm";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-between px-6 sm:px-12 relative overflow-hidden bg-zen-base">
      {/* Top Navigation */}
      <nav className="w-full max-w-6xl py-8 flex justify-between items-center z-20">
        <Logo className="w-24 h-24 sm:w-28 sm:h-28 text-zen-charcoal transition-all" />
        <Link 
          href="/education" 
          className="px-6 py-2.5 bg-white/50 backdrop-blur-md text-zen-charcoal rounded-full font-bold text-sm border border-white/30 hover:bg-white/80 transition-all shadow-sm"
        >
          Education Hub
        </Link>
      </nav>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center z-10 relative flex-1 w-full max-w-3xl text-center px-4 py-8 my-auto">
        <h1 className="text-6xl sm:text-7xl font-black text-zen-charcoal mb-4 tracking-tight">
          An-yen
        </h1>
        
        <p className="text-xl sm:text-2xl text-zen-charcoal/80 mb-10 max-w-md leading-relaxed font-semibold">
          Mindful Wealth Builder
        </p>
        
        {/* Private Access Portal */}
        <div className="w-full flex flex-col items-center gap-4">
          <WaitlistIntakeForm />
          
          <div className="text-sm text-zen-charcoal/70 mt-1">
            Already a member?{" "}
            <Link href="/dashboard" className="font-bold underline hover:text-zen-charcoal transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl py-8 text-center text-xs text-zen-charcoal/50 flex flex-col sm:flex-row gap-4 justify-between items-center z-10 border-t border-zen-charcoal/10">
        <span className="font-medium">© 2026 An-yen Studio. All rights reserved.</span>
        <div className="flex gap-8 font-semibold">
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
