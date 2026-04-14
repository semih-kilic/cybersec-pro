import { setRequestLocale } from "next-intl/server";
import BlogPostPage from "@/components/pages/BlogPostPage";

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <BlogPostPage slug={slug} />;
}
