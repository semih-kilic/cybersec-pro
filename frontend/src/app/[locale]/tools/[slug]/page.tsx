import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getPageMetadata, getToolJsonLd, getAlternateLanguages } from "@/lib/seo";
import { getToolCatalog, getToolBySlug, nameToSlug } from "@/lib/tools-catalog";
import ToolDetailPage from "@/components/pages/ToolDetailPage";

/**
 * Per-tool metadata.
 *
 * This used to return `getPageMetadata("tools", locale)` for every slug, so all
 * 89 tools shipped the tools *index* page's title and description — 890 pages
 * across the locales that no search or answer engine could tell apart. The
 * tool's name was even computed here and then discarded.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;

  // mini-tools is not a tool page and not the tools index: it is the three
  // free, no-sign-up utilities (subdomain finder, HTTP security header check,
  // DNS lookup). It was inheriting the index page's title, which is both a
  // duplicate and a waste — those are exactly the queries people type.
  if (slug === "mini-tools") {
    const url = `https://cyber-sec-pro.com/${locale}/tools/mini-tools/`;
    const title = "Free Online Security Tools — Subdomain Finder, Header Checker, DNS Lookup";
    const description =
      "Three security tools that run in your browser with no sign-up and no install: find subdomains for a domain, check a site's HTTP security headers, and run a DNS lookup. Instant results, free.";
    return {
      title,
      description,
      alternates: { canonical: url, languages: getAlternateLanguages("/tools/mini-tools/") },
      openGraph: { title, description, url, type: "website" },
    };
  }

  const tool = await getToolBySlug(slug);
  if (!tool) return getPageMetadata("tools", locale);

  const category = tool.subcategory || tool.business_category || tool.category;
  const description = tool.description
    ? `${tool.description} Run ${tool.name} in your browser on CyberSec Pro — no install, no VM, live output.`
    : `Run ${tool.name} in your browser on CyberSec Pro — no install, no VM, live output.`;

  return {
    title: `${tool.name} — ${category} tool, run online | CyberSec Pro`,
    description: description.slice(0, 300),
    alternates: {
      canonical: `https://cyber-sec-pro.com/${locale}/tools/${slug}/`,
      // Every other page type carries these; the tool pages were the one gap,
      // and they are 89 of the site's 112 pages.
      languages: getAlternateLanguages(`/tools/${slug}/`),
    },
    openGraph: {
      title: `${tool.name} — run it in your browser`,
      description: description.slice(0, 300),
      url: `https://cyber-sec-pro.com/${locale}/tools/${slug}/`,
      type: "article",
    },
  };
}

export async function generateStaticParams() {
  const tools = await getToolCatalog();
  const params = tools.map((t) => ({ slug: nameToSlug(t.name) }));
  params.push({ slug: "mini-tools" });
  return params;
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // Resolved at build time so the tool's real name, description, category and
  // plan are in the prerendered HTML instead of a "Loading tool details…"
  // placeholder. The client component seeds its state from this and only
  // fetches when it is absent.
  const tool = slug === "mini-tools" ? null : await getToolBySlug(slug);
  const jsonLd = tool ? getToolJsonLd(tool, locale, slug) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ToolDetailPage slug={slug} initialTool={tool} />
    </>
  );
}
