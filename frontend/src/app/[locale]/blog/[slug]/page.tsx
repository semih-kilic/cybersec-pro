import { setRequestLocale } from "next-intl/server";
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

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <BlogPostPage slug={slug} />;
}
