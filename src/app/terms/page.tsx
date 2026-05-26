import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-gradient-to-br from-zen-base via-zen-peach to-zen-lavender text-zen-charcoal relative overflow-hidden">
      <Link 
        href="/login" 
        className="absolute top-6 left-6 flex items-center gap-2 text-zen-charcoal/60 hover:text-zen-charcoal font-semibold transition-colors z-50 no-underline"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Back to Login
      </Link>
      <div className="w-full max-w-3xl bg-white/40 backdrop-blur-md border border-white/20 shadow-xl rounded-3xl p-8 md:p-12 my-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-zen-charcoal mb-2">Terms of Service</h1>
          <p className="text-zen-charcoal/70">Effective Date: May 26, 2026</p>
        </div>
        <div className="space-y-6 text-zen-charcoal/90 leading-relaxed overflow-y-auto max-h-[60vh] pr-4 custom-scrollbar">
          <section>
            <h2 className="text-xl font-bold text-zen-charcoal mb-2">1. Agreement to Terms</h2>
            <p>
              By accessing or using An-yen Wealth ("An-yen", "we", "us", or "our"), you agree to be bound by these Terms of Service. If you do not agree, do not access or use our service.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-zen-charcoal mb-2 text-red-600">2. Strict "No Financial Advice" Disclaimer</h2>
            <p className="font-semibold">
              AN-YEN IS A PERSONAL EXPENSE AND BUDGET TRACKING TOOL ONLY. WE DO NOT PROVIDE INVESTMENT ADVICE, FINANCIAL ADVICE, LEGAL ADVICE, TAX ADVICE, OR ASSET MANAGEMENT SERVICES. ALL INFORMATION, DATA, ANALYTICS, AND CONVERSATIONAL AI RESPONSES ARE FOR GENERAL INFORMATIONAL AND BUDGET-PLANNING PURPOSES ONLY. YOU MUST CONSULT A QUALIFIED PROFESSIONALLY LICENSED FINANCIAL ADVISOR BEFORE MAKING ANY FINANCIAL DECISIONS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zen-charcoal mb-2">3. User Accounts and Security</h2>
            <p>
              You must provide accurate and complete information when creating an account. You are solely responsible for maintaining the confidentiality of your credentials and for all activity under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zen-charcoal mb-2 text-red-600">4. Limitation of Liability & Liability Cap</h2>
            <p className="font-semibold">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE US LAW, IN NO EVENT SHALL AN-YEN, ITS AFFILIATES, OFFICERS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR WEALTH. 
            </p>
            <p className="font-semibold mt-2">
              OUR MAXIMUM AGGREGATE LIABILITY FOR ANY AND ALL CLAIMS ARISING OUT OF OR RELATING TO THE USE OF OR INABILITY TO USE THE SERVICES SHALL NOT EXCEED ONE HUNDRED US DOLLARS ($100.00 USD).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zen-charcoal mb-2">5. Fair Use and AI Interactions</h2>
            <p>
              Our services utilize advanced large language models for automated categorization and conversational chatting. You agree not to attempt prompt injection, reverse-engineering, server flooding, or scraping of the AI interfaces.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zen-charcoal mb-2">6. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Continued use of the platform after updates constitutes binding acceptance.
            </p>
          </section>
        </div>
        
        <div className="mt-8 text-center border-t border-white/20 pt-6 text-sm text-zen-charcoal/60">
          © 2026 An-yen Wealth. All rights reserved.
        </div>
      </div>
    </div>
  );
}
