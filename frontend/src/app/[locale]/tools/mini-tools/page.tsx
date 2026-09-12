import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getAlternateLanguages, getMiniToolsJsonLd } from "@/lib/seo";
import OnlineSubdomainFinder from "@/components/tools/OnlineSubdomainFinder";
import HeaderSecurityChecker from "@/components/tools/HeaderSecurityChecker";
import DnsLookupTool from "@/components/tools/DnsLookupTool";

/**
 * This page was inheriting the tools *index* metadata, so the two shipped the
 * same title. It is neither the index nor a tool page: it is the three free,
 * no-sign-up utilities, and "subdomain finder", "http security header checker"
 * and "dns lookup" are exactly what people type into a search box. Giving the
 * page its own title is the difference between being findable and being a
 * duplicate of another page.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const url = `https://cyber-sec-pro.com/${locale}/tools/mini-tools/`;
  const title =
    "Free Online Security Tools — Subdomain Finder, Header Checker, DNS Lookup";
  const description =
    "Three security tools that run in your browser with no sign-up and no install: find the subdomains of a domain, check a site's HTTP security headers, and run a DNS lookup. Instant results, free.";

  return {
    title,
    description,
    alternates: { canonical: url, languages: getAlternateLanguages("/tools/mini-tools/") },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(getMiniToolsJsonLd(locale)) }}
      />
    <div className="mx-auto max-w-6xl px-6 pb-28 pt-32">
      <section className="text-center mb-12">
        <h1 className="text-4xl font-extrabold md:text-5xl">Free Online Security Tools</h1>
        <p className="mx-auto mt-4 max-w-2xl text-white/55">
          No sign-up. No installation. Instant results.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <OnlineSubdomainFinder />
        <HeaderSecurityChecker />
        <DnsLookupTool />
      </section>
    </div>
    </>
  );
}
