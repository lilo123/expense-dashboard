export default function EducationPage() {
  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '40px 20px' }}>
      <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: 'var(--text-muted)', marginBottom: '30px', fontSize: '14px', fontWeight: 500 }}>
        &larr; Back to Home
      </a>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '20px' }}>Education Hub</h1>
      <p style={{ fontSize: '1.1rem', lineHeight: '1.7', color: 'var(--text-muted)', marginBottom: '40px' }}>
        Welcome to the An-yen Mindful Wealth guide. Here you will find resources to cultivate financial clarity and align your spending with your true values.
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        <article style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '10px' }}>1. What is Mindful Wealth?</h2>
          <p style={{ margin: 0, lineHeight: '1.6', color: 'var(--text-muted)' }}>
            Mindful wealth is the practice of bringing conscious awareness to your financial flows, viewing money not just as currency, but as energy aligned with your values.
          </p>
        </article>
        
        <article style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '10px' }}>2. The 3 Pillars of Conscious Budgeting</h2>
          <p style={{ margin: 0, lineHeight: '1.6', color: 'var(--text-muted)' }}>
            Learn how to structure your daily record-keeping around core intent, category mapping, and dynamic balance, using our AI extraction features for ultimate simplicity.
          </p>
        </article>
      </div>
    </div>
  );
}
