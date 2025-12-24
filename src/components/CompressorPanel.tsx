// src/components/CompressorPanel.tsx
import React from 'react';
import { useAudioEngine } from '../audio/AudioEngineProvider';

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

const CompressorPanel: React.FC = () => {
  const {
    compressorEnabled, setCompressorEnabled,
    compressorThreshold, setCompressorThreshold,
    compressorRatio, setCompressorRatio,
    compressorAttack, setCompressorAttack,
    compressorRelease, setCompressorRelease,
    compressorKnee, setCompressorKnee,
    compressorMakeup, setCompressorMakeup,
    compressorMix, setCompressorMix,
  } = useAudioEngine();

  return (
    <div style={panelStyle}>
      <div style={rowStyle}>
        <div style={{ fontWeight: 700 }}>Compressor</div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <span style={{ fontSize: 12, opacity: 0.85 }}>{compressorEnabled ? 'On' : 'Off'}</span>
          <input
            type="checkbox"
            checked={compressorEnabled}
            onChange={(e) => setCompressorEnabled(e.target.checked)}
          />
        </label>
      </div>

      <div style={labelStyle}>Threshold ({Math.round(compressorThreshold)} dB)</div>
      <input
        style={sliderStyle}
        type="range"
        min={-60}
        max={0}
        step={1}
        value={compressorThreshold}
        onChange={(e) => setCompressorThreshold(Number(e.target.value))}
        disabled={!compressorEnabled}
      />

      <div style={labelStyle}>Ratio ({compressorRatio.toFixed(1)}:1)</div>
      <input
        style={sliderStyle}
        type="range"
        min={1}
        max={20}
        step={0.1}
        value={compressorRatio}
        onChange={(e) => setCompressorRatio(Number(e.target.value))}
        disabled={!compressorEnabled}
      />

      <div style={labelStyle}>Attack ({Math.round(compressorAttack * 1000)} ms)</div>
      <input
        style={sliderStyle}
        type="range"
        min={0.001}
        max={0.2}
        step={0.001}
        value={compressorAttack}
        onChange={(e) => setCompressorAttack(Number(e.target.value))}
        disabled={!compressorEnabled}
      />

      <div style={labelStyle}>Release ({Math.round(compressorRelease * 1000)} ms)</div>
      <input
        style={sliderStyle}
        type="range"
        min={0.03}
        max={1.0}
        step={0.01}
        value={compressorRelease}
        onChange={(e) => setCompressorRelease(Number(e.target.value))}
        disabled={!compressorEnabled}
      />

      <div style={labelStyle}>Knee ({Math.round(compressorKnee)} dB)</div>
      <input
        style={sliderStyle}
        type="range"
        min={0}
        max={40}
        step={1}
        value={compressorKnee}
        onChange={(e) => setCompressorKnee(Number(e.target.value))}
        disabled={!compressorEnabled}
      />

      <div style={labelStyle}>Makeup ({compressorMakeup.toFixed(2)}x)</div>
      <input
        style={sliderStyle}
        type="range"
        min={0}
        max={2}
        step={0.01}
        value={compressorMakeup}
        onChange={(e) => setCompressorMakeup(Number(e.target.value))}
        disabled={!compressorEnabled}
      />

      <div style={labelStyle}>Mix ({Math.round(compressorMix * 100)}%)</div>
      <input
        style={sliderStyle}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={compressorMix}
        onChange={(e) => setCompressorMix(Number(e.target.value))}
        disabled={!compressorEnabled}
      />
    </div>
  );
};

export default CompressorPanel;
