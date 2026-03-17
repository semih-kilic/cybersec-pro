"use client";

import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";

const sections = [
  { title: "Information We Collect", content: "We collect information you provide directly (email, name, company) and automatically (IP address, browser type, usage patterns). We use cookies for session management and analytics." },
  { title: "How We Use Your Information", content: "Your data is used to provide and improve our services, process payments, send notifications, and ensure platform security. We never sell your personal data to third parties." },
  { title: "Data Security", content: "All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We maintain SOC 2 compliance and conduct regular security audits of our infrastructure." },
  { title: "Data Retention", content: "Scan results are retained for the duration of your subscription plus 30 days. Account data is retained for 90 days after account deletion. You can request immediate deletion at any time." },
  { title: "Your Rights", content: "You have the right to access, correct, delete, or export your data. You can opt out of marketing communications at any time. For GDPR requests, contact our DPO." },
  { title: "Third-Party Services", content: "We use Stripe for payments, Google Analytics for usage metrics, and cloud infrastructure providers for hosting. Each provider maintains their own privacy policies." },
  { title: "Contact", content: "For privacy-related inquiries, contact us at cybersecpro@semihkilic.com. We respond to all privacy requests within 72 hours." },
];

export default function PrivacyPage() {
  const t = useTranslations("privacy");

  return (
    <section className="mx-auto max-w-3xl px-6 pb-28 pt-32">
      <RevealOnScroll>
        <h1 className="text-4xl font-extrabold md:text-5xl">{t("title")}</h1>
        <p className="mt-2 text-sm text-white/40">{t("lastUpdated")}</p>
      </RevealOnScroll>
      <div className="mt-12 flex flex-col gap-8">
        {sections.map((s) => (
          <RevealOnScroll key={s.title}>
            <h2 className="mb-2 text-lg font-bold text-white">{s.title}</h2>
            <p className="text-sm leading-relaxed text-white/50">{s.content}</p>
          </RevealOnScroll>
        ))}
      </div>
    </section>
  );
}
