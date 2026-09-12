/**
 * Post list for the blog index, the home-page section and SEO metadata.
 *
 * Derived from blog-content.ts rather than duplicated from it. The previous
 * hand-written copy had drifted from the posts it described — wrong read times
 * on all ten, and four posts that seo.ts could not find at all.
 */
import { BLOG_POSTS, estimateReadTime } from "./blog-content";

export interface BlogPostMeta {
  slug: string;
  title: string;
  category: string;
  readTime: number;
  date: string;
  author: string;
  excerpt: string;
  tags: string[];
}

export const blogPostsList: BlogPostMeta[] = Object.values(BLOG_POSTS)
  .map((p) => ({
    slug: p.slug,
    title: p.title,
    category: p.category,
    readTime: estimateReadTime(p.content),
    date: p.date,
    author: p.author,
    excerpt: p.excerpt,
    tags: p.tags,
  }))
  .sort((a, b) => b.date.localeCompare(a.date));

export default blogPostsList;
