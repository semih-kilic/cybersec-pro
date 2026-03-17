import { setRequestLocale } from "next-intl/server";
import CareersPage from "@/components/pages/CareersPage";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CareersPage />;
}
