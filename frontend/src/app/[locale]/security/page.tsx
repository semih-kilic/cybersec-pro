import { setRequestLocale } from "next-intl/server";
import SecurityPage from "@/components/pages/SecurityPage";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SecurityPage />;
}
