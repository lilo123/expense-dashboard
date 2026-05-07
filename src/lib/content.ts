import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const CONTENT_DIR = path.join(process.cwd(), 'src/content/education');

export interface PostMetadata {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  category?: string;
}

export interface PostData extends PostMetadata {
  content: string;
}

export function getAllPosts(): PostMetadata[] {
  if (!fs.existsSync(CONTENT_DIR)) {
    return [];
  }

  const files = fs.readdirSync(CONTENT_DIR);
  const posts = files
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => {
      const slug = file.replace(/\.mdx$/, '');
      const filePath = path.join(CONTENT_DIR, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { data } = matter(fileContent);

      return {
        slug,
        title: data.title || 'Untitled',
        excerpt: data.excerpt || data.description || '',
        date: data.date || '',
        category: data.category || 'General',
      } as PostMetadata;
    });

  return posts;
}

export function getPostBySlug(slug: string): PostData | null {
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);

  return {
    slug,
    title: data.title || 'Untitled',
    excerpt: data.excerpt || data.description || '',
    date: data.date || '',
    category: data.category || 'General',
    content,
  };
}
