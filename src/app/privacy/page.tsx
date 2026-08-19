import Link from 'next/link';

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-extrabold text-zen-charcoal mb-2">Privacy Policy</h1>
          <p className="text-zen-charcoal/70">Effective Date: May 26, 2026</p>
        </div>
        <div className="space-y-6 text-zen-charcoal/90 leading-relaxed overflow-y-auto max-h-[60vh] pr-4 custom-scrollbar">
          <section>
            <h2 className="text-xl font-bold text-zen-charcoal mb-2">1. Introduction and CalOPPA Compliance</h2>
            <p>
              An-yen Wealth ("we", "us", "our") is committed to protecting your personal information in compliance with the California Online Privacy Protection Act (CalOPPA), CCPA, and FTC regulations. This Privacy Policy details how we collect, use, disclose, and safeguard your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zen-charcoal mb-2">2. Personally Identifiable Information (PII) Collection</h2>
            <p>
              We collect minimal, necessary PII to provide our financial tracking service. This includes:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 font-semibold">
              <li>Account Credentials: Email address, Password, Display Name.</li>
              <li>Financial Data: Budgets, expense logs, categories, and descriptions that you input.</li>
              <li>AI Conversation Logs: Text-based transactions sent to the LLM service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zen-charcoal mb-2 text-green-700">3. Zero-Data-Training (ZDR) Promise</h2>
            <p className="font-semibold">
              WE RESPECT YOUR FINANCIAL PRIVACY. Under our strictly negotiated terms and server designs, none of your uploaded financial expense details or conversational prompts are stored, shared, or used by our AI vendors for training their models. Your data is processed transiently solely to categorize your transactions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zen-charcoal mb-2">4. Sub-processors and Data Transfers</h2>
            <p>
              We disclose the following US-based sub-processors utilized strictly for core operations:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-2 font-semibold">
              <li>
                Supabase, Inc.: Database hosting, authentication, metadata, and relational schemas (US region).
              </li>
              <li>
                Groq Inc. / GPT-OSS 20B Model: Transient natural language inference and expense categorization (US servers; strict Zero-Data-Training agreements).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zen-charcoal mb-2">5. CCPA "Right to Know" and "Right to Delete"</h2>
            <p>
              California residents have the right to request a portable copy of their database records and request the complete, permanent deletion of their data. You can self-service these actions at any time inside your settings dashboard, which triggers a hard database cascade purge of all tables and active browser session invalidation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zen-charcoal mb-2">6. Underage Children Protection (COPPA)</h2>
            <p>
              Our services are strictly intended for adult consumers. In compliance with the Children's Online Privacy Protection Act (COPPA), we do not knowingly collect or store any data from individuals under 18 years of age. Signup is blocked for underage users.
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
