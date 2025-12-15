// src/ui/OfflineSitarPanel.tsx
import React, { useState } from 'react';
import { useAudioEngine } from '../audio/AudioEngineProvider';

const OfflineSitarPanel: React.FC = () => {
  const {
    processFileThroughSitar,
    playProcessed,
    exportProcessed,
  } = useAudioEngine();

  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  return (
    <section
      style={{
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '1rem 1.5rem',
        maxWidth: '260px',
        width: '100%',
        background: '#050816',
        marginTop: '1rem',
      }}
    >
      <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
        5. Procesar audio (offline)
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
        }}
      >
        {isProcessing ? 'Procesando...' : 'Aplicar Sitar Amp'}
      </button>

      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'space-between',
        }}
      >
        <button
          type="button"
          onClick={playProcessed}
          style={{
            flex: 1,
            padding: '0.35rem 0.6rem',
            borderRadius: '999px',
            border: '1px solid #334155',
            background: '#0f172a',
            color: '#e5e7eb',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          Escuchar
        </button>

        <button
          type="button"
          onClick={exportProcessed}
          style={{
            flex: 1,
            padding: '0.35rem 0.6rem',
            borderRadius: '999px',
            border: '1px solid #334155',
            background: '#0f172a',
            color: '#e5e7eb',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          Exportar WAV
        </button>
      </div>
    </section>
  );
};

export default OfflineSitarPanel;
