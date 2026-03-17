import { setRequestLocale } from "next-intl/server";
import PrivacyPage from "@/components/pages/PrivacyPage";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PrivacyPage />;
}
