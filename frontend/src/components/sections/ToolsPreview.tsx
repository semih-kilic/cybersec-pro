"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { ArrowRight, Terminal } from "lucide-react";

const sampleTools = [
  { name: "Nmap", category: "Network Scanner", cmd: "nmap -sV -sC target" },
  { name: "SQLMap", category: "SQL Injection", cmd: "sqlmap -u url --dbs" },
  { name: "Nuclei", category: "Vulnerability Scan", cmd: "nuclei -u url -severity high,critical" },
  { name: "WPScan", category: "WordPress Scan", cmd: "wpscan --url url" },
  { name: "Hydra", category: "Brute Force", cmd: "hydra -l user -P list target" },
  { name: "Nikto", category: "Web Scanner", cmd: "nikto -h target" },
  { name: "Gobuster", category: "Directory Scan", cmd: "gobuster dir -u url -w list" },
  { name: "John the Ripper", category: "Password Crack", cmd: "john --wordlist hash" },
  { name: "Aircrack-ng", category: "Wireless", cmd: "aircrack-ng capture.cap" },
];

export default function ToolsPreview() {
  const t = useTranslations("tools");

  return (
    <section id="tools" className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <RevealOnScroll className="section-heading mb-16">
          <span className="badge mb-4">{t("badge")}</span>
          <h2>{t("title")}</h2>
          <p>{t("subtitle")}</p>
        </RevealOnScroll>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sampleTools.map((tool) => (
            <RevealOnScroll key={tool.name}>
              <div className="glass-card group flex flex-col gap-3 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white">{tool.name}</h3>
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-white/40">
                    {tool.category}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-[var(--color-neon)]/70">
                  <Terminal size={12} className="shrink-0 text-white/30" />
                  <code>{tool.cmd}</code>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary mt-1 flex-1 justify-center py-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    {t("runTool")}
                  </button>
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/tools" className="btn-outline">
            {t("viewDetails")} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
