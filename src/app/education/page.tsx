import Link from 'next/link';
import { getAllPosts } from '@/lib/content';

export default function EducationPage() {
  const posts = getAllPosts();
  
  // In-memory sorting by date descending
  const sortedPosts = [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="max-w-[700px] mx-auto px-5 py-10 text-zen-charcoal text-left">
      <a href="/" className="inline-flex items-center gap-2 text-zen-charcoal/60 hover:text-zen-charcoal transition-colors mb-8 text-sm font-semibold no-underline">
        &larr; Back to Home
      </a>
      <h1 className="text-4xl font-extrabold mb-5">Flow Hub</h1>
      <p className="text-lg text-zen-charcoal/80 leading-relaxed mb-10">
        Welcome to the An-yen Mindful Wealth guide. Cultivate financial clarity and align spending with joint values.
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {sortedPosts.map((post) => (
          <Link key={post.slug} href={`/education/${post.slug}`} className="group block no-underline">
            <article className="h-full p-6 bg-white/40 backdrop-blur-md border border-white/20 rounded-3xl shadow-sm hover:bg-white/60 transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-zen-charcoal/50 mb-2">
                  <span>{post.date}</span>
                  {post.category && <span className="px-2.5 py-0.5 rounded-full bg-zen-peach/20 border border-zen-peach/30 text-zen-charcoal">{post.category}</span>}
                </div>
                <h2 className="text-xl font-bold mt-2 mb-3 group-hover:text-zen-sage-dark transition-colors">{post.title}</h2>
                <p className="leading-relaxed text-zen-charcoal/80 text-sm mb-4">{post.excerpt}</p>
              </div>
              <span className="text-xs font-bold text-zen-charcoal group-hover:underline">Flow &rarr;</span>
            </article>
          </Link>
        ))}
        
        {sortedPosts.length === 0 && (
          <p className="col-span-2 text-center py-10 text-zen-charcoal/60 font-medium">No articles published yet.</p>
        )}
      </div>
    </div>
  );
}
