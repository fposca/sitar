// src/ui/OfflineSitarPanel.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useAudioEngine } from '../audio/AudioEngineProvider';

type WaveformDisplayProps = {
  waveform: number[] | null;
  progress: number; // 0..1 – progreso del preview
};

const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  waveform,
  progress,
}) => {
  if (!waveform || waveform.length === 0) {
    return (
      <div
        style={{
          height: 90,
          borderRadius: 8,
          background: '#020617',
          border: '1px solid #1f2937',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem',
          color: '#e5e7eb',
          marginBottom: '0.75rem',
          textAlign: 'center',
          padding: '0 0.5rem',
        }}
      >
        Procesá un archivo con el Sitar Amp para ver la forma de onda.
      </div>
    );
  }

  const bars = useMemo(() => {
    const targetBars = 120;
    const step = Math.max(1, Math.floor(waveform.length / targetBars));
    const result: number[] = [];

    for (let i = 0; i < waveform.length; i += step) {
      let peak = 0;
      for (let j = i; j < i + step && j < waveform.length; j++) {
        const v = Math.abs(waveform[j]);
        if (v > peak) peak = v;
      }
      result.push(peak);
    }

    return result;
  }, [waveform]);

  const clampedProgress = Math.max(0, Math.min(1, progress));

  return (
    <div
      style={{
        position: 'relative',
        height: 90,
        borderRadius: 8,
        background: '#020617',
        border: '1px solid #1f2937',
        overflow: 'hidden',
        padding: '6px 4px',
        marginBottom: '0.75rem',
      }}
    >
      {/* línea central */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: 1,
          background: '#111827',
        }}
      />

      {/* barras */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          height: '100%',
        }}
      >
        {bars.map((v, i) => {
          const clamped = Math.max(0, Math.min(1, v));
          const h = 10 + clamped * 80;

          return (
            <div
              key={i}
              style={{
                width: 3,
                margin: '0 1px',
                alignSelf: 'center',
                height: `${h}%`,
                borderRadius: 999,
                background:
                  'linear-gradient(180deg, #f97316 0%, #fb923c 40%, #f97316 100%)',
                boxShadow: '0 0 8px rgba(249, 115, 22, 0.7)',
              }}
            />
          );
        })}

        {/* cursor de reproducción */}
        <div
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            width: 2,
            left: `${clampedProgress * 100}%`,
            background: '#f97316',
            boxShadow: '0 0 8px rgba(249,115,22,0.9)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
};

const OfflineSitarPanel: React.FC = () => {
  const {
    processFileThroughSitar,
    playProcessed,
    stopProcessed,
    exportProcessed,
    processedWaveform,
    offlineVolume,
    setOfflineVolume,
    offlinePreviewProgress, // 👈 viene del contexto
  } = useAudioEngine();

  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    console.log('processedWaveform length:', processedWaveform?.length ?? 0);
  }, [processedWaveform]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      await processFileThroughSitar(file);
    } finally {
      setIsProcessing(false);
    }
  };

  const hasProcessed = !!processedWaveform && processedWaveform.length > 0;

  return (
    <section
      style={{
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '1rem 1.5rem',
        maxWidth: '340px',
        width: '100%',
        background: '#050816',
        marginTop: '1rem',
      }}
    >
      <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
        Procesar audio (offline)
      </h2>

      <label
        style={{
          display: 'block',
          fontSize: '0.85rem',
          marginBottom: '0.5rem',
        }}
      >
        Subí un audio (guitarra limpia, voz, etc.) y aplicale el Sitar Amp:
      </label>

      <input
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        style={{ width: '100%', marginBottom: '0.75rem' }}
      />

      <button
        type="button"
        disabled={!file || isProcessing}
        onClick={handleProcess}
        style={{
          width: '100%',
          padding: '0.45rem 0.8rem',
          borderRadius: '999px',
          border: 'none',
          cursor: !file || isProcessing ? 'default' : 'pointer',
          background: isProcessing ? '#4b5563' : '#f97316',
          color: '#fff',
          fontSize: '0.9rem',
          fontWeight: 600,
          marginBottom: '0.75rem',
          boxShadow: isProcessing
            ? 'none'
            : '0 0 12px rgba(249, 115, 22, 0.6)',
        }}
      >
        {isProcessing ? 'Procesando...' : 'Aplicar Sitar Amp'}
      </button>

      {/* gráfico + cursor */}
      <WaveformDisplay
        waveform={processedWaveform}
        progress={offlinePreviewProgress}
      />

      {/* Volumen de preview */}
      <div
        style={{
          marginBottom: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          fontSize: '0.75rem',
          color: '#9ca3af',
        }}
      >
        <span>Volumen preview</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={offlineVolume}
          onChange={(e) => setOfflineVolume(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Controles */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          justifyContent: 'space-between',
        }}
      >
        <button
          type="button"
          onClick={playProcessed}
          disabled={!hasProcessed}
          style={{
            flex: 1,
            padding: '0.35rem 0.6rem',
            borderRadius: '999px',
            border: hasProcessed ? 'none' : '1px solid #1f2937',
            background: hasProcessed ? '#f97316' : '#1f2937',
            color: hasProcessed ? '#fff' : '#4b5563',
            fontSize: '0.8rem',
            cursor: hasProcessed ? 'pointer' : 'default',
            boxShadow: hasProcessed
              ? '0 0 8px rgba(249, 115, 22, 0.6)'
              : 'none',
          }}
        >
          ▶ Escuchar
        </button>

        <button
          type="button"
          onClick={stopProcessed}
          disabled={!hasProcessed}
          style={{
            flex: 1,
            padding: '0.35rem 0.6rem',
            borderRadius: '999px',
            border: hasProcessed ? 'none' : '1px solid #1f2937',
            background: hasProcessed ? '#b91c1c' : '#1f2937',
            color: hasProcessed ? '#fff' : '#4b5563',
            fontSize: '0.8rem',
            cursor: hasProcessed ? 'pointer' : 'default',
            boxShadow: hasProcessed
              ? '0 0 8px rgba(248, 113, 113, 0.6)'
              : 'none',
          }}
        >
          ⏹ Detener
        </button>

        <button
          type="button"
          onClick={exportProcessed}
          disabled={!hasProcessed}
          style={{
            flex: 1.2,
            padding: '0.35rem 0.6rem',
            borderRadius: '999px',
            border: hasProcessed ? 'none' : '1px solid #1f2937',
            background: hasProcessed ? '#0f766e' : '#1f2937',
            color: hasProcessed ? '#e5e7eb' : '#4b5563',
            fontSize: '0.8rem',
            cursor: hasProcessed ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem',
            boxShadow: hasProcessed
              ? '0 0 8px rgba(45, 212, 191, 0.5)'
              : 'none',
          }}
        >
          ⬇ Exportar WAV
        </button>
      </div>
    </section>
  );
};

export default OfflineSitarPanel;
