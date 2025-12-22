// src/components/LiveWaveform.tsx
import React, { useEffect, useMemo, useRef } from "react";

type LiveWaveformProps = {
  analyser: AnalyserNode | null;
  enabled: boolean;
  width?: number | string;   // ej "100%" o 520
  height?: number;           // ej 42
  color?: string;            // ej "#ff7a18"
  fillAlpha?: number;        // 0..1
  lineWidth?: number;        // ej 2.5
  glow?: number;             // ej 10
  background?: string;       // ej "rgba(2,6,23,0.35)"
  borderRadius?: number;     // ej 12
  amplitudePx?: number;
};

const LiveWaveform: React.FC<LiveWaveformProps> = ({
  analyser,
  enabled,
  width = "100%",
  height = 46,
  color = "#ff7a18",
  fillAlpha = 0.22,
  lineWidth = 2.4,
  glow = 10,
  background = "rgba(2,6,23,0.35)",
  borderRadius = 12,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const data = useMemo(() => {
    if (!analyser) return null;
    // time domain -> onda
    return new Uint8Array(analyser.fftSize);
  }, [analyser]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      const cssW =
        typeof width === "number"
          ? width
          : parent?.getBoundingClientRect().width ?? 600;

      const cssH = height;

      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.style.width = typeof width === "number" ? `${width}px` : "100%";
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    };

    const draw = () => {
      const cssW =
        typeof width === "number"
          ? width
          : (canvas.parentElement?.getBoundingClientRect().width ?? 600);
      const cssH = height;

      // fondo
      ctx.clearRect(0, 0, cssW, cssH);
      roundRect(0, 0, cssW, cssH, borderRadius);
      ctx.fillStyle = background;
      ctx.fill();

      // si no está activo, solo fondo
      if (!enabled || !analyser || !data) {
        raf = requestAnimationFrame(draw);
        return;
      }

      analyser.getByteTimeDomainData(data);

      // path onda
      const midY = cssH / 2;
      const padX = 10;
      const usableW = cssW - padX * 2;

      ctx.save();
      roundRect(0, 0, cssW, cssH, borderRadius);
      ctx.clip();

      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;

      // Línea
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      for (let i = 0; i < data.length; i++) {
        const t = i / (data.length - 1);
        const x = padX + t * usableW;

        // 0..255 => -1..1
        const v = (data[i] - 128) / 128;
        const y = midY + v * (cssH * 0.36);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Fill bajo curva
      ctx.shadowBlur = 0; // el fill queda más prolijo sin glow fuerte
      ctx.lineTo(padX + usableW, midY);
      ctx.lineTo(padX, midY);
      ctx.closePath();
      ctx.fillStyle = withAlpha(color, fillAlpha);
      ctx.fill();

      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [analyser, enabled, width, height, color, fillAlpha, lineWidth, glow, background, borderRadius, data]);

  return (
    <div style={{ width: typeof width === "number" ? `${width}px` : "100%" }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

function withAlpha(hexOrRgb: string, alpha: number) {
  // si viene rgb/rgba lo dejo
  if (hexOrRgb.startsWith("rgb")) return hexOrRgb;
  // hex #rrggbb
  const hex = hexOrRgb.replace("#", "");
  if (hex.length !== 6) return hexOrRgb;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default LiveWaveform;
