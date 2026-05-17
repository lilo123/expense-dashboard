import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { Playfair_Display, Inter } from 'next/font/google';
import { getPostBySlug, getAllPosts } from '@/lib/content';
import FrostedOrb from '@/components/ui/FrostedOrb';
import Logo from '@/components/Logo';

const playfair = Playfair_Display({ 
  subsets: ['latin'], 
  weight: ['700', '600'],
  variable: '--font-playfair' 
});

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter'
});

const mdxComponents = {
  AnyenAvatar: FrostedOrb,
  Logo,
};

export function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const post = getPostBySlug(resolvedParams.slug);
  
  if (!post) {
    notFound();
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-zen-base via-zen-peach to-zen-lavender text-zen-charcoal text-left ${inter.className} ${playfair.variable}`}>
      <div className="container max-w-[700px] mx-auto px-5 py-10 pt-12 pb-24">
        <Link href="/education" className="inline-flex items-center gap-2 text-zen-charcoal/60 hover:text-zen-charcoal transition-colors mb-8 text-sm font-semibold no-underline">
          &larr; Back to Flow Hub
        </Link>
        
        <header className="mb-10">
          <div className="flex items-center gap-2 text-sm font-bold text-zen-charcoal/50 mb-2">
            <span>{post.date}</span>
            {post.category && <span className="px-2.5 py-0.5 rounded-full bg-zen-peach/20 border border-zen-peach/30 text-zen-charcoal">{post.category}</span>}
          </div>
          <h1 className={`font-serif text-4xl font-extrabold leading-tight text-zen-charcoal mb-4`}>{post.title}</h1>
          <p className="text-lg text-zen-charcoal/70 leading-relaxed">{post.excerpt}</p>
        </header>
        
        {/* MDX Body styled with Tailwind prose (headings styled as font-serif, which resolves to Playfair) */}
        <article className="prose prose-zen max-w-none prose-headings:font-serif prose-headings:text-zen-charcoal prose-p:leading-relaxed prose-li:leading-relaxed text-zen-charcoal mb-12">
          <MDXRemote source={post.content} components={mdxComponents} />
        </article>

        {/* Course CTA Navigation */}
        <div className="flex justify-center border-t border-zen-lavender/60 pt-8 pb-12">
          <Link href="/education" className="px-8 py-3 bg-zen-charcoal text-zen-base rounded-full font-bold text-base text-center hover:scale-[1.02] hover:bg-zen-charcoal/90 transition-all shadow-md no-underline cursor-pointer border-none h-12 flex items-center">
            Flow Back
          </Link>
        </div>
      </div>
    </div>
  );
}
