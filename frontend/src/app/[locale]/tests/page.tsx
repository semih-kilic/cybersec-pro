import { setRequestLocale } from "next-intl/server";
import TestsPage from "@/components/pages/TestsPage";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TestsPage />;
}
