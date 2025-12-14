// src/components/AmpPanel.tsx
import React, { useState } from 'react';
import { useAudioEngine, type SitarMode } from '../audio/AudioEngineProvider';

// CLEAN (rosa)
import cleanFrontImg from '../assets/nea.png';
import cleanPanelImg from '../assets/input.png';

// LEAD (equipo oscuro)
import leadFrontImg from '../assets/nea-lead.png';
import leadPanelImg from '../assets/input-lead.png';

// INFERNAL (equipo oscuro rosa)
import infernalFrontImg from '../assets/nea-infernal.png';
import infernalPanelImg from '../assets/input-infernal.png';

const labelBase: React.CSSProperties = {
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  opacity: 0.8,
};

const valueBase: React.CSSProperties = {
  fontSize: '0.7rem',
  opacity: 0.75,
};

type KnobProps = {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  display: string;
  labelColor: string;
  valueColor: string;
  faceGradient: string;
};

const Knob: React.FC<KnobProps> = ({
  label,
  min,
  max,
  value,
  onChange,
  display,
  labelColor,
  valueColor,
  faceGradient,
}) => {
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
      <span style={{ ...labelBase, color: labelColor }}>{label}</span>

      {/* knob visual */}
      <div
        style={{
          position: 'relative',
          width: 46,
          height: 46,
          borderRadius: '999px',
          background: faceGradient,
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

      <span style={{ ...valueBase, color: valueColor }}>{display}</span>
    </div>
  );
};

/* ---------- PRESETS ---------- */

type PresetId = 'cleanMystic' | 'desertLead' | 'infernalRaga';

type PresetSettings = {
  ampGain: number;
  ampTone: number;
  ampMaster: number;
  bassAmount: number;
  midAmount: number;
  trebleAmount: number;
  presenceAmount: number;
  driveAmount: number;
  driveEnabled: boolean;
  delayEnabled: boolean;
  delayTimeMs: number;
  feedbackAmount: number;
  mixAmount: number;
  reverbAmount: number;
  sitarAmount: number;
  sitarMode: SitarMode;
};

const PRESETS: Record<
  PresetId,
  {
    label: string;
    description: string;
    settings: PresetSettings;
  }
> = {
  cleanMystic: {
    label: 'Clean Mystic',
    description: 'Clean brillante, sitar suave, espacio amplio.',
    settings: {
      ampGain: 0.9,
      ampTone: 0.55,
      ampMaster: 1.0,
      bassAmount: 0.55,
      midAmount: 0.45,
      trebleAmount: 0.6,
      presenceAmount: 0.55,
      driveAmount: 0.18,
      driveEnabled: false,
      delayEnabled: true,
      delayTimeMs: 380,
      feedbackAmount: 0.28,
      mixAmount: 0.32,
      reverbAmount: 0.5,
      sitarAmount: 0.35,
      sitarMode: 'major',
    },
  },
  desertLead: {
    label: 'Desert Lead',
    description: 'Lead vocal, medios adelante, delay cantado.',
    settings: {
      ampGain: 1.25,
      ampTone: 0.62,
      ampMaster: 1.2,
      bassAmount: 0.5,
      midAmount: 0.65,
      trebleAmount: 0.6,
      presenceAmount: 0.65,
      driveAmount: 0.58,
      driveEnabled: true,
      delayEnabled: true,
      delayTimeMs: 460,
      feedbackAmount: 0.38,
      mixAmount: 0.42,
      reverbAmount: 0.4,
      sitarAmount: 0.25,
      sitarMode: 'sharp',
    },
  },
  infernalRaga: {
    label: 'Infernal Raga',
    description: 'Modo exotic al palo, mucha presencia y cola.',
    settings: {
      ampGain: 1.5,
      ampTone: 0.7,
      ampMaster: 1.3,
      bassAmount: 0.48,
      midAmount: 0.6,
      trebleAmount: 0.75,
      presenceAmount: 0.8,
      driveAmount: 0.8,
      driveEnabled: true,
      delayEnabled: true,
      delayTimeMs: 520,
      feedbackAmount: 0.45,
      mixAmount: 0.55,
      reverbAmount: 0.6,
      sitarAmount: 0.6,
      sitarMode: 'exotic',
    },
  },
};

/* ---------- SKINS VISUALES POR PRESET ---------- */

const SKINS: Record<
  PresetId,
  {
    frontImg: string;
    panelImg: string;
    grillBg: string;

    // perillas
    knobLabelColor: string;
    knobValueColor: string;
    knobFaceGradient: string;

    // modos SHARP / MAJOR / MINOR / EXOTIC
    modeActiveBg: string;
    modeActiveBorder: string;
    modeActiveColor: string;
    modeInactiveBg: string;
    modeInactiveColor: string;

    // tarjeta de preset
    presetPanelBg: string;
    presetLabelColor: string;
    presetNameColor: string;
    presetDescColor: string;

    // chips de preset
    presetChipActiveBg: string;
    presetChipActiveBorder: string;
    presetChipActiveColor: string;
    presetChipInactiveBg: string;
    presetChipInactiveBorder: string;
    presetChipInactiveColor: string;

    // badge NB • SITAR
    nbBadgeBg: string;
    nbBadgeBorder: string;
    nbBadgeTextColor: string;
    nbBadgeDotBg: string;

    // botones de monitor
    monitorOnBg: string;
    monitorOffBg: string;
    monitorTextColor: string;

    // botones de drive
    driveOnBg: string;
    driveOffBg: string;
    driveTextColor: string;

    // botón de delay
    delayOnBg: string;
    delayOffBg: string;
    delayOnBorder: string;
    delayOffBorder: string;
    delayOnDotBg: string;
    delayOffDotBg: string;
    delayOnTextColor: string;
    delayOffTextColor: string;

    // sombras unificadas controles (monitor / drive / delay)
    controlOnShadow: string;
    controlOffShadow: string;
  }
> = {
  cleanMystic: {
    frontImg: cleanFrontImg,
    panelImg: cleanPanelImg,
    grillBg: '#f2d8d4', // rosa claro

    knobLabelColor: '#111827',
    knobValueColor: '#111827',
    knobFaceGradient:
      'radial-gradient(circle at 30% 20%, #ffffff 0, #ffe4e6 35%, #f9a8d4 100%)',

    modeActiveBg: 'linear-gradient(90deg,#fb37ff,#ec4899)',
    modeActiveBorder: '1px solid #fb37ff',
    modeActiveColor: '#f9fafb',
    modeInactiveBg: '#ffe4e6',
    modeInactiveColor: '#111827',

    presetPanelBg: '#edd9cdb8',
    presetLabelColor: '#fb37ff',
    presetNameColor: '#f700ff',
    presetDescColor: '#131313ff',

    presetChipActiveBg: 'linear-gradient(90deg,#fb37ff,#ec4899)',
    presetChipActiveBorder: '1px solid #fb37ff',
    presetChipActiveColor: '#f9fafb',
    presetChipInactiveBg: '#111827aa',
    presetChipInactiveBorder: '1px solid #9ca3af',
    presetChipInactiveColor: '#e5e7eb',

    nbBadgeBg: '#ffd3e680',
    nbBadgeBorder: '1px solid #ff02c8ff',
    nbBadgeTextColor: '#ffffffff',
    nbBadgeDotBg: '#ff4fd8',

    monitorOnBg: '#fe98d1',
    monitorOffBg: '#e5e7eb',
    monitorTextColor: '#111827',

    driveOnBg: '#fe98d1',
    driveOffBg: '#d3d3d3ff',
    driveTextColor: '#f9fafb',

    // delay verde clásico en el clean
    delayOnBg:
      'radial-gradient(circle at 30% 0,#4ade80 0,#16a34a 50%,#166534 100%)',
    delayOffBg: 'transparent',
    delayOnBorder: '1px solid #16a34a',
    delayOffBorder: '1px solid #9ca3af',
    delayOnDotBg: '#bbf7d0',
    delayOffDotBg: '#9ca3af',
    delayOnTextColor: '#022c22',
    delayOffTextColor: '#111827',

    controlOnShadow: '0 0 14px rgba(236,72,153,0.75)',
    controlOffShadow: 'none',
  },
  desertLead: {
    frontImg: leadFrontImg,
    panelImg: leadPanelImg,
    grillBg: '#000000ff',

    knobLabelColor: '#f9fafb',
    knobValueColor: '#e5e7eb',
    knobFaceGradient:
      'radial-gradient(circle at 30% 20%, #f9fafb 0, #e5e7eb 35%, #4b5563 100%)',

    modeActiveBg: 'linear-gradient(90deg,#f97316,#ea580c)',
    modeActiveBorder: '1px solid #f97316',
    modeActiveColor: '#f9fafb',
    modeInactiveBg: '#111827',
    modeInactiveColor: '#e5e7eb',

    presetPanelBg: 'rgba(15,23,42,0.95)',
    presetLabelColor: '#f97316',
    presetNameColor: '#f9fafb',
    presetDescColor: '#e5e7eb',

    presetChipActiveBg: 'linear-gradient(90deg,#f97316,#ea580c)',
    presetChipActiveBorder: '1px solid #f97316',
    presetChipActiveColor: '#020617',
    presetChipInactiveBg: '#020617',
    presetChipInactiveBorder: '1px solid #4b5563',
    presetChipInactiveColor: '#e5e7eb',

    nbBadgeBg: 'rgba(15,23,42,0.9)',
    nbBadgeBorder: '1px solid #f97316',
    nbBadgeTextColor: '#f9fafb',
    nbBadgeDotBg: '#f97316',

    monitorOnBg: '#334155',
    monitorOffBg: '#020617',
    monitorTextColor: '#e5e7eb',

    driveOnBg: '#f97316',
    driveOffBg: '#1f2937',
    driveTextColor: '#f9fafb',

    // delay naranja en el lead
    delayOnBg: 'linear-gradient(90deg,#f97316,#ea580c)',
    delayOffBg: '#020617',
    delayOnBorder: '1px solid #f97316',
    delayOffBorder: '1px solid #4b5563',
    delayOnDotBg: '#fed7aa',
    delayOffDotBg: '#9ca3af',
    delayOnTextColor: '#020617',
    delayOffTextColor: '#e5e7eb',

    controlOnShadow: '0 0 14px rgba(249,115,22,0.85)',
    controlOffShadow: 'none',
  },
  infernalRaga: {
    frontImg: infernalFrontImg,
    panelImg: infernalPanelImg,
    grillBg: '#000000ff',

    knobLabelColor: '#fb37ff',
    knobValueColor: '#f9a8ff',
    knobFaceGradient:
      'radial-gradient(circle at 30% 20%, #fdf2ff 0, #f9a8ff 35%, #5b21b6 100%)',

    modeActiveBg: 'linear-gradient(90deg,#ec4899,#a855f7)',
    modeActiveBorder: '1px solid #ec4899',
    modeActiveColor: '#f9fafb',
    modeInactiveBg: '#3f0758',
    modeInactiveColor: '#f9a8ff',

    presetPanelBg: 'rgba(24,6,41,0.95)',
    presetLabelColor: '#f472b6',
    presetNameColor: '#f9a8ff',
    presetDescColor: '#e5e7eb',

    presetChipActiveBg: 'linear-gradient(90deg,#ec4899,#a855f7)',
    presetChipActiveBorder: '1px solid #ec4899',
    presetChipActiveColor: '#050816',
    presetChipInactiveBg: '#020617',
    presetChipInactiveBorder: '1px solid #4b5563',
    presetChipInactiveColor: '#e5e7eb',

    nbBadgeBg: 'rgba(24,6,41,0.9)',
    nbBadgeBorder: '1px solid #ec4899',
    nbBadgeTextColor: '#f9a8ff',
    nbBadgeDotBg: '#ec4899',

    monitorOnBg: '#581c87',
    monitorOffBg: '#020617',
    monitorTextColor: '#f9fafb',

    driveOnBg: '#ec4899',
    driveOffBg: '#1f2937',
    driveTextColor: '#f9fafb',

    // delay magenta/violáceo en el infernal
    delayOnBg: 'linear-gradient(90deg,#ec4899,#a855f7)',
    delayOffBg: '#020617',
    delayOnBorder: '1px solid #ec4899',
    delayOffBorder: '1px solid #4b5563',
    delayOnDotBg: '#f9a8ff',
    delayOffDotBg: '#9ca3af',
    delayOnTextColor: '#050816',
    delayOffTextColor: '#e5e7eb',

    controlOnShadow: '0 0 14px rgba(236,72,153,0.95)',
    controlOffShadow: 'none',
  },
};

const AmpPanel: React.FC = () => {
  const {
    // Amp
    ampGain,
    setAmpGain,
    ampTone,
    setAmpTone,
    ampMaster,
    setAmpMaster,
    // Delay
    delayEnabled,
    setDelayEnabled,
    delayTimeMs,
    setDelayTimeMs,
    feedbackAmount,
    setFeedbackAmount,
    mixAmount,
    setMixAmount,
    // Sitar
    sitarAmount,
    setSitarAmount,
    sitarMode,
    setSitarMode,
    // Drive
    driveAmount,
    setDriveAmount,
    driveEnabled,
    setDriveEnabled,
    // Reverb
    reverbAmount,
    setReverbAmount,
    // Monitor
    monitorEnabled,
    setMonitorEnabled,
    // Tonestack
    bassAmount,
    setBassAmount,
    midAmount,
    setMidAmount,
    trebleAmount,
    setTrebleAmount,
    presenceAmount,
    setPresenceAmount,
  } = useAudioEngine();

  const [selectedPreset, setSelectedPreset] = useState<PresetId | 'custom'>(
    'cleanMystic',
  );
  const [skinPreset, setSkinPreset] = useState<PresetId>('cleanMystic');

  const applyPreset = (id: PresetId) => {
    const { settings } = PRESETS[id];
    setSelectedPreset(id);
    setSkinPreset(id);

    setAmpGain(settings.ampGain);
    setAmpTone(settings.ampTone);
    setAmpMaster(settings.ampMaster);

    setBassAmount(settings.bassAmount);
    setMidAmount(settings.midAmount);
    setTrebleAmount(settings.trebleAmount);
    setPresenceAmount(settings.presenceAmount);

    setDriveAmount(settings.driveAmount);
    setDriveEnabled(settings.driveEnabled);

    setDelayEnabled(settings.delayEnabled);
    setDelayTimeMs(settings.delayTimeMs);
    setFeedbackAmount(settings.feedbackAmount);
    setMixAmount(settings.mixAmount);

    setReverbAmount(settings.reverbAmount);

    setSitarAmount(settings.sitarAmount);
    setSitarMode(settings.sitarMode);
  };

  const selectedPresetLabel =
    selectedPreset === 'custom' ? 'Custom' : PRESETS[selectedPreset].label;
  const selectedPresetDescription =
    selectedPreset === 'custom'
      ? 'Ajuste manual del usuario.'
      : PRESETS[selectedPreset].description;

  const modeLabels: Record<SitarMode, string> = {
    sharp: 'SHARP',
    major: 'MAJOR',
    minor: 'MINOR',
    exotic: 'EXOTIC',
  };

  const skin = SKINS[skinPreset];

  const markCustom = () => setSelectedPreset('custom');

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
        {/* Amp head */}
        <div
          style={{
            marginTop: -2,
            marginInline: '1.5rem',
            width: '100%',
            maxWidth: '1500px',
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
                backgroundColor: skin.grillBg,
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
                  backgroundImage: `url(${skin.frontImg})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
            </div>

            {/* Panel de controles */}
            <div
              style={{
                backgroundImage: `url(${skin.panelImg})`,
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat',
                padding: '0.75rem 1.1rem 0.8rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.7rem',
              }}
            >
              {/* Preset + logo + switches */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '0.3rem',
                  gap: '0.75rem',
                  maxHeight: '50px',
                }}
              >
                <div
                  style={{
                    maxWidth: 381,
                    position: 'relative',
                    top: '-96px',
                    backgroundColor: skin.presetPanelBg,
                    padding: '9px',
                  }}
                >
                  <div
                    style={{
                      ...labelBase,
                      color: skin.presetLabelColor,
                    }}
                  >
                    Preset
                  </div>
                  <div
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: skin.presetNameColor,
                    }}
                  >
                    {selectedPresetLabel}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: skin.presetDescColor,
                      marginBottom: '0.25rem',
                    }}
                  >
                    {selectedPresetDescription}
                  </div>

                  {/* Botones de preset */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.35rem',
                      flexWrap: 'wrap',
                      marginTop: '0.15rem',
                    }}
                  >
                    {(Object.keys(PRESETS) as PresetId[]).map((id) => {
                      const active = selectedPreset === id;
                      const p = PRESETS[id];
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => applyPreset(id)}
                          style={{
                            padding: '0.18rem 0.6rem',
                            borderRadius: 999,
                            fontSize: '0.65rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
                            border: active
                              ? skin.presetChipActiveBorder
                              : skin.presetChipInactiveBorder,
                            background: active
                              ? skin.presetChipActiveBg
                              : skin.presetChipInactiveBg,
                            color: active
                              ? skin.presetChipActiveColor
                              : skin.presetChipInactiveColor,
                            cursor: 'pointer',
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* NB • SITAR badge */}
                <div
                  style={{
                    alignSelf: 'flex-end',
                    padding: '0.1rem 0.5rem',
                    borderRadius: '999px',
                    border: skin.nbBadgeBorder,
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.18em',
                    color: skin.nbBadgeTextColor,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    position: 'relative',
                    top: '-15px',
                    background: skin.nbBadgeBg,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '999px',
                      background: skin.nbBadgeDotBg,
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
                    background: monitorEnabled
                      ? skin.monitorOnBg
                      : skin.monitorOffBg,
                    color: skin.monitorTextColor,
                    borderRadius: 999,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    boxShadow: monitorEnabled
                      ? skin.controlOnShadow
                      : skin.controlOffShadow,
                  }}
                >
                  {monitorEnabled ? 'Monitor ON' : 'Monitor OFF'}
                </button>

                {/* Drive ON/OFF */}
                <button
                  type="button"
                  onClick={() => {
                    setDriveEnabled(!driveEnabled);
                    markCustom();
                  }}
                  style={{
                    padding: '0.55rem 1.4rem',
                    borderRadius: '999px',
                    border: 'none',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.16em',
                    background: driveEnabled
                      ? skin.driveOnBg
                      : skin.driveOffBg,
                    color: skin.driveTextColor,
                    cursor: 'pointer',
                    boxShadow: driveEnabled
                      ? skin.controlOnShadow
                      : skin.controlOffShadow,
                  }}
                >
                  {driveEnabled ? 'Drive On' : 'Drive Off'}
                </button>

                {/* Delay footswitch */}
                <button
                  type="button"
                  onClick={() => {
                    setDelayEnabled(!delayEnabled);
                    markCustom();
                  }}
                  style={{
                    padding: '0.45rem 1.4rem',
                    borderRadius: '999px',
                    border: delayEnabled
                      ? skin.delayOnBorder
                      : skin.delayOffBorder,
                    background: delayEnabled
                      ? skin.delayOnBg
                      : skin.delayOffBg,
                    color: delayEnabled
                      ? skin.delayOnTextColor
                      : skin.delayOffTextColor,
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.16em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    cursor: 'pointer',
                    boxShadow: delayEnabled
                      ? skin.controlOnShadow
                      : skin.controlOffShadow,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '999px',
                      background: delayEnabled
                        ? skin.delayOnDotBg
                        : skin.delayOffDotBg,
                    }}
                  />
                  {delayEnabled ? 'Delay On' : 'Delay Off'}
                </button>
              </div>

              {/* Modos de sitar */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.4rem',
                  marginBottom: '0.4rem',
                  marginLeft: '226px',
                }}
              >
                {(Object.keys(modeLabels) as SitarMode[]).map((mode) => {
                  const active = sitarMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setSitarMode(mode);
                        markCustom();
                      }}
                      style={{
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.65rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        borderRadius: 999,
                        border: active
                          ? skin.modeActiveBorder
                          : '1px solid transparent',
                        background: active
                          ? skin.modeActiveBg
                          : skin.modeInactiveBg,
                        color: active
                          ? skin.modeActiveColor
                          : skin.modeInactiveColor,
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
                  marginLeft: '201px',
                }}
              >
                {/* Fila 1: Gain / Bass / Mid / Treble */}
                <Knob
                  label="Gain"
                  min={0}
                  max={200}
                  value={ampGain * 100}
                  onChange={(v) => {
                    setAmpGain(v / 100);
                    markCustom();
                  }}
                  display={ampGain.toFixed(2)}
                  labelColor={skin.knobLabelColor}
                  valueColor={skin.knobValueColor}
                  faceGradient={skin.knobFaceGradient}
                />

                <Knob
                  label="Bass"
                  min={0}
                  max={100}
                  value={bassAmount * 100}
                  onChange={(v) => {
                    setBassAmount(v / 100);
                    markCustom();
                  }}
                  display={`${Math.round(bassAmount * 10)}/10`}
                  labelColor={skin.knobLabelColor}
                  valueColor={skin.knobValueColor}
                  faceGradient={skin.knobFaceGradient}
                />

                <Knob
                  label="Mid"
                  min={0}
                  max={100}
                  value={midAmount * 100}
                  onChange={(v) => {
                    setMidAmount(v / 100);
                    markCustom();
                  }}
                  display={`${Math.round(midAmount * 10)}/10`}
                  labelColor={skin.knobLabelColor}
                  valueColor={skin.knobValueColor}
                  faceGradient={skin.knobFaceGradient}
                />

                <Knob
                  label="Treble"
                  min={0}
                  max={100}
                  value={trebleAmount * 100}
                  onChange={(v) => {
                    setTrebleAmount(v / 100);
                    markCustom();
                  }}
                  display={`${Math.round(trebleAmount * 10)}/10`}
                  labelColor={skin.knobLabelColor}
                  valueColor={skin.knobValueColor}
                  faceGradient={skin.knobFaceGradient}
                />

                {/* Fila 2: Presence / Tone / Sitar / Master / Drive / Reverb */}
                <Knob
                  label="Presence"
                  min={0}
                  max={100}
                  value={presenceAmount * 100}
                  onChange={(v) => {
                    setPresenceAmount(v / 100);
                    markCustom();
                  }}
                  display={`${Math.round(presenceAmount * 10)}/10`}
                  labelColor={skin.knobLabelColor}
                  valueColor={skin.knobValueColor}
                  faceGradient={skin.knobFaceGradient}
                />

                <Knob
                  label="Tone"
                  min={0}
                  max={100}
                  value={ampTone * 100}
                  onChange={(v) => {
                    setAmpTone(v / 100);
                    markCustom();
                  }}
                  display={`${Math.round(ampTone * 10)}/10`}
                  labelColor={skin.knobLabelColor}
                  valueColor={skin.knobValueColor}
                  faceGradient={skin.knobFaceGradient}
                />

                <Knob
                  label="Sitar"
                  min={0}
                  max={100}
                  value={sitarAmount * 100}
                  onChange={(v) => {
                    setSitarAmount(v / 100);
                    markCustom();
                  }}
                  display={`${Math.round(sitarAmount * 100)}%`}
                  labelColor={skin.knobLabelColor}
                  valueColor={skin.knobValueColor}
                  faceGradient={skin.knobFaceGradient}
                />

                <Knob
                  label="Master"
                  min={0}
                  max={200}
                  value={ampMaster * 100}
                  onChange={(v) => {
                    setAmpMaster(v / 100);
                    markCustom();
                  }}
                  display={ampMaster.toFixed(2)}
                  labelColor={skin.knobLabelColor}
                  valueColor={skin.knobValueColor}
                  faceGradient={skin.knobFaceGradient}
                />

                <Knob
                  label="Drive"
                  min={0}
                  max={100}
                  value={driveAmount * 100}
                  onChange={(v) => {
                    setDriveAmount(v / 100);
                    markCustom();
                  }}
                  display={`${Math.round(driveAmount * 100)}%`}
                  labelColor={skin.knobLabelColor}
                  valueColor={skin.knobValueColor}
                  faceGradient={skin.knobFaceGradient}
                />

                <Knob
                  label="Reverb"
                  min={0}
                  max={100}
                  value={reverbAmount * 100}
                  onChange={(v) => {
                    setReverbAmount(v / 100);
                    markCustom();
                  }}
                  display={`${Math.round(reverbAmount * 100)}%`}
                  labelColor={skin.knobLabelColor}
                  valueColor={skin.knobValueColor}
                  faceGradient={skin.knobFaceGradient}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AmpPanel;
