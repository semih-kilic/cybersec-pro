import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getPricingJsonLd } from "@/lib/seo";
import PricingPage from "@/components/pages/PricingPage";

/**
 * /pricing had never existed — the plans lived only as a section on the home
 * page, so there was no URL for the highest-intent query the product has.
 * Menu links pointed at a home-page anchor, which an answer engine cannot cite.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const url = `https://cyber-sec-pro.com/${locale}/pricing/`;
  const languages: Record<string, string> = {};
  for (const l of ["en", "tr", "de", "fr", "es", "ar", "ja", "zh", "ru", "ko"]) {
    languages[l] = `https://cyber-sec-pro.com/${l}/pricing/`;
  }
  languages["x-default"] = "https://cyber-sec-pro.com/en/pricing/";

  // Localised: the Turkish page was shipping an English title. Prices stay as
  // numerals in every locale because that is what people search for.
  const t = await getTranslations({ locale, namespace: "pricingPage" });
  const title = `${t("badge")} — CyberSec Pro | $0 / $29 / $99 / $349`;
  const description = `${t("subtitle")} ${t("annualNote")}`.slice(0, 300);

  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // FAQPage is the format answer engines lift most directly into an answer, so
  // the questions are the ones a buyer actually asks and every answer is one we
  // can stand behind.
  const t = await getTranslations({ locale, namespace: "pricingPage" });
  const faq = t.raw("faq.items") as { q: string; a: string }[];
  const jsonLd = getPricingJsonLd(locale, faq);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PricingPage />
    </>
  );
}
