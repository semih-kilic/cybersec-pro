import { setRequestLocale } from "next-intl/server";
import HeroSection from "@/components/sections/HeroSection";
import FeaturesSection from "@/components/sections/FeaturesSection";
import PricingSection from "@/components/sections/PricingSection";
import ToolsPreview from "@/components/sections/ToolsPreview";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import FaqSection from "@/components/sections/FaqSection";
import CtaSection from "@/components/sections/CtaSection";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <ToolsPreview />
      <PricingSection />
      <TestimonialsSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
