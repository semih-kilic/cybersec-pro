import { setRequestLocale } from "next-intl/server";
import ApiReferencePage from "@/components/pages/ApiReferencePage";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ApiReferencePage />;
}
