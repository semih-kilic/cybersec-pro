"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { Terminal, Play, Square } from "lucide-react";

const SCAN_LINES = [
  { text: "$ cybersec-pro scan --tool nmap --target 10.0.0.0/24", type: "cmd" as const, delay: 0 },
  { text: "", type: "blank" as const, delay: 600 },
  { text: "Starting Nmap 7.94 ( https://nmap.org )", type: "info" as const, delay: 800 },
  { text: "Scanning 256 hosts [1000 ports/host]", type: "info" as const, delay: 1200 },
  { text: "", type: "blank" as const, delay: 1400 },
  { text: "Discovered open port 22/tcp on 10.0.0.1", type: "found" as const, delay: 1800 },
  { text: "Discovered open port 80/tcp on 10.0.0.1", type: "found" as const, delay: 2200 },
  { text: "Discovered open port 443/tcp on 10.0.0.1", type: "found" as const, delay: 2600 },
  { text: "Discovered open port 3306/tcp on 10.0.0.5", type: "warn" as const, delay: 3000 },
  { text: "Discovered open port 8080/tcp on 10.0.0.12", type: "found" as const, delay: 3400 },
  { text: "Discovered open port 21/tcp on 10.0.0.15", type: "critical" as const, delay: 3800 },
  { text: "Discovered open port 445/tcp on 10.0.0.15", type: "critical" as const, delay: 4200 },
  { text: "", type: "blank" as const, delay: 4400 },
  { text: "PORT     STATE    SERVICE       VERSION", type: "header" as const, delay: 4600 },
  { text: "22/tcp   open     ssh           OpenSSH 8.9p1", type: "info" as const, delay: 4800 },
  { text: "80/tcp   open     http          nginx 1.24.0", type: "info" as const, delay: 5000 },
  { text: "443/tcp  open     ssl/http      nginx 1.24.0", type: "info" as const, delay: 5200 },
  { text: "3306/tcp open     mysql         MySQL 8.0.35", type: "warn" as const, delay: 5400 },
  { text: "8080/tcp open     http-proxy    Apache Tomcat 9.0", type: "info" as const, delay: 5600 },
  { text: "21/tcp   open     ftp           vsftpd 3.0.3", type: "critical" as const, delay: 5800 },
  { text: "445/tcp  open     microsoft-ds  Samba smbd 4.17", type: "critical" as const, delay: 6000 },
  { text: "", type: "blank" as const, delay: 6200 },
  { text: "Nmap done: 256 IP addresses (18 hosts up) scanned in 12.34 seconds", type: "success" as const, delay: 6400 },
  { text: "", type: "blank" as const, delay: 6600 },
  { text: "┌─ FINDINGS SUMMARY ─────────────────────────────────┐", type: "info" as const, delay: 6800 },
  { text: "│  ● 2 Critical   │ FTP exposed, SMB exposed         │", type: "critical" as const, delay: 7000 },
  { text: "│  ▲ 1 High       │ MySQL publicly accessible        │", type: "warn" as const, delay: 7200 },
  { text: "│  ■ 4 Medium     │ Standard service detections       │", type: "info" as const, delay: 7400 },
  { text: "└──────────────────────────────────────────────────────┘", type: "info" as const, delay: 7600 },
  { text: "", type: "blank" as const, delay: 7800 },
  { text: "Report generated → /reports/scan-2026-04-13-nmap.pdf", type: "success" as const, delay: 8000 },
];

const LINE_COLORS = {
  cmd: "text-[var(--color-neon)]",
  info: "text-white/60",
  found: "text-[var(--color-cyan)]",
  warn: "text-[var(--color-orange)]",
  critical: "text-[var(--color-red)]",
  success: "text-[var(--color-neon)]",
  header: "text-white/80 font-bold",
  blank: "",
};

export default function TerminalDemo() {
  const t = useTranslations("terminal");
  const [lines, setLines] = useState<typeof SCAN_LINES>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const startScan = () => {
    setLines([]);
    setIsRunning(true);
    setHasRun(true);
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    SCAN_LINES.forEach((line, i) => {
      const tid = setTimeout(() => {
        setLines(prev => [...prev, line]);
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
        if (i === SCAN_LINES.length - 1) setIsRunning(false);
      }, line.delay);
      timeoutsRef.current.push(tid);
    });
  };

  // Auto-start when visible
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !hasRun) startScan();
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRun]);

  return (
    <section className="relative py-28">
      <div ref={containerRef} className="mx-auto max-w-4xl px-6">
        <RevealOnScroll className="mb-12 text-center">
          <h2 className="text-3xl font-extrabold text-white md:text-4xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/50">
            {t("subtitle")}
          </p>
        </RevealOnScroll>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="neon-border-card overflow-hidden"
        >
          {/* Terminal header */}
          <div className="flex items-center justify-between border-b border-white/5 bg-black/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <div className="h-3 w-3 rounded-full bg-[#28c840]" />
              </div>
              <span className="flex items-center gap-1.5 font-mono text-xs text-white/40">
                <Terminal size={12} /> cybersec-pro — nmap scan
              </span>
            </div>
            <button
              onClick={startScan}
              disabled={isRunning}
              className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1 font-mono text-xs text-white/50 transition hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)] disabled:opacity-30"
            >
              {isRunning ? <Square size={10} /> : <Play size={10} />}
              {isRunning ? "Running..." : "Run Scan"}
            </button>
          </div>

          {/* Terminal body */}
          <div
            ref={terminalRef}
            className="h-[420px] overflow-y-auto bg-[#0a0e14] p-4 font-mono text-[13px] leading-6"
          >
            {lines.length === 0 && !isRunning && (
              <div className="flex h-full items-center justify-center text-white/20">
                Click &quot;Run Scan&quot; or scroll here to start demo...
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
