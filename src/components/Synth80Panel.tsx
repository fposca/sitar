import React from 'react';
import { useAudioEngine } from '../audio/AudioEngineProvider';
import type { SynthWave } from '../audio/audioTypes';

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 12,
};

const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.8, marginTop: 10 };
const panelStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const sliderStyle: React.CSSProperties = { width: '100%' };

const Synth80Panel: React.FC = () => {
  const {
    synthEnabled, setSynthEnabled,
    synthWave, setSynthWave,
    synthLevel, setSynthLevel,
    synthMix, setSynthMix,
    synthAttack, setSynthAttack,
    synthRelease, setSynthRelease,
    synthDetune, setSynthDetune,
  } = useAudioEngine();

  return (
    <div style={panelStyle}>
      <div style={rowStyle}>
        <div style={{ fontWeight: 700 }}>Synth-80</div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <span style={{ fontSize: 12, opacity: 0.85 }}>{synthEnabled ? 'On' : 'Off'}</span>
          <input
            type="checkbox"
            checked={synthEnabled}
            onChange={(e) => setSynthEnabled(e.target.checked)}
          />
        </label>
      </div>

      <div style={labelStyle}>Wave</div>
      <select
        value={synthWave}
        onChange={(e) => setSynthWave(e.target.value as SynthWave)}
        disabled={!synthEnabled}
        style={{ width: '100%', padding: 8, borderRadius: 10, background: 'rgba(0,0,0,0.25)', color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <option value="square">Square</option>
        <option value="sawtooth">Saw</option>
        <option value="triangle">Triangle</option>
      </select>

      <div style={labelStyle}>Level ({Math.round(synthLevel * 100)}%)</div>
      <input
        style={sliderStyle}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={synthLevel}
        onChange={(e) => setSynthLevel(Number(e.target.value))}
        disabled={!synthEnabled}
      />

      <div style={labelStyle}>Mix ({Math.round(synthMix * 100)}%)</div>
      <input
        style={sliderStyle}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={synthMix}
        onChange={(e) => setSynthMix(Number(e.target.value))}
        disabled={!synthEnabled}
      />

      <div style={labelStyle}>Attack ({Math.round(synthAttack * 1000)} ms)</div>
      <input
        style={sliderStyle}
        type="range"
        min={0.001}
        max={0.2}
        step={0.001}
        value={synthAttack}
        onChange={(e) => setSynthAttack(Number(e.target.value))}
        disabled={!synthEnabled}
      />

      <div style={labelStyle}>Release ({Math.round(synthRelease * 1000)} ms)</div>
      <input
        style={sliderStyle}
        type="range"
        min={0.03}
        max={1.5}
        step={0.01}
        value={synthRelease}
        onChange={(e) => setSynthRelease(Number(e.target.value))}
        disabled={!synthEnabled}
      />

      <div style={labelStyle}>Detune ({Math.round(synthDetune)} cents)</div>
      <input
        style={sliderStyle}
        type="range"
        min={0}
        max={30}
        step={1}
        value={synthDetune}
        onChange={(e) => setSynthDetune(Number(e.target.value))}
        disabled={!synthEnabled}
      />
    </div>
  );
};

export default Synth80Panel;
