import { useEffect, useRef } from 'react';

/**
 * Subtle cyber pulse grid background for dashboard pages.
 * Hex grid with pulse waves — pure Canvas 2D.
 */
export default function CyberPulseBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let w = 0, h = 0;
    let frame = 0;

    const hexagons: { x: number; y: number; size: number; pulse: number; speed: number }[] = [];
    const waves: { r: number; opacity: number }[] = [];

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      hexagons.length = 0;
      const hexSize = 45;
      const dx = hexSize * 1.75;
      const dy = hexSize * 1.5;
      for (let row = -1; row < h / dy + 1; row++) {
        for (let col = -1; col < w / dx + 1; col++) {
          const x = col * dx + (row % 2 ? dx / 2 : 0);
          const y = row * dy;
          if (Math.random() < 0.35) {
            hexagons.push({ x, y, size: hexSize * 0.4, pulse: Math.random() * Math.PI * 2, speed: 0.015 + Math.random() * 0.015 });
          }
        }
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const drawHex = (x: number, y: number, r: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + r * Math.cos(a);
        const py = y + r * Math.sin(a);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    const draw = () => {
      frame++;
      ctx.fillStyle = 'rgba(10, 14, 20, 0.06)';
      ctx.fillRect(0, 0, w, h);

      for (const hex of hexagons) {
        hex.pulse += hex.speed;
        const alpha = 0.015 + Math.sin(hex.pulse) * 0.01;
        ctx.strokeStyle = `rgba(0, 200, 255, ${alpha})`;
        ctx.lineWidth = 0.5;
        drawHex(hex.x, hex.y, hex.size);
        ctx.stroke();
      }

      if (frame % 20 === 0 && hexagons.length > 0) {
        const h2 = hexagons[Math.floor(Math.random() * hexagons.length)];
        ctx.fillStyle = 'rgba(0, 200, 255, 0.05)';
        drawHex(h2.x, h2.y, h2.size);
        ctx.fill();
      }

      if (Math.random() < 0.008) {
        waves.push({ r: 0, opacity: 0.2 });
      }

      const cx = w / 2, cy = h / 2;
      for (let i = waves.length - 1; i >= 0; i--) {
        const wave = waves[i];
        wave.r += 1.5;
        wave.opacity -= 0.0015;
        if (wave.opacity <= 0) { waves.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(0, 200, 255, ${wave.opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, wave.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      requestAnimationFrame(draw);
    };

    const raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 opacity-25"
      aria-hidden="true"
    />
  );
}
