import React from 'react';
import { useAudioEngine } from '../audio/AudioEngineProvider';

const MetronomePanel: React.FC = () => {
  const {
    bpm,
    setBpm,
    metronomeOn,
    startMetronome,
    stopMetronome,
    metronomeVolume,
    setMetronomeVolume,
  } = useAudioEngine();

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
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Metrónomo</h2>

      <label style={{ fontSize: '0.9rem' }}>
        Tempo: {bpm} BPM
        <input
          type="range"
          min={0}
          max={250}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </label>

      <label
        style={{
          fontSize: '0.9rem',
          marginTop: '0.75rem',
          display: 'block',
        }}
      >
        Volumen: {Math.round(metronomeVolume * 100)}%
        <input
          type="range"
          min={0}
          max={0.5} // límite para que nunca sea exagerado
          step={0.01}
          value={metronomeVolume}
          onChange={(e) => setMetronomeVolume(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </label>

      <button
        type="button"
        onClick={metronomeOn ? stopMetronome : startMetronome}
        style={{
          marginTop: '0.75rem',
          padding: '0.5rem 1.25rem',
          borderRadius: '999px',
          border: 'none',
          cursor: 'pointer',
          background: metronomeOn ? '#22c55e' : '#2563eb',
          color: '#fff',
          fontWeight: 600,
        }}
      >
        {metronomeOn ? 'Metronome ON' : 'Metronome OFF'}
      </button>
    </section>
  );
};

export default MetronomePanel;
