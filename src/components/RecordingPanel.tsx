import React, { useEffect, useState } from 'react';
import { useAudioEngine } from '../audio/AudioEngineProvider';

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const RecordingPanel: React.FC = () => {
  const {
    isRecording,
    startPlaybackAndRecording,
    stopRecording,
    recordingSeconds,
  } = useAudioEngine();

  const [blinkOn, setBlinkOn] = useState(true);

  // Parpadeo del puntito rojo sólo mientras graba
  useEffect(() => {
    if (!isRecording) {
      setBlinkOn(true);
      return;
    }
    const id = window.setInterval(() => {
      setBlinkOn((prev) => !prev);
    }, 500);
    return () => clearInterval(id);
  }, [isRecording]);

  const minutes = Math.floor(recordingSeconds / 60);
  const seconds = recordingSeconds % 60;
  const timeLabel = `${pad2(minutes)}:${pad2(seconds)}`;

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
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>4. Grabación</h2>

      {/* Barra de estado REC */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
          minHeight: '24px',
        }}
      >
        {/* Puntito rojo */}
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            opacity: isRecording ? (blinkOn ? 1 : 0.25) : 0,
            transition: 'opacity 0.2s',
          }}
        />
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '0.95rem',
            color: isRecording ? '#f97373' : '#888',
            letterSpacing: 1,
          }}
        >
          {isRecording ? `REC ${timeLabel}` : 'REC 00:00'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          type="button"
          onClick={startPlaybackAndRecording}
          disabled={isRecording}
          style={{
            padding: '0.6rem 1.6rem',
            borderRadius: '999px',
            border: 'none',
            cursor: isRecording ? 'not-allowed' : 'pointer',
            background: isRecording ? '#7f1d1d' : '#ef4444',
            color: '#fff',
            fontWeight: 700,
            letterSpacing: 1,
            boxShadow: isRecording
              ? '0 0 0 0'
              : '0 0 10px rgba(239,68,68,0.5)',
            opacity: isRecording ? 0.6 : 1,
          }}
        >
          ● REC
        </button>
        <button
          type="button"
          onClick={stopRecording}
          disabled={!isRecording}
          style={{
            padding: '0.6rem 1.6rem',
            borderRadius: '999px',
            border: '1px solid #999',
            cursor: !isRecording ? 'not-allowed' : 'pointer',
            background: 'transparent',
            color: '#fff',
            fontWeight: 600,
          }}
        >
          ⏹ Stop
        </button>
      </div>

      <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', opacity: 0.8 }}>
        Al parar, se descarga automáticamente{' '}
        <strong>neon-sitar-take.wav</strong>.
      </p>
    </section>
  );
};

export default RecordingPanel;
