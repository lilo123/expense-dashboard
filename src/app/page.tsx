import Link from "next/link";
import Logo from "@/components/Logo";
import FrostedOrb from "@/components/ui/FrostedOrb";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Top Navigation */}
      <nav className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20">
        <div className="flex items-center gap-2">
          <Logo className="w-20 h-20 sm:w-28 sm:h-28 text-zen-charcoal transition-all" />
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex flex-col items-center z-10 relative mt-12">
        {/* The Animated Morphing Orb sits behind the text */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-72 h-72 opacity-50 blur-xl">
           <FrostedOrb className="w-full h-full" />
        </div>

        <h1 className="text-6xl sm:text-7xl font-extrabold text-zen-charcoal mb-6 tracking-tight text-center">
          An-yen
        </h1>
        <p className="text-xl text-zen-charcoal/80 mb-10 max-w-lg text-center leading-relaxed">
          Mindful wealth tracking. Align your daily expenses with your inner values.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link 
            href="/dashboard" 
            className="px-8 py-4 bg-zen-charcoal text-zen-base rounded-full font-bold text-lg text-center hover:scale-[1.02] hover:bg-zen-charcoal/90 transition-all shadow-lg"
          >
            Enter App
          </Link>
          <Link 
            href="/education" 
            className="px-8 py-4 bg-white/40 backdrop-blur-md text-zen-charcoal rounded-full font-bold text-lg text-center border border-white/30 hover:bg-white/60 transition-all"
          >
            Flow Hub
          </Link>
        </div>
      </div>
    </div>
  );
}
