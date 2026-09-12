/**
 * Build-time tool catalogue.
 *
 * The tool detail pages used to fetch their own data in a `useEffect`, which
 * meant the prerendered HTML — the only thing a crawler ever sees — contained
 * 393 characters: the nav, and the words "Loading tool details…". All 89 tools
 * across 10 locales shipped that same placeholder, and `generateMetadata`
 * handed every one of them the tools *index* page's title and description. 890
 * pages that were, to any search engine or answer engine, one empty page
 * repeated. That is most of why the site does not appear in AI answers.
 *
 * `generateStaticParams` was already calling this endpoint at build time, so
 * the data was there all along — it just never reached the HTML. This module
 * fetches once per build and hands the tool to the page, which renders it on
 * the server and passes it down as the component's initial state.
 */
export interface CatalogTool {
  id: string;
  name: string;
  description: string;
  category: string;
  plan_required?: string;
  is_active?: boolean;
  command_template?: string | null;
  binary_name?: string | null;
  group?: string | null;
  kali_package?: string | null;
  business_category?: string | null;
  subcategory?: string | null;
  tool_type?: string | null;
}

export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

let cache: Promise<CatalogTool[]> | null = null;

/**
 * Every tool the trial plan can see, which is the full public catalogue.
 * Memoised for the life of the build; a failed fetch resolves to [] so a build
 * without the API running degrades to the previous behaviour rather than
 * failing outright.
 */
export function getToolCatalog(): Promise<CatalogTool[]> {
  if (cache) return cache;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5001";
  cache = fetch(`${base}/api/v2/tools?plan=trial`, { next: { revalidate: 3600 } })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data) return [];
      const tools: CatalogTool[] = [];
      for (const cat of Object.values(data.categories || {})) {
        const c = cat as { tools?: CatalogTool[] };
        for (const t of c.tools || []) if (t?.name) tools.push(t);
      }
      return tools;
    })
    .catch(() => []);
  return cache;
}

export async function getToolBySlug(slug: string): Promise<CatalogTool | null> {
  const tools = await getToolCatalog();
  return tools.find((t) => nameToSlug(t.name) === slug) ?? null;
}

/** Human label for the plan a tool needs, matching the pricing page. */
export const PLAN_LABELS: Record<string, string> = {
  trial: "Free Trial",
  starter: "Starter",
  professional: "Professional",
  team: "Team",
  enterprise: "Enterprise",
};
