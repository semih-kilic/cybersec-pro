"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { useState, useRef } from "react";
import { Play, Square } from "lucide-react";

const SCAN_LINES = [
  { text: "$ nmap -sV -sC scanme.nmap.org", type: "cmd" as const, delay: 0 },
  { text: "", type: "blank" as const, delay: 400 },
  { text: "Starting Nmap 7.94 ( https://nmap.org )", type: "info" as const, delay: 600 },
  { text: "Nmap scan report for scanme.nmap.org", type: "info" as const, delay: 1000 },
  { text: "Host is up (0.045s latency).", type: "info" as const, delay: 1200 },
  { text: "", type: "blank" as const, delay: 1400 },
  { text: "PORT   STATE SERVICE VERSION", type: "header" as const, delay: 1600 },
  { text: "22/tcp open  ssh     OpenSSH 6.6p1", type: "info" as const, delay: 1800 },
  { text: "80/tcp open  http    Apache httpd 2.4.7", type: "info" as const, delay: 2000 },
  { text: "", type: "blank" as const, delay: 2200 },
  { text: "Nmap done: 1 IP address (1 host up)", type: "success" as const, delay: 2400 },
];

const LINE_COLORS: Record<string, string> = {
  cmd: "text-[var(--color-neon)]",
  info: "text-white/70",
  found: "text-[var(--color-cyan)]",
  warn: "text-[var(--color-orange)]",
  critical: "text-[var(--color-red)]",
  success: "text-[var(--color-neon)]",
  header: "text-white/90 font-bold",
  blank: "",
};

export default function DemoSection() {
  const t = useTranslations("demo");
  const [lines, setLines] = useState<typeof SCAN_LINES>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [tool, setTool] = useState("nmap");
  const [target, setTarget] = useState("scanme.nmap.org");
  const terminalRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const startScan = () => {
    setLines([]);
    setIsRunning(true);
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    SCAN_LINES.forEach((line, i) => {
      const tid = setTimeout(() => {
        setLines((prev) => [...prev, line]);
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
        if (i === SCAN_LINES.length - 1) setIsRunning(false);
      }, line.delay);
      timeoutsRef.current.push(tid);
    });
  };

  return (
    <section className="relative py-28 bg-white/5">
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-extrabold text-white md:text-4xl lg:text-5xl">{t("title")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/50">{t("subtitle")}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="neon-border-card overflow-hidden"
        >
          <div className="border-b border-white/5 bg-black/40 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
                  <div className="h-3 w-3 rounded-full bg-[#28c840]" />
                </div>
                <span className="font-mono text-xs text-white/40">cybersec-pro — demo terminal</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={tool}
                  onChange={(e) => setTool(e.target.value)}
                  placeholder={t("toolPlaceholder")}
                  className="rounded-md border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-xs text-white/70 placeholder:text-white/30 focus:border-[var(--color-neon-dim)] focus:outline-none"
                />
                <input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={t("targetPlaceholder")}
                  className="rounded-md border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-xs text-white/70 placeholder:text-white/30 focus:border-[var(--color-neon-dim)] focus:outline-none"
                />
                <button
                  onClick={startScan}
                  disabled={isRunning}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 font-mono text-xs text-white/50 transition hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)] disabled:opacity-30"
                >
                  {isRunning ? <Square size={10} /> : <Play size={10} />}
                  {isRunning ? t("scanning") : t("runScan")}
                </button>
              </div>
            </div>
          </div>

          <div
            ref={terminalRef}
            className="h-[420px] overflow-y-auto bg-[#0a0e14] p-4 font-mono text-[13px] leading-6"
          >
            {lines.length === 0 && !isRunning && (
              <div className="flex h-full items-center justify-center text-white/20">
                Click &quot;Run Scan&quot; to start demo...
              </div>
            )}
            {lines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className={LINE_COLORS[line.type]}
              >
                {line.text || "\u00A0"}
              </motion.div>
            ))}
            {isRunning && (
              <span className="inline-block h-4 w-2 bg-[var(--color-neon)]" style={{ animation: "terminalBlink 1s infinite" }} />
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
