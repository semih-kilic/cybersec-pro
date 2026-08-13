import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getPageMetadata } from "@/lib/seo";
import ToolDetailPage from "@/components/pages/ToolDetailPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const toolName = slug.replace(/-/g, " ");
  return getPageMetadata("tools", locale);
}

export async function generateStaticParams() {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5001";
    const res = await fetch(`${base}/api/v2/tools?plan=trial`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const tools: { name?: string }[] = [];
    for (const cat of Object.values(data.categories || {})) {
      const c = cat as { tools?: { name?: string }[] };
      for (const t of c.tools || []) {
        if (t.name) tools.push({ name: t.name });
      }
    }
    const params = tools.map((t) => ({
      slug: t.name!.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    }));
    params.push({ slug: "mini-tools" });
    return params;
  } catch {
    return [{ slug: "mini-tools" }];
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <ToolDetailPage slug={slug} />;
}
