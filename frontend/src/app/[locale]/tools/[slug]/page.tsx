import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import ToolDetailPage from "@/components/pages/ToolDetailPage";

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function generateStaticParams() {
  const locales = ["en", "tr", "de", "fr", "es", "ar", "ja", "zh", "ru", "ko"];

  try {
    const apiBase = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:5001";
    const res = await fetch(`${apiBase}/api/v2/tools`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = await res.json();
    const slugSet = new Set<string>();

    for (const cat of Object.values(data.categories || {})) {
      const c = cat as { tools?: { name: string }[] };
      for (const t of c.tools || []) {
        const slug = t.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        if (slug) slugSet.add(slug);
      }
    }

    return Array.from(slugSet).flatMap((slug) =>
      locales.map((locale) => ({ locale, slug }))
    );
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const toolName = slugToTitle(slug);

  return {
    title: `${toolName} — Security Tool | CyberSec Pro`,
    description: `Run ${toolName} online with CyberSec Pro. Access 778 professional penetration testing tools in the cloud — no setup required.`,
    openGraph: {
      title: `${toolName} | CyberSec Pro`,
      description: `Professional cloud-based ${toolName} tool for penetration testing and security assessments.`,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <ToolDetailPage slug={slug} />;
}
