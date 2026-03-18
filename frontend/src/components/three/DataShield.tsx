"use client";

import { useEffect, useRef } from "react";

/**
 * DataShield — scrolling binary streams + shield outline + scanning line
 * Pure canvas 2D. Use for terms/legal pages.
 */
export default function DataShield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let w = 0, h = 0;
    let frame = 0;
    let animId: number;

    interface Column { x: number; chars: string[]; speed: number; opacity: number }
    let columns: Column[] = [];

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      columns = [];
      const gap = 28;
      for (let x = 0; x < w; x += gap) {
        const len = 8 + Math.floor(Math.random() * 12);
        const chars: string[] = [];
        for (let i = 0; i < len; i++) chars.push(Math.random() > 0.5 ? "1" : "0");
        columns.push({ x, chars, speed: 0.3 + Math.random() * 0.7, opacity: 0.04 + Math.random() * 0.06 });
      }
    };
    resize();

    const drawShield = (cx: number, cy: number, size: number, alpha: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.bezierCurveTo(size * 0.6, -size * 0.8, size, -size * 0.3, size, 0);
      ctx.bezierCurveTo(size, size * 0.5, size * 0.4, size * 0.85, 0, size);
      ctx.bezierCurveTo(-size * 0.4, size * 0.85, -size, size * 0.5, -size, 0);
      ctx.bezierCurveTo(-size, -size * 0.3, -size * 0.6, -size * 0.8, 0, -size);
      ctx.closePath();
      ctx.strokeStyle = `rgba(159, 239, 0, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    };

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0, 0, w, h);
      frame++;

      // Binary columns
      ctx.font = "12px monospace";
      for (const col of columns) {
        const baseY = ((frame * col.speed) % (h + 200)) - 100;
        for (let i = 0; i < col.chars.length; i++) {
          const y = baseY + i * 16;
          if (y < -20 || y > h + 20) continue;
          const fade = i === 0 ? col.opacity * 2 : col.opacity * (1 - i / col.chars.length);
          ctx.fillStyle = `rgba(159, 239, 0, ${fade})`;
          ctx.fillText(col.chars[i], col.x, y);
        }
      }

      // Shield
      const pulse = Math.sin(frame * 0.015) * 0.02 + 0.08;
      drawShield(w / 2, h / 2, Math.min(w, h) * 0.18, pulse);
      drawShield(w / 2, h / 2, Math.min(w, h) * 0.22, pulse * 0.5);

      // Scanning line
      const scanY = ((frame * 0.8) % h);
      const grad = ctx.createLinearGradient(0, scanY - 2, 0, scanY + 2);
      grad.addColorStop(0, "rgba(159, 239, 0, 0)");
      grad.addColorStop(0.5, "rgba(159, 239, 0, 0.06)");
      grad.addColorStop(1, "rgba(159, 239, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 20, w, 40);

      animId = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: 0.7 }}
    />
  );
}
