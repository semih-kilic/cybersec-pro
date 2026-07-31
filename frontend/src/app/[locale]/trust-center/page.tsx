import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import SecurityTrustCenter from "@/components/pages/SecurityTrustCenter";

export const metadata: Metadata = {
  title: "Trust Center — CyberSec Pro | Security, Compliance & Transparency",
  description:
    "CyberSec Pro güvenlik merkezi: SOC 2, ISO 27001, GDPR, PCI DSS uyumluluk bilgileri, responsible disclosure politikası, bug bounty programı, alt işlemciler, DPA ve pentest raporları.",
  openGraph: {
    title: "Trust Center — CyberSec Pro",
    description: "Güvenlik, uyumluluk ve şeffaflık merkezi. 10+ uluslararası standarda tam uyumluluk.",
    url: "https://cyber-sec-pro.com/trust-center",
  },
};

export default async function TrustCenterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SecurityTrustCenter />;
}
