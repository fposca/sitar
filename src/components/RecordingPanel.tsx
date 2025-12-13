import React from 'react';
import { useAudioEngine } from '../audio/AudioEngineProvider';

const RecordingPanel: React.FC = () => {
  const { isRecording, startPlaybackAndRecording, stopRecording } = useAudioEngine();

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
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          type="button"
          onClick={startPlaybackAndRecording}
          disabled={isRecording}
          style={{
            padding: '0.5rem 1.2rem',
            borderRadius: '999px',
            border: 'none',
            cursor: isRecording ? 'not-allowed' : 'pointer',
            background: '#ef4444',
            color: '#fff',
            fontWeight: 600,
          }}
        >
          ▶️ Play + Rec
        </button>
        <button
          type="button"
          onClick={stopRecording}
          disabled={!isRecording}
          style={{
            padding: '0.5rem 1.2rem',
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
        Al parar, se descarga automáticamente <strong>neon-sitar-take.wav</strong>.
      </p>
    </section>
  );
};

export default RecordingPanel;
