"use client";

import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";

const endpoints = [
  { method: "GET", path: "/api/v1/tools", description: "List all available security tools" },
  { method: "GET", path: "/api/v1/tools/:id", description: "Get tool details by ID" },
  { method: "POST", path: "/api/v1/scans", description: "Create a new scan" },
  { method: "GET", path: "/api/v1/scans", description: "List all scans" },
  { method: "GET", path: "/api/v1/scans/:id", description: "Get scan status and results" },
  { method: "POST", path: "/api/v1/scans/:id/execute", description: "Execute a scan" },
  { method: "GET", path: "/api/v1/reports", description: "List generated reports" },
  { method: "POST", path: "/api/v1/reports/generate", description: "Generate a report" },
  { method: "GET", path: "/api/v1/projects", description: "List projects" },
  { method: "POST", path: "/api/v1/targets", description: "Add a scan target" },
];

const methodColors: Record<string, string> = {
  GET: "text-[var(--color-neon)] bg-[var(--color-neon)]/10",
  POST: "text-[var(--color-cyan)] bg-[var(--color-cyan)]/10",
  PUT: "text-[var(--color-orange)] bg-[var(--color-orange)]/10",
  DELETE: "text-[var(--color-red)] bg-[var(--color-red)]/10",
};

export default function ApiReferencePage() {
  const t = useTranslations("api");

  return (
    <>
      <section className="relative pb-16 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">{t("badge")}</span>
          <h1 className="text-4xl font-extrabold md:text-6xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-lg text-white/55">{t("subtitle")}</p>
        </RevealOnScroll>
      </section>

      {/* Base URL */}
      <section className="mx-auto max-w-4xl px-6 pb-8">
        <RevealOnScroll>
          <div className="glass-card p-6">
            <h3 className="mb-2 font-mono text-sm font-bold text-white/70">{t("baseUrl")}</h3>
            <code className="rounded-lg bg-black/30 px-4 py-2 font-mono text-sm text-[var(--color-neon)]">
              https://semihkilic.com/api/v1
            </code>
          </div>
        </RevealOnScroll>
      </section>

      {/* Auth */}
      <section className="mx-auto max-w-4xl px-6 pb-8">
        <RevealOnScroll>
          <div className="glass-card p-6">
            <h3 className="mb-2 font-mono text-sm font-bold text-white/70">{t("authentication")}</h3>
            <pre className="overflow-x-auto rounded-lg bg-black/30 p-4 font-mono text-xs text-white/60">
{`Authorization: Bearer <your-jwt-token>

# Get token via login
POST /api/v1/auth/login
Content-Type: application/json
{ "email": "user@example.com", "password": "..." }`}
            </pre>
          </div>
        </RevealOnScroll>
      </section>

      {/* Endpoints */}
      <section className="mx-auto max-w-4xl px-6 pb-28">
        <RevealOnScroll>
          <h2 className="mb-6 text-xl font-bold">{t("endpoints")}</h2>
        </RevealOnScroll>
        <div className="flex flex-col gap-3">
          {endpoints.map((ep) => (
            <RevealOnScroll key={ep.path + ep.method}>
              <div className="glass-card flex items-center gap-4 px-6 py-4">
                <span className={`rounded-md px-2.5 py-1 font-mono text-xs font-bold ${methodColors[ep.method]}`}>
                  {ep.method}
                </span>
                <code className="font-mono text-sm text-white/80">{ep.path}</code>
                <span className="ml-auto hidden text-sm text-white/40 sm:block">{ep.description}</span>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </section>
    </>
  );
}
