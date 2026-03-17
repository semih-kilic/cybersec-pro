"use client";

import { useEffect, useRef } from "react";

/**
 * CyberRadar — a rotating radar sweep with blips, pulse rings, and threat detection.
 * Pure canvas 2D, no Three.js dependency.
 */
export default function CyberRadar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    let angle = 0;
    let w = 0, h = 0;
    const blips: { x: number; y: number; life: number; maxLife: number; type: string }[] = [];
    const pulses: { r: number; opacity: number }[] = [];

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const threatColors: Record<string, string> = {
      critical: "#ff3333",
      high: "#ff6600",
      medium: "#ffcc00",
      low: "#9fef00",
      info: "#00d4ff",
    };
    const types = Object.keys(threatColors);

    const draw = () => {
      ctx.fillStyle = "rgba(10, 14, 20, 0.08)";
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5;
      const cy = h * 0.55;
      const maxR = Math.min(w, h) * 0.35;

      // Grid circles
      ctx.strokeStyle = "rgba(159, 239, 0, 0.06)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * (i / 5), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Cross lines
      ctx.strokeStyle = "rgba(159, 239, 0, 0.04)";
      ctx.beginPath();
      ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
      ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
      ctx.stroke();

      // Sweep cone
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR, angle - 0.5, angle);
      ctx.closePath();
      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      sweepGrad.addColorStop(0, "rgba(159, 239, 0, 0.4)");
      sweepGrad.addColorStop(1, "rgba(159, 239, 0, 0)");
      ctx.fillStyle = sweepGrad;
      ctx.fill();
      ctx.restore();

      // Sweep line
      ctx.save();
      ctx.strokeStyle = "#9fef00";
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
      ctx.stroke();
      ctx.restore();

      // Spawn blips
      if (Math.random() < 0.03) {
        const dist = Math.random() * maxR * 0.9;
        const a = Math.random() * Math.PI * 2;
        blips.push({
          x: cx + Math.cos(a) * dist,
          y: cy + Math.sin(a) * dist,
          life: 0,
          maxLife: 120 + Math.random() * 100,
          type: types[Math.floor(Math.random() * types.length)],
        });
      }

      // Draw blips
      for (let i = blips.length - 1; i >= 0; i--) {
        const b = blips[i];
        b.life++;
        if (b.life > b.maxLife) { blips.splice(i, 1); continue; }
        const alpha = 1 - b.life / b.maxLife;
        const color = threatColors[b.type];
        ctx.save();
        ctx.globalAlpha = alpha;
        // Glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
        // Pulse ring
        if (b.life < 30) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.globalAlpha = alpha * (1 - b.life / 30);
          ctx.beginPath();
          ctx.arc(b.x, b.y, 3 + b.life * 0.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Pulse rings from center
      if (Math.random() < 0.008) {
        pulses.push({ r: 0, opacity: 0.4 });
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.r += 1.5;
        p.opacity -= 0.003;
        if (p.opacity <= 0) { pulses.splice(i, 1); continue; }
        ctx.save();
        ctx.strokeStyle = `rgba(159, 239, 0, ${p.opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Center dot
      ctx.save();
      ctx.shadowColor = "#9fef00";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#9fef00";
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      angle += 0.015;
      requestAnimationFrame(draw);
    };

    const raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 opacity-50"
      aria-hidden="true"
    />
  );
}
