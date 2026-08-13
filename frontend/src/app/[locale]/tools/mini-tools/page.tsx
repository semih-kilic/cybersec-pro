import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getPageMetadata } from "@/lib/seo";
import OnlineSubdomainFinder from "@/components/tools/OnlineSubdomainFinder";
import HeaderSecurityChecker from "@/components/tools/HeaderSecurityChecker";
import DnsLookupTool from "@/components/tools/DnsLookupTool";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("tools", locale);
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
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
  );
}
