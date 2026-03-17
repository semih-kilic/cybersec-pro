"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export default function GlitchText({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const handleMouseEnter = () => {
      gsap.to(el, {
        skewX: 3,
        duration: 0.1,
        yoyo: true,
        repeat: 3,
        ease: "power2.inOut",
        onComplete: () => gsap.set(el, { skewX: 0 }),
      });
    };
    el.addEventListener("mouseenter", handleMouseEnter);
    return () => el.removeEventListener("mouseenter", handleMouseEnter);
  }, []);

  return (
    <span ref={ref} className={className} data-text={text}>
      {text}
    </span>
  );
}
