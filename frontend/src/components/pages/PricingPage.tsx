"use client";

import { useTranslations, useLocale } from "next-intl";
import { Check, Minus, ShieldCheck, KeyRound, CreditCard, Undo2 } from "lucide-react";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import PricingSection from "@/components/sections/PricingSection";
import { Email } from "@/components/Email";

/**
 * The dedicated pricing page.
 *
 * The plan cards are the existing PricingSection, reused rather than
 * reimplemented, so the two surfaces cannot drift apart. What this page adds is
 * the part a homepage section has no room for: the full matrix of what each
 * plan actually enforces.
 *
 * Every figure below is read from rust-backend/src/services/plan.rs — the same
 * config the API enforces — and the prices were checked against the live Stripe
 * price objects. Nothing here is rounded for effect. A pricing page that
 * overstates a limit is a support ticket and a refund waiting to happen, and
 * it is also the page answer engines quote most.
 */

const PLANS = ["trial", "starter", "professional", "enterprise"] as const;
type Plan = (typeof PLANS)[number];

/**
 * `true`/`false` render as a mark; a string is a value.
 *
 * `unit` says how to read that value. Only the scan quota is a monthly
 * allowance — concurrent scans, projects and seats are ceilings, not
 * allowances, and labelling them "/month" says something false about what the
 * plan gives you.
 */
type Cell = boolean | string;
type Row = { key: string; cells: Record<Plan, Cell>; unit?: "perMonth" };
type Group = { key: string; rows: Row[] };

/** Mirrors plan.rs. 0 / -1 in that file mean unlimited. */
const MATRIX: Group[] = [
  {
    key: "scanning",
    rows: [
      { key: "tools", cells: { trial: "allTools", starter: "allTools", professional: "allTools", enterprise: "allTools" } },
      { key: "scans", unit: "perMonth", cells: { trial: "trialScans", starter: "30", professional: "250", enterprise: "5,000" } },
      { key: "concurrent", cells: { trial: "1", starter: "2", professional: "5", enterprise: "unlimited" } },
    ],
  },
  {
    key: "workspace",
    rows: [
      { key: "projects", cells: { trial: "1", starter: "1", professional: "5", enterprise: "unlimited" } },
      { key: "seats", cells: { trial: "1", starter: "3", professional: "10", enterprise: "unlimited" } },
      { key: "agents", cells: { trial: "1", starter: "1", professional: "5", enterprise: "unlimited" } },
    ],
  },
  {
    key: "reports",
    rows: [
      { key: "basicReports", cells: { trial: true, starter: true, professional: true, enterprise: true } },
      { key: "pdf", cells: { trial: true, starter: true, professional: true, enterprise: true } },
      { key: "html", cells: { trial: false, starter: true, professional: true, enterprise: true } },
      { key: "compliance", cells: { trial: false, starter: false, professional: true, enterprise: true } },
    ],
  },
  {
    key: "automation",
    rows: [
      { key: "scheduled", cells: { trial: false, starter: true, professional: true, enterprise: true } },
      { key: "aiSuggestions", cells: { trial: false, starter: false, professional: true, enterprise: true } },
      { key: "aiRemediation", cells: { trial: false, starter: false, professional: true, enterprise: true } },
      { key: "purpleTeam", cells: { trial: false, starter: false, professional: true, enterprise: true } },
      { key: "ldap", cells: { trial: false, starter: false, professional: true, enterprise: true } },
    ],
  },
  {
    key: "access",
    rows: [
      { key: "api", cells: { trial: false, starter: false, professional: true, enterprise: true } },
      { key: "sso", cells: { trial: false, starter: false, professional: false, enterprise: true } },
      { key: "priority", cells: { trial: false, starter: true, professional: true, enterprise: true } },
    ],
  },
];

const PLAN_LABEL: Record<Plan, string> = {
  trial: "Free Trial",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

const PLAN_PRICE: Record<Plan, string> = {
  trial: "$0",
  starter: "$29",
  professional: "$99",
  enterprise: "$349",
};

export default function PricingPage() {
  const t = useTranslations("pricingPage");
  const locale = useLocale();
  const lp = (path: string) => `/${locale}${path}`;

  /**
   * A cell is either a mark or a value. Marks use a check and a dash rather
   * than a check and a cross: a cross reads as a failure, a dash reads as
   * "this tier does not carry it", which is what is actually being said.
   */
  const renderCell = (value: Cell, unit?: Row["unit"]) => {
    if (value === true) {
      return (
        <span className="inline-flex" title={t("compare.included")}>
          <Check size={17} className="text-[var(--color-neon)]" aria-label={t("compare.included")} />
        </span>
      );
    }
    if (value === false) {
      return (
        <span className="inline-flex" title={t("compare.notIncluded")}>
          <Minus size={17} className="text-white/18" aria-label={t("compare.notIncluded")} />
        </span>
      );
    }
    if (value === "unlimited") {
      return <span className="text-[var(--color-cyan)]">{t("compare.unlimited")}</span>;
    }
    if (value === "allTools") {
      return <span className="text-white/80">{t("compare.values.allTools")}</span>;
    }
    if (value === "trialScans") {
      return <span className="text-white/80">{t("compare.values.trialScans")}</span>;
    }
    return (
      <span className="font-mono tabular-nums text-white/80">
        {unit === "perMonth" ? t("compare.values.perMonth", { n: value }) : value}
      </span>
    );
  };

  const TRUST = [
    { key: "residency", Icon: ShieldCheck },
    { key: "credentials", Icon: KeyRound },
    { key: "cancel", Icon: CreditCard },
    { key: "refund", Icon: Undo2 },
  ] as const;

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)] px-4 pb-10 pt-28 md:pt-36">
        {/* A single soft neon wash, off-centre, so the section has depth
            without a full decorative hero competing with the plan cards. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-[0.07] blur-[110px]"
          style={{ background: "var(--color-neon)" }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full border border-[var(--color-neon)]/25 bg-[var(--color-neon)]/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-neon)]">
            {t("badge")}
          </span>
          <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.08] text-white md:text-5xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty leading-relaxed text-white/55">
            {t("subtitle")}
          </p>
          <p className="mt-4 font-mono text-xs text-[var(--color-neon)]/70">{t("annualNote")}</p>
        </div>
      </section>

      {/* ── Plan cards: the existing section, not a second implementation ── */}
      <PricingSection />

      {/* ── The matrix ───────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--color-border)] px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <RevealOnScroll>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance text-3xl font-extrabold text-white md:text-4xl">
                {t("compare.title")}
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-white/45">
                {t("compare.subtitle")}
              </p>
            </div>
          </RevealOnScroll>

          {/* Own scroll container: the page body must never scroll sideways. */}
          <div className="mt-12 overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <caption className="sr-only">{t("compare.title")}</caption>
              <thead>
                {/* Sticky so the plan names stay visible: eighteen rows is far
                    enough to scroll that an unlabelled column is a real
                    question rather than a theoretical one. */}
                <tr className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-[0_1px_0_var(--color-border)]">
                  <th
                    scope="col"
                    className="sticky left-0 z-30 bg-[var(--color-bg-secondary)] px-5 py-5 text-left font-mono text-[11px] uppercase tracking-[0.16em] text-white/35"
                  >
                    {t("compare.plan")}
                  </th>
                  {PLANS.map((p) => (
                    <th
                      key={p}
                      scope="col"
                      className={`px-5 py-5 text-center align-bottom ${
                        p === "professional" ? "bg-[var(--color-neon)]/[0.045]" : ""
                      }`}
                    >
                      <span
                        className={`block text-sm font-bold ${
                          p === "professional" ? "text-[var(--color-neon)]" : "text-white/85"
                        }`}
                      >
                        {PLAN_LABEL[p]}
                      </span>
                      <span className="mt-1 block font-mono text-xs tabular-nums text-white/35">
                        {PLAN_PRICE[p]}
                        {p !== "trial" ? "/mo" : ""}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              {MATRIX.map((group) => (
                <tbody key={group.key}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={PLANS.length + 1}
                      className="sticky left-0 z-10 bg-[var(--color-bg)] px-5 pb-2 pt-7 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-neon)]/60"
                    >
                      {t(`compare.groups.${group.key}`)}
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr
                      key={row.key}
                      className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.015]"
                    >
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-[var(--color-bg-secondary)] px-5 py-3.5 text-left font-normal text-white/60"
                      >
                        {t(`compare.rows.${row.key}`)}
                      </th>
                      {PLANS.map((p) => (
                        <td
                          key={p}
                          className={`px-5 py-3.5 text-center ${
                            p === "professional" ? "bg-[var(--color-neon)]/[0.045]" : ""
                          }`}
                        >
                          {renderCell(row.cells[p], row.unit)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--color-border)] px-4 py-16">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ key, Icon }) => (
            <RevealOnScroll key={key}>
              <div className="h-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
                <Icon size={18} className="text-[var(--color-neon)]" />
                <h3 className="mt-3 text-sm font-bold text-white">{t(`trust.${key}.t`)}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-white/40">{t(`trust.${key}.d`)}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--color-border)] px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <RevealOnScroll>
            <h2 className="text-center text-3xl font-extrabold text-white md:text-4xl">
              {t("faq.title")}
            </h2>
          </RevealOnScroll>
          <div className="mt-10 flex flex-col gap-3">
            {(t.raw("faq.items") as { q: string; a: string }[]).map((item) => (
              <RevealOnScroll key={item.q}>
                <details className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 transition-colors open:border-[var(--color-neon)]/20 hover:border-white/10">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-sm font-semibold text-white/85 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      aria-hidden
                      className="shrink-0 font-mono text-lg leading-none text-[var(--color-neon)]/50 transition-transform duration-200 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-5 pr-8 text-sm leading-relaxed text-white/50">{item.a}</p>
                </details>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ── Close ────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--color-border)] px-4 py-20">
        <RevealOnScroll>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-extrabold text-white">{t("ctaTitle")}</h2>
            <p className="mx-auto mt-4 max-w-lg text-pretty leading-relaxed text-white/50">
              {t("ctaBody")}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a href="/dashboard/register" className="btn-primary text-sm">
                {t("ctaButton")}
              </a>
              <a
                href={lp("/contact/")}
                className="text-sm text-white/55 underline-offset-4 transition hover:text-[var(--color-neon)] hover:underline"
              >
                {t("ctaSecondary")}
              </a>
            </div>
            <p className="mt-6 font-mono text-xs text-white/25">
              <Email address="info@cyber-sec-pro.com" />
            </p>
          </div>
        </RevealOnScroll>
      </section>
    </>
  );
}
