import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getPageMetadata } from "@/lib/seo";
import HeroSection from "@/components/sections/HeroSection";
import DemoSection from "@/components/sections/DemoSection";
import FeaturesSection from "@/components/sections/FeaturesSection";
import ComparisonSection from "@/components/sections/ComparisonSection";
import TerminalDemo from "@/components/sections/TerminalDemo";
import BlogSection from "@/components/sections/BlogSection";
import PricingSection from "@/components/sections/PricingSection";
import SampleReportsSection from "@/components/sections/SampleReportsSection";
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
      <DemoSection />
      <FeaturesSection />
      <ComparisonSection />
      <TerminalDemo />
      <BlogSection />
      <PricingSection />
      <SampleReportsSection />
      <RoiCalculatorSection />
      <CtaSection />
    </>
  );
}
