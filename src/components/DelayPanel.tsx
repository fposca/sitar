import React from 'react';
import { useAudioEngine } from '../audio/AudioEngineProvider';

const DelayPanel: React.FC = () => {
  const {
    delayTimeMs,
    setDelayTimeMs,
    feedbackAmount,
    setFeedbackAmount,
    mixAmount,
    setMixAmount,
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
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>3. Delay</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label style={{ fontSize: '0.9rem' }}>
          Delay time: {delayTimeMs} ms
          <input
            type="range"
            min={50}
            max={1000}
            value={delayTimeMs}
            onChange={(e) => setDelayTimeMs(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </label>

        <label style={{ fontSize: '0.9rem' }}>
          Feedback: {feedbackAmount.toFixed(2)}
          <input
            type="range"
            min={0}
            max={0.9}
            step={0.01}
            value={feedbackAmount}
            onChange={(e) => setFeedbackAmount(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </label>

        <label style={{ fontSize: '0.9rem' }}>
          Mix (wet): {mixAmount.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={mixAmount}
            onChange={(e) => setMixAmount(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </label>
      </div>
    </section>
  );
};

export default DelayPanel;
