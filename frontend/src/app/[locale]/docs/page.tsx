import { setRequestLocale } from "next-intl/server";
import DocsPage from "@/components/pages/DocsPage";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DocsPage />;
}
