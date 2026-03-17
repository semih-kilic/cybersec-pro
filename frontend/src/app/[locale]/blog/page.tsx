import { setRequestLocale } from "next-intl/server";
import BlogPage from "@/components/pages/BlogPage";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BlogPage />;
}
