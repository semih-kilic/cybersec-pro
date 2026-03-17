"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const faqKeys = ["q1", "q2", "q3", "q4", "q5"] as const;

export default function FaqSection() {
  const t = useTranslations("faq");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="relative py-28">
      <div className="mx-auto max-w-3xl px-6">
        <RevealOnScroll className="section-heading mb-16">
          <span className="badge mb-4">{t("badge")}</span>
          <h2>{t("title")}</h2>
        </RevealOnScroll>

        <div className="flex flex-col gap-3">
          {faqKeys.map((key, i) => (
            <RevealOnScroll key={key}>
              <div className="glass-card overflow-hidden">
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                >
                  <span className="text-sm font-semibold text-white">{t(`items.${key}.q`)}</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-white/40 transition-transform ${openIndex === i ? "rotate-180" : ""}`}
                  />
                </button>
                <AnimatePresence>
                  {openIndex === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-sm leading-relaxed text-white/50">{t(`items.${key}.a`)}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
