"use client";

import { useTranslations } from "next-intl";
import { BLOG_POSTS, estimateReadTime, type BlogPost } from "@/lib/blog-content";
import { useLocale } from "next-intl";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Clock, ArrowLeft, Shield, Bug, Terminal, Wifi, Server, Code2, Calendar, User } from "lucide-react";
const MatrixRain = dynamic(() => import("@/components/three/MatrixRain"), { ssr: false });
import RevealOnScroll from "@/components/animations/RevealOnScroll";

const CATEGORY_COLORS: Record<string, string> = {
  Tools: "#9fef00",
  Security: "#00d4ff",
  DevSecOps: "#b44aff",
  Tutorials: "#ff6600",
  Guides: "#ef476f",
  Wireless: "#ffd166",
};
const CATEGORY_ICONS: Record<string, typeof Shield> = {
  Tools: Terminal,
  Security: Shield,
  DevSecOps: Code2,
  Tutorials: Bug,
  Guides: Server,
  Wireless: Wifi,
};




function formatDate(dateStr: string, locale: string) {

  return new Date(dateStr).toLocaleDateString(locale === "tr" ? "tr-TR" : locale === "de" ? "de-DE" : "en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function BlogPostPage({ slug }: { slug: string }) {
  const t = useTranslations("blog");
  const locale = useLocale();
  const post = BLOG_POSTS[slug];

  if (!post) {
    return (
      <>
        <MatrixRain />
        <section className="relative pb-16 pt-32 text-center">
          <div className="mx-auto max-w-2xl px-6">
            <h1 className="text-3xl font-extrabold text-white mb-4">Article Not Found</h1>
            <p className="text-white/50 mb-8">The article you&apos;re looking for doesn&apos;t exist or has been moved.</p>
            <Link
              href={`/${locale}/blog`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-6 py-3 font-mono text-sm font-medium text-white/60 transition-all hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)]"
            >
              <ArrowLeft size={14} /> Back to Blog
            </Link>
          </div>
        </section>
      </>
    );
  }

  const color = CATEGORY_COLORS[post.category] || "#9fef00";
  const Icon = CATEGORY_ICONS[post.category] || Shield;

  return (
    <>
      <MatrixRain />
      {/* Header */}
      <section className="relative pb-8 pt-28">
        <div className="mx-auto max-w-3xl px-6">
          <RevealOnScroll>
            <Link
              href={`/${locale}/blog`}
              className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-[var(--color-neon)] transition mb-8"
            >
              <ArrowLeft size={14} /> {t("backToBlog") ?? "Back to Blog"}
            </Link>

            <div className="flex items-center gap-3 mb-4">
              <span
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: `${color}15`, color }}
              >
                <Icon size={12} />
                {post.category}
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-white md:text-4xl lg:text-5xl leading-tight mb-6">
              {post.title}
            </h1>

            <p className="text-lg text-white/50 mb-6">{post.excerpt}</p>

            <div className="flex flex-wrap items-center gap-4 text-sm text-white/30 border-b border-white/5 pb-6">
              <span className="flex items-center gap-1.5">
                <User size={14} /> {post.author}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={14} /> {formatDate(post.date, locale)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} /> {estimateReadTime(post.content)} min read
              </span>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* Content */}
      <section className="pb-20">
        <div className="mx-auto max-w-3xl px-6">
          <RevealOnScroll>
            <article className="prose prose-invert prose-sm max-w-none
              prose-headings:text-white prose-headings:font-bold
              prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-white/5 prose-h2:pb-2
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
              prose-p:text-white/60 prose-p:leading-relaxed
              prose-strong:text-white
              prose-code:text-[var(--color-neon)] prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
              prose-pre:bg-[#0a0a0a] prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl
              prose-li:text-white/60
              prose-table:text-sm
              prose-th:text-white prose-th:bg-white/5 prose-th:px-4 prose-th:py-2
              prose-td:text-white/60 prose-td:px-4 prose-td:py-2 prose-td:border-b prose-td:border-white/5
              prose-a:text-[var(--color-neon)] prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-[var(--color-neon)]/30 prose-blockquote:text-white/50
            " dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }} />
          </RevealOnScroll>

          {/* Tags */}
          <div className="mt-12 pt-6 border-t border-white/5">
            <div className="flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white/40">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Back link */}
          <div className="mt-8">
            <Link
              href={`/${locale}/blog`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-6 py-3 font-mono text-sm font-medium text-white/60 transition-all hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)]"
            >
              <ArrowLeft size={14} /> {t("backToBlog") ?? "Back to All Articles"}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/** Simple markdown-to-HTML renderer for blog content */
function renderMarkdown(md: string): string {
  // SECURITY: escape raw HTML first so injected <script>/<img onerror> cannot
  // survive the markdown pass into dangerouslySetInnerHTML.
  const safe = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return safe
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^\| (.+) \|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim()).map(c => c.trim());
      return '<tr>' + cells.map(c => c.match(/^[-:]+$/) ? '' : `<td>${c}</td>`).join('') + '</tr>';
    })
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>')
    .replace(/(<li>[\s\S]*<\/li>)/, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hupoltd])/gm, '')
    .replace(/<p><\/p>/g, '')
    .replace(/<tr><td>[-:]+<\/td>.*?<\/tr>/g, '')
    ;
}
