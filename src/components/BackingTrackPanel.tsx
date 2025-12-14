import React, { useEffect, useRef } from 'react';
import { useAudioEngine } from '../audio/AudioEngineProvider';


const BackingTrackPanel: React.FC = () => {
  const { loadBackingFile, hasBacking, backingWaveform, backingName, playbackProgress, backingVolume, setBackingVolume } =
    useAudioEngine();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadBackingFile(file);
    }
  };

  // Dibuja forma de onda + cursor
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !backingWaveform || backingWaveform.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Fondo
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Línea base
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Forma de onda
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1;

    const len = backingWaveform.length;

    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * width;
      const v = backingWaveform[i];
      const h = v * (height * 0.9);
      const yTop = midY - h / 2;
      const yBottom = midY + h / 2;

      ctx.moveTo(x, yTop);
      ctx.lineTo(x, yBottom);
    }
    ctx.stroke();

    // Cursor de reproducción
    if (playbackProgress > 0 && playbackProgress <= 1) {
      const xCursor = playbackProgress * width;

      ctx.strokeStyle = '#f97316'; // naranja brillante
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xCursor, 0);
      ctx.lineTo(xCursor, height);
      ctx.stroke();
    }
  }, [backingWaveform, playbackProgress]);

  return (
    <section
      style={{
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '1rem 1.5rem',
        maxWidth: '600px',
        width: '100%',
        background: '#0b1020',
      }}
    >
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>1. Backing track</h2>

      <input type="file" accept="audio/*" onChange={handleChange} />
      {hasBacking && (
        <>
          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
            Backing listo ✅{' '}
            {backingName && (
              <span style={{ opacity: 0.8 }}>({backingName.replace(/\.[^/.]+$/, '')})</span>
            )}
          </p>

          <div
            style={{
              marginTop: '0.75rem',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #1f2937',
              background: '#020617',
            }}
          >
            <canvas
              ref={canvasRef}
              width={560}
              height={80}
              style={{
                display: 'block',
              }}
            />
          </div>
           <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.9rem' }}>
        Volumen backing: {(backingVolume * 100).toFixed(0)}%
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={backingVolume}
          onChange={(e) => setBackingVolume(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </label>
        </>
      )}
      
    </section>
  );
};

export default BackingTrackPanel;
