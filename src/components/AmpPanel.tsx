// src/components/AmpPanel.tsx
import React from 'react';
import { useAudioEngine, type SitarMode } from '../audio/AudioEngineProvider';
import neonImg from '../assets/nea.png';
import input from '../assets/input.png';

const labelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  opacity: 0.8,
};

const valueStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  opacity: 0.75,
  color: '#111827',
};

type KnobProps = {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  display: string;
};

const Knob: React.FC<KnobProps> = ({ label, min, max, value, onChange, display }) => {
  const percent = (value - min) / (max - min);

  return (
    <div
      style={{
        minWidth: 90,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.35rem',
      }}
    >
      <span style={{ ...labelStyle, color: '#111827' }}>{label}</span>

      {/* knob visual */}
      <div
        style={{
          position: 'relative',
          width: 46,
          height: 46,
          borderRadius: '999px',
          background:
            'radial-gradient(circle at 30% 20%, #ffffff 0, #e5e7eb 35%, #9ca3af 100%)',
          boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* indicador */}
        <div
          style={{
            width: 4,
            height: 16,
            borderRadius: 999,
            background: '#111827',
            transformOrigin: '50% 80%',
            transform: `rotate(${percent * 270 - 135}deg)`,
            transition: 'transform 0.15s linear',
          }}
        />
        {/* input range invisible pero funcional */}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0,
            cursor: 'pointer',
          }}
        />
      </div>

      <span style={valueStyle}>{display}</span>
    </div>
  );
};

const AmpPanel: React.FC = () => {
  const {
    ampGain,
    setAmpGain,
    ampTone,
    setAmpTone,
    ampMaster,
    setAmpMaster,
    delayEnabled,
    setDelayEnabled,
    sitarAmount,
    setSitarAmount,
    driveAmount,
    setDriveAmount,
    driveEnabled,
    setDriveEnabled,
    reverbAmount,
    setReverbAmount,
    sitarMode,
    setSitarMode,
    // 👇 acá traemos también el monitor desde el contexto
    monitorEnabled,
    setMonitorEnabled,
  } = useAudioEngine();

  const modeLabels: Record<SitarMode, string> = {
    sharp: 'SHARP',
    major: 'MAJOR',
    minor: 'MINOR',
    exotic: 'EXOTIC',
  };

  return (
    <section
      style={{
        borderRadius: '24px',
        border: '1px solid #111827',
        padding: '1.75rem 1.5rem 1.25rem',
        background: '#020617',
        boxShadow: '0 26px 50px rgba(0,0,0,0.65)',
        minHeight: '340px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flex: 1,
        minWidth: 420,
      }}
    >
      {/* Barra superior tipo plugin */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              opacity: 0.6,
            }}
          >
            NeonBoy
          </div>
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            Sitar Amp
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <div
            style={{
              padding: '0.25rem 0.7rem',
              borderRadius: '999px',
              border: '1px solid #4b5563',
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: '#020617',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '999px',
                background: '#22c55e',
                boxShadow: '0 0 10px #22c55e',
              }}
            />
            Standby
          </div>
        </div>
      </div>

      {/* Cabezál + mesa */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Mesa de madera */}
        

        {/* Amp head */}
        <div
          style={{
            marginTop: -2,
            marginInline: '1.5rem',
            width: '100%',
            maxWidth:'1500px',
            borderRadius: '18px',
            overflow: 'hidden',
            border: '2px solid #020617',
            background:
              'linear-gradient(180deg,#1f2937 0,#020617 40%,#020617 100%)',
          }}
        >
          {/* Manija superior */}
          <div
            style={{
              height: 22,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 4,
            }}
          >
            <div
              style={{
                width: 120,
                height: 10,
                borderRadius: '999px',
                background: '#020617',
                boxShadow: '0 2px 6px rgba(0,0,0,0.8)',
              }}
            />
          </div>

          {/* Frente del amp */}
          <div
            style={{
              display: 'grid',
              gridTemplateRows: 'minmax(220px, 1fr) auto',
              background: '#020617',
            }}
          >
            {/* Rejilla / grill */}
            <div
              style={{
                background:
                  'linear-gradient(135deg,#000 0,#000 40%,#000 100%)',
                display: 'flex',
                height: '638px',
                alignItems: 'stretch',
                justifyContent: 'center',
                padding: '10px 18px 6px',
              }}
            >
              <div
                style={{
                  flex: 1,
                  backgroundImage: `url(${neonImg})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
            </div>

            {/* Panel de controles beige */}
            <div
              style={{
                backgroundImage: `url(${input})`,
                backgroundSize: 'cover',
                padding: '0.75rem 1.1rem 0.8rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.7rem',
              }}
            >
              {/* Preset + logo */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.3rem',
                }}
              >
                <div>
                  <div style={{ ...labelStyle, color: '#4b5563' }}>Preset</div>
                  <div
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: '#111827',
                    }}
                  >
                    Neon Raga
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>
                    Sitar ambience
                  </div>
                </div>

                <div
                  style={{
                    alignSelf: 'flex-end',
                    padding: '0.1rem 0.5rem',
                    borderRadius: '999px',
                    border: '1px solid #111827',
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.18em',
                    color: '#111827',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '999px',
                      background: '#111827',
                    }}
                  />
                  NB • SITAR
                </div>

                {/* Botón de monitor */}
                <button
                  type="button"
                  onClick={() => setMonitorEnabled(!monitorEnabled)}
                  style={{
                    padding: '8px 14px',
                    background: monitorEnabled ? '#10b981' : '#ef4444',
                    color: 'white',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                  }}
                >
                  {monitorEnabled ? 'Monitor ON' : 'Monitor OFF'}
                </button>
              </div>

              {/* Modos de sitar */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.4rem',
                  marginBottom: '0.4rem',
                }}
              >
                {(Object.keys(modeLabels) as SitarMode[]).map((mode) => {
                  const active = sitarMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSitarMode(mode)}
                      style={{
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.65rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        borderRadius: 999,
                        border: active ? '1px solid #1d4ed8' : '1px solid #d4d4d8',
                        background: active
                          ? 'linear-gradient(90deg,#60a5fa,#2563eb)'
                          : '#f4f4f5',
                        color: active ? '#f9fafb' : '#111827',
                        cursor: 'pointer',
                      }}
                    >
                      {modeLabels[mode]}
                    </button>
                  );
                })}
              </div>

              {/* Controles (knobs) */}
              <div
                style={{
                  display: 'flex',
                  gap: '1.8rem',
                  justifyContent: 'flex-start',
                  flexWrap: 'wrap',
                }}
              >
                <Knob
                  label="Gain"
                  min={0}
                  max={200}
                  value={ampGain * 100}
                  onChange={(v) => setAmpGain(v / 100)}
                  display={ampGain.toFixed(2)}
                />

                <Knob
                  label="Tone"
                  min={0}
                  max={100}
                  value={ampTone * 100}
                  onChange={(v) => setAmpTone(v / 100)}
                  display={`${Math.round(ampTone * 10)}/10`}
                />

                <Knob
                  label="Sitar"
                  min={0}
                  max={100}
                  value={sitarAmount * 100}
                  onChange={(v) => setSitarAmount(v / 100)}
                  display={`${Math.round(sitarAmount * 100)}%`}
                />

                <Knob
                  label="Master"
                  min={0}
                  max={200}
                  value={ampMaster * 100}
                  onChange={(v) => setAmpMaster(v / 100)}
                  display={ampMaster.toFixed(2)}
                />

                <Knob
                  label="Drive"
                  min={0}
                  max={100}
                  value={driveAmount * 100}
                  onChange={(v) => setDriveAmount(v / 100)}
                  display={`${Math.round(driveAmount * 100)}%`}
                />

                <Knob
                  label="Reverb"
                  min={0}
                  max={100}
                  value={reverbAmount * 100}
                  onChange={(v) => setReverbAmount(v / 100)}
                  display={`${Math.round(reverbAmount * 100)}%`}
                />
              </div>

              {/* Footswitches */}
              <div
                style={{
                  marginTop: '0.8rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                {/* Drive ON/OFF */}
                <button
                  type="button"
                  onClick={() => setDriveEnabled(!driveEnabled)}
                  style={{
                    padding: '0.35rem 1.4rem',
                    borderRadius: '999px',
                    border: 'none',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.16em',
                    background: driveEnabled ? '#111827' : '#6b7280',
                    color: '#f9fafb',
                    cursor: 'pointer',
                    boxShadow: driveEnabled
                      ? '0 0 10px rgba(15,23,42,0.8)'
                      : 'none',
                  }}
                >
                  {driveEnabled ? 'Drive On' : 'Drive Off'}
                </button>

                {/* Delay footswitch */}
                <button
                  type="button"
                  onClick={() => setDelayEnabled(!delayEnabled)}
                  style={{
                    padding: '0.45rem 1.4rem',
                    borderRadius: '999px',
                    border: delayEnabled ? '1px solid #16a34a' : '1px solid #9ca3af',
                    background: delayEnabled
                      ? 'radial-gradient(circle at 30% 0,#4ade80 0,#16a34a 50%,#166534 100%)'
                      : 'transparent',
                    color: delayEnabled ? '#022c22' : '#111827',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.16em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    cursor: 'pointer',
                    boxShadow: delayEnabled
                      ? '0 0 18px rgba(34,197,94,0.7)'
                      : 'none',
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '999px',
                      background: delayEnabled ? '#bbf7d0' : '#9ca3af',
                    }}
                  />
                  {delayEnabled ? 'Delay On' : 'Delay Off'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AmpPanel;
