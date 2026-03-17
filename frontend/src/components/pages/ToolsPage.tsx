"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { Search, Terminal, Play } from "lucide-react";

const categories = [
  "All", "Network", "Web", "Exploitation", "Wireless", "Forensics", "Password",
  "Reverse Engineering", "Sniffing", "Fuzzing", "Reporting", "Information Gathering",
];

const allTools = [
  { name: "Nmap", category: "Network", description: "Network discovery and security auditing", cmd: "nmap -sV -sC" },
  { name: "SQLMap", category: "Web", description: "Automatic SQL injection and database takeover", cmd: "sqlmap -u url --dbs" },
  { name: "Metasploit", category: "Exploitation", description: "Penetration testing framework", cmd: "msfconsole -q" },
  { name: "Burp Suite", category: "Web", description: "Web vulnerability scanner and proxy", cmd: "burpsuite" },
  { name: "Hydra", category: "Password", description: "Fast network logon cracker", cmd: "hydra -l user -P list" },
  { name: "Nikto", category: "Web", description: "Web server scanner", cmd: "nikto -h target" },
  { name: "Gobuster", category: "Web", description: "URI/DNS/vhost brute-forcer", cmd: "gobuster dir -u url" },
  { name: "John the Ripper", category: "Password", description: "Password cracker", cmd: "john --wordlist hash" },
  { name: "Aircrack-ng", category: "Wireless", description: "802.11 WEP/WPA/WPA2 cracker", cmd: "aircrack-ng capture" },
  { name: "Wireshark", category: "Sniffing", description: "Network protocol analyzer", cmd: "wireshark" },
  { name: "Hashcat", category: "Password", description: "Advanced password recovery", cmd: "hashcat -m 0 -a 0" },
  { name: "Maltego", category: "Information Gathering", description: "Open source intelligence", cmd: "maltego" },
  { name: "Autopsy", category: "Forensics", description: "Digital forensics platform", cmd: "autopsy" },
  { name: "Ghidra", category: "Reverse Engineering", description: "Software reverse engineering suite", cmd: "ghidra" },
  { name: "Dirb", category: "Web", description: "Web content scanner", cmd: "dirb url wordlist" },
  { name: "Amass", category: "Information Gathering", description: "Network mapping & subdomain enum", cmd: "amass enum -d domain" },
  { name: "WFuzz", category: "Fuzzing", description: "Web application fuzzer", cmd: "wfuzz -c -z file,list" },
  { name: "Volatility", category: "Forensics", description: "Memory forensics framework", cmd: "vol.py -f dump" },
];

export default function ToolsPage() {
  const t = useTranslations("tools");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = useMemo(() => {
    return allTools.filter((tool) => {
      const matchSearch = tool.name.toLowerCase().includes(search.toLowerCase()) ||
        tool.description.toLowerCase().includes(search.toLowerCase());
      const matchCategory = category === "All" || tool.category === category;
      return matchSearch && matchCategory;
    });
  }, [search, category]);

  return (
    <>
      <section className="relative pb-8 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">{t("badge")}</span>
          <h1 className="text-4xl font-extrabold md:text-6xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-lg text-white/55">{t("subtitle")}</p>
        </RevealOnScroll>
      </section>

      {/* Search & Filter */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-[var(--color-neon-dim)]"
            />
          </div>
        </div>

        {/* Category bar */}
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                category === cat
                  ? "bg-[var(--color-neon)] text-[var(--color-bg)]"
                  : "border border-white/10 text-white/50 hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)]"
              }`}
            >
              {cat === "All" ? t("allCategories") : cat}
            </button>
          ))}
        </div>
      </section>

      {/* Tools Grid */}
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-28 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((tool) => (
          <div key={tool.name} className="glass-card group flex flex-col gap-3 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">{tool.name}</h3>
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-white/40">{tool.category}</span>
            </div>
            <p className="text-sm text-white/50">{tool.description}</p>
            <div className="flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-[var(--color-neon)]/70">
              <Terminal size={12} className="shrink-0 text-white/30" />
              <code>{tool.cmd}</code>
            </div>
            <button className="btn-primary mt-1 justify-center py-2 text-xs opacity-0 transition-opacity group-hover:opacity-100">
              <Play size={12} /> {t("runTool")}
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-white/40">
            No tools found matching your search.
          </div>
        )}
      </section>
    </>
  );
}
