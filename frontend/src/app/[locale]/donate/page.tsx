import { setRequestLocale } from "next-intl/server";
import DonatePage from "@/components/pages/DonatePage";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DonatePage />;
}
