import React, { useEffect, useRef } from 'react';

type Props = {
  analyser: AnalyserNode | null;
  enabled: boolean;
  width?: number;      // si no lo pasás, usa el ancho del contenedor
  height?: number;
  bars?: number;       // cantidad de “bloques”
  glow?: number;
  color?: string;      // no hace falta, pero lo dejamos configurable
  bg?: string;
};

const LiveBarsWaveform: React.FC<Props> = ({
  analyser,
  enabled,
  height = 36,
  bars = 44,
  glow = 10,
  color = '#ef4444',
  bg = 'transparent',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : 360;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    return () => ro.disconnect();
  }, [height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawIdle = () => {
      const w = canvas.clientWidth;
      ctx.clearRect(0, 0, w, height);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, height);
    };

    if (!enabled || !analyser) {
      drawIdle();
      return;
    }

    analyser.fftSize = 1024;
    const buffer = new Uint8Array(analyser.fftSize);

    const loop = () => {
      const w = canvas.clientWidth;
      ctx.clearRect(0, 0, w, height);

      // fondo
      if (bg !== 'transparent') {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, height);
      }

      analyser.getByteTimeDomainData(buffer);

      // Convertimos time-domain -> “energía” por bloque
      const step = Math.floor(buffer.length / bars);
      const barW = w / bars;
      const gap = Math.max(1, Math.floor(barW * 0.18));
      const usableW = barW - gap;

      // estilo barra
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
      ctx.fillStyle = color;

      for (let i = 0; i < bars; i++) {
        let sum = 0;

        // energía del segmento (RMS aproximado)
        const start = i * step;
        const end = start + step;

        for (let j = start; j < end; j++) {
          const v = (buffer[j] - 128) / 128; // -1..1
          sum += v * v;
        }
        const rms = Math.sqrt(sum / step); // 0..~1

        // le damos una curva para que “respire” más lindo
        const strength = Math.pow(rms, 0.65);

        // altura de barra (mínimo para que siempre haya vida)
        const barH = Math.max(2, strength * height);

        const x = i * barW + gap / 2;
        const y = (height - barH) / 2;

        // barra con bordes redondeados
        const r = Math.min(6, usableW / 2);
        roundRect(ctx, x, y, usableW, barH, r);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [analyser, enabled, bars, height, glow, color, bg]);

  return <canvas ref={canvasRef} />;
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default LiveBarsWaveform;
