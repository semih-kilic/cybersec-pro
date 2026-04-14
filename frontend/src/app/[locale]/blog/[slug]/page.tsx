import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getBlogPostMetadata, getBlogPostJsonLd } from "@/lib/seo";
import BlogPostPage from "@/components/pages/BlogPostPage";
import { locales } from "@/i18n/config";

const slugs = [
  "mastering-wireshark",
  "hashcat-vs-john",
  "owasp-top-10-2026",
  "metasploit-zero-to-exploit",
  "ci-cd-pentest-automation",
  "wireless-security-assessment",
];

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    slugs.map((slug) => ({ locale, slug }))
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  return getBlogPostMetadata(slug, locale);
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const jsonLd = getBlogPostJsonLd(slug);

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <BlogPostPage slug={slug} />
    </>
  );
}
