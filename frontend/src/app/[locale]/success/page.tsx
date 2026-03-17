import { setRequestLocale } from "next-intl/server";
import SuccessPage from "@/components/pages/SuccessPage";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SuccessPage />;
}
