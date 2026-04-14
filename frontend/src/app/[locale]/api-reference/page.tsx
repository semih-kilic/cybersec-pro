import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getPageMetadata } from "@/lib/seo";
import ApiReferencePage from "@/components/pages/ApiReferencePage";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("api-reference", locale);
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ApiReferencePage />;
}
