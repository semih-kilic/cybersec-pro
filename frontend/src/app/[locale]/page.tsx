import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getPageMetadata } from "@/lib/seo";
import HeroSection from "@/components/sections/HeroSection";
import FeaturesSection from "@/components/sections/FeaturesSection";
import TerminalDemo from "@/components/sections/TerminalDemo";
import BlogSection from "@/components/sections/BlogSection";
import PricingSection from "@/components/sections/PricingSection";
import RoiCalculatorSection from "@/components/sections/RoiCalculatorSection";
import CtaSection from "@/components/sections/CtaSection";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("home", locale);
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <TerminalDemo />
      <BlogSection />
      <PricingSection />
      <RoiCalculatorSection />
      <CtaSection />
    </>
  );
}
