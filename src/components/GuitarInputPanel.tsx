import React from 'react';
import { useAudioEngine } from '../audio/AudioEngineProvider';

const GuitarInputPanel: React.FC = () => {
  const { setupGuitarInput, isInputReady } = useAudioEngine();

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
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>2. Entrada de guitarra</h2>
      <button
        type="button"
        onClick={setupGuitarInput}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '999px',
          border: 'none',
          cursor: 'pointer',
          background: isInputReady ? '#1f8f4d' : '#2563eb',
          color: '#fff',
          fontWeight: 600,
        }}
      >
        {isInputReady ? 'Entrada lista ✅' : 'Configurar entrada'}
      </button>
    </section>
  );
};

export default GuitarInputPanel;
