// src/components/AmpPanel.tsx
import React, { useEffect, useState } from 'react';
import { useAudioEngine, type SitarMode } from '../audio/AudioEngineProvider';
import LiveWaveform from "./LiveWaveform";
import type { EngineSettingsV1, CustomPresetV1 } from '../presets/presetSettings';
import {
  loadCustomPresets,
  saveCustomPresets,
  upsertCustomPreset,
  deleteCustomPreset,
  renameCustomPreset,
  MAX_CUSTOM_PRESETS,
} from '../presets/presetSettings';
// CLEAN (rosa)
import cleanFrontImg from '../assets/nea.png';
import cleanPanelImg from '../assets/input.png';

// LEAD (equipo oscuro)
import leadFrontImg from '../assets/nea-lead.png';
import leadPanelImg from '../assets/input-lead.png';

// INFERNAL (equipo oscuro rosa)
import infernalFrontImg from '../assets/nea-infernal.png';
import infernalPanelImg from '../assets/input-infernal.png';
import pedalImg from '../assets/pedal.png';
import pedalPhaser from '../assets/phaser.png';
import pedalOcta from '../assets/octa.png';
import distoPedalImg from '../assets/disto.png';
import pedalRaga from '../assets/raga.png';
import flangerPedal from '../assets/flanger.png';



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
  minWidth?: number; // ✅ NUEVO

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

type PresetSettings = EngineSettingsV1;

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
    description: 'Clean brillante, sitar suave, espacio sagrado.',
    settings: {
      // ✅ COMPRESSOR (defaults)
      compressorEnabled: false,
      compressorThreshold: -18,  // dB
      compressorRatio: 4,        // 1..20
      compressorAttack: 0.01,    // seconds
      compressorRelease: 0.2,    // seconds
      compressorKnee: 12,        // dB
      compressorMakeup: 1.0,     // linear gain (1 = 0dB)
      compressorMix: 1.0,        // 0..1

      ampGain: 0.9,
      ampTone: 0.55,
      ampMaster: 1.0,
      bassAmount: 0.55,
      midAmount: 0.45,
      trebleAmount: 0.6,
      presenceAmount: 0.55,
      driveAmount: 0.18,
      driveEnabled: false,

      // 🔻 Delay casi imperceptible
      delayEnabled: true,
      delayTimeMs: 280,
      feedbackAmount: 0.12,
      mixAmount: 0.10,

      reverbAmount: 0.5,

      sitarAmount: 0.35,
      sitarMode: 'major',

      // 🌊 Phaser místico
      phaserEnabled: true,
      phaserRate: 0.08,
      phaserDepth: 0.18,
      phaserFeedback: 0.05,
      phaserMix: 0.22,
      phaserCenter: 0.5,

      // 🌫️ Flanger tipo chorus
      flangerEnabled: true,
      flangerRate: 0.12,
      flangerDepth: 0.15,
      flangerMix: 0.18,
      flangerFeedback: 0.0,

      // Octave apagado
      octaveEnabled: false,
      octaveTone: 0.5,
      octaveLevel: 1.0,
      octaveMix: 0.0,

      // Valve apagado
      valveEnabled: false,
      valveDrive: 0.35,
      valveTone: 0.5,
      valveLevel: 1.0,
      valveMode: 'overdrive',

      // Raga preparado
      ragaEnabled: false,
      ragaResonance: 0.45,
      ragaDroneLevel: 0.25,
      ragaColor: 0.5,
    },
  },
  desertLead: {
    label: 'Desert Lead',
    description: 'Lead vocal, ancho, delay fantasma.',
    settings: {
      // ✅ COMPRESSOR (defaults)
      compressorEnabled: false,
      compressorThreshold: -18,  // dB
      compressorRatio: 4,        // 1..20
      compressorAttack: 0.01,    // seconds
      compressorRelease: 0.2,    // seconds
      compressorKnee: 12,        // dB
      compressorMakeup: 1.0,     // linear gain (1 = 0dB)
      compressorMix: 1.0,        // 0..1

      ampGain: 1.25,
      ampTone: 0.62,
      ampMaster: 1.2,
      bassAmount: 0.5,
      midAmount: 0.65,
      trebleAmount: 0.6,
      presenceAmount: 0.65,
      driveAmount: 0.58,
      driveEnabled: true,

      // 🔻 Delay mínimo
      delayEnabled: true,
      delayTimeMs: 320,
      feedbackAmount: 0.18,
      mixAmount: 0.14,

      reverbAmount: 0.4,

      sitarAmount: 0.25,
      sitarMode: 'sharp',

      // 🌊 Phaser leve
      phaserEnabled: true,
      phaserRate: 0.12,
      phaserDepth: 0.22,
      phaserFeedback: 0.08,
      phaserMix: 0.25,
      phaserCenter: 0.55,

      // 🌫️ Flanger apenas presente
      flangerEnabled: true,
      flangerRate: 0.18,
      flangerDepth: 0.2,
      flangerMix: 0.2,
      flangerFeedback: 0.08,

      // Octave off
      octaveEnabled: false,
      octaveTone: 0.5,
      octaveLevel: 1.0,
      octaveMix: 0.0,

      // Valve listo pero apagado
      valveEnabled: false,
      valveDrive: 0.5,
      valveTone: 0.55,
      valveLevel: 1.1,
      valveMode: 'crunch',

      // Raga listo
      ragaEnabled: false,
      ragaResonance: 0.4,
      ragaDroneLevel: 0.3,
      ragaColor: 0.45,
    },
  },
  infernalRaga: {
    label: 'Infernal Raga',
    description: 'Ritual oscuro, movimiento interno.',
    settings: {
      // ✅ COMPRESSOR (defaults)
      compressorEnabled: false,
      compressorThreshold: -18,  // dB
      compressorRatio: 4,        // 1..20
      compressorAttack: 0.01,    // seconds
      compressorRelease: 0.2,    // seconds
      compressorKnee: 12,        // dB
      compressorMakeup: 1.0,     // linear gain (1 = 0dB)
      compressorMix: 1.0,        // 0..1

      ampGain: 1.5,
      ampTone: 0.7,
      ampMaster: 1.3,
      bassAmount: 0.48,
      midAmount: 0.6,
      trebleAmount: 0.75,
      presenceAmount: 0.8,
      driveAmount: 0.8,
      driveEnabled: true,

      // 🔻 Delay casi ambiente
      delayEnabled: true,
      delayTimeMs: 360,
      feedbackAmount: 0.2,
      mixAmount: 0.16,

      reverbAmount: 0.6,

      sitarAmount: 0.6,
      sitarMode: 'exotic',

      // 🌪️ Phaser profundo
      phaserEnabled: true,
      phaserRate: 0.18,
      phaserDepth: 0.35,
      phaserFeedback: 0.18,
      phaserMix: 0.35,
      phaserCenter: 0.6,

      // 🌑 Flanger lento
      flangerEnabled: true,
      flangerRate: 0.1,
      flangerDepth: 0.3,
      flangerMix: 0.25,
      flangerFeedback: 0.18,

      // Octave off
      octaveEnabled: false,
      octaveTone: 0.5,
      octaveLevel: 1.0,
      octaveMix: 0.0,

      // Valve preparado
      valveEnabled: false,
      valveDrive: 0.65,
      valveTone: 0.45,
      valveLevel: 1.15,
      valveMode: 'distortion',

      // Raga poderoso
      ragaEnabled: false,
      ragaResonance: 0.65,
      ragaDroneLevel: 0.45,
      ragaColor: 0.6,
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
    driveTextColor: '#050505ff',

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

type SubPanel = 'amp' | 'pedals';

const AmpPanel: React.FC = () => {
  const {
    // Amp

    // ✅ Octave
    octaveTone,
    setOctaveTone,
    octaveLevel,
    setOctaveLevel,
    octaveEnabled,
    setOctaveEnabled,
    octaveMix,
    setOctaveMix,
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
    // 🔥 VALVE DISTO (ACÁ VA ESTO)
    valveEnabled,
    setValveEnabled,
    valveDrive,
    setValveDrive,
    valveTone,
    setValveTone,
    valveLevel,
    setValveLevel,
    // Sitar
    sitarAmount,
    setSitarAmount,
    sitarMode,
    setSitarMode,
    ragaEnabled,
    setRagaEnabled,
    ragaResonance,
    setRagaResonance,
    ragaDroneLevel,
    setRagaDroneLevel,
    ragaColor,
    setRagaColor,
    // Drive
    driveAmount,
    setDriveAmount,
    driveEnabled,
    setDriveEnabled,
    // Reverb
    reverbAmount,
    setReverbAmount,
    // Monitor

    // Tonestack
    bassAmount,
    setBassAmount,
    midAmount,
    setMidAmount,
    trebleAmount,
    setTrebleAmount,
    presenceAmount,
    setPresenceAmount,
    // ✅ Flanger
    flangerEnabled,
    setFlangerEnabled,
    flangerRate,
    setFlangerRate,
    flangerDepth,
    setFlangerDepth,
    flangerMix,
    setFlangerMix,
    setValveMode,
    valveMode,






    // ✅ PHASER
    phaserEnabled,
    setPhaserEnabled,
    phaserRate,
    setPhaserRate,
    phaserDepth,
    setPhaserDepth,
    phaserFeedback,
    setPhaserFeedback,
    phaserMix,
    setPhaserMix,
    phaserCenter,
    setPhaserCenter,
    applySettings,
    getCurrentSettings,
    monitorEnabled,
    setMonitorEnabled,
    getAnalyserNode,
    // ✅ COMPRESSOR
    compressorEnabled,
    setCompressorEnabled,
    compressorThreshold,
    setCompressorThreshold,
    compressorRatio,
    setCompressorRatio,
    compressorAttack,
    setCompressorAttack,
    compressorRelease,
    setCompressorRelease,
    compressorKnee,
    setCompressorKnee,
    compressorMakeup,
    setCompressorMakeup,
    compressorMix,
    setCompressorMix,

  } = useAudioEngine();
  // const { applySettings } = useAudioEngine();

  const [selectedPreset, setSelectedPreset] = useState<PresetId | 'edited'>(
    'cleanMystic',
  );
  const [skinPreset, setSkinPreset] = useState<PresetId>('cleanMystic');
  const [subPanel, setSubPanel] = useState<SubPanel>('amp');
  // ✅ Custom presets
  const [customPresets, setCustomPresets] = useState<CustomPresetV1[]>(() =>
    loadCustomPresets(),
  );
  const [customName, setCustomName] = useState('My Preset');
  const [overwriteId, setOverwriteId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);


  // persistencia
  useEffect(() => {
    saveCustomPresets(customPresets);
  }, [customPresets]);

  const applyPreset = (id: PresetId) => {
    const { settings } = PRESETS[id];
    setSelectedPreset(id);
    setSkinPreset(id);
    applySettings(settings);
  };
  const canCreateNew = customPresets.length < MAX_CUSTOM_PRESETS;

  const handleSaveCustom = () => {
    const settings = getCurrentSettings() as unknown as EngineSettingsV1;
    const name = customName.trim() || 'Untitled';

    const next = upsertCustomPreset(customPresets, {
      id: overwriteId ?? undefined,
      name,
      settings,
      uiSkinPreset: skinPreset,
      uiSubPanel: subPanel,
    });

    setCustomPresets(next);
    setOverwriteId(null);
  };

  const handleLoadCustom = (id: string) => {
    const p = customPresets.find((x) => x.id === id);
    if (!p) return;
    applySettings(p.settings);
    if (p.uiSkinPreset) setSkinPreset(p.uiSkinPreset);
    if (p.uiSubPanel) setSubPanel(p.uiSubPanel);
    setSelectedPreset('edited'); // queda como "edited" (o después lo cambiamos a selected custom id)
  };

  const handleDeleteCustom = (id: string) => {
    setCustomPresets(deleteCustomPreset(customPresets, id));
    if (overwriteId === id) setOverwriteId(null);
  };

  const handleRenameCustom = (id: string, name: string) => {
    setCustomPresets(renameCustomPreset(customPresets, id, name));
  };
  const selectedPresetLabel =
    selectedPreset === 'edited' ? 'Custom' : PRESETS[selectedPreset].label;
  const selectedPresetDescription =
    selectedPreset === 'edited'
      ? 'Ajuste manual del usuario.'
      : PRESETS[selectedPreset].description;

  const modeLabels: Record<SitarMode, string> = {
    sharp: 'SHARP',
    major: 'MAJOR',
    minor: 'MINOR',
    exotic: 'EXOTIC',
  };

  const skin = SKINS[skinPreset];
  const waveformColor =
    skinPreset === 'desertLead'
      ? '#ff7a18'
      : skinPreset === 'infernalRaga'
        ? '#fb37ff'
        : '#ffffffff';

  const waveformAmplitudePx =
    skinPreset === 'infernalRaga' ? 32 : skinPreset === 'desertLead' ? 35 : 25;

  // colores dinámicos para tabs y pedales
  const tabsActiveBg = skin.driveOnBg;
  const tabsActiveColor = skin.driveTextColor;
  const tabsInactiveColor = '#e5e7eb';

  const markCustom = () => setSelectedPreset('edited');

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
                position: 'relative',
                top: '-23px',
                left: '147px',
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
              {/* Tabs: Equipo / Pedales */}
              <div
                style={{
                  alignSelf: 'center',
                  marginBottom: '0.45rem',
                  padding: '0.12rem',
                  borderRadius: 999,
                  background: 'rgba(15,23,42,0.85)',
                  display: 'inline-flex',
                  gap: '0.15rem',
                }}
              >
                {(['amp', 'pedals'] as SubPanel[]).map((tab) => {
                  const active = subPanel === tab;
                  const label = tab === 'amp' ? 'EQUIPO' : 'PEDALES';
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSubPanel(tab)}
                      style={{
                        borderRadius: 999,
                        border: 'none',
                        padding: '0.22rem 0.9rem',
                        fontSize: '0.7rem',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        background: active ? tabsActiveBg : 'transparent',
                        color: active ? tabsActiveColor : tabsInactiveColor,
                        opacity: active ? 1 : 0.75,
                        boxShadow: active ? skin.controlOnShadow : 'none',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {/* ✅ Custom Presets (solo en EQUIPO) */}
              <div
                style={{
                  marginTop: '0.8rem',
                  position: 'absolute',
                  top: '501px',
                  padding: '0.75rem',
                  borderRadius: 14,
                  border: '1px solid rgba(148,163,184,0.65)',
                  background: 'rgba(2,6,23,0.55)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85 }}>
                    Custom Presets
                  </div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                    {customPresets.length}/{MAX_CUSTOM_PRESETS}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Nombre"
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.6rem',
                      borderRadius: 10,
                      border: '1px solid rgba(148,163,184,0.35)',
                      background: '#020617',
                      color: '#e5e7eb',
                      fontSize: '0.75rem',
                    }}
                  />

                  <select
                    value={overwriteId ?? ''}
                    onChange={(e) => setOverwriteId(e.target.value || null)}
                    style={{
                      padding: '0.45rem 0.55rem',
                      borderRadius: 10,
                      border: '1px solid rgba(148,163,184,0.35)',
                      background: '#020617',
                      color: '#e5e7eb',
                      fontSize: '0.72rem',
                    }}
                    title="Opcional: sobrescribir"
                  >
                    <option value="">Create new</option>
                    {customPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        Overwrite: {p.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleSaveCustom}
                    disabled={!canCreateNew && !overwriteId}
                    style={{
                      padding: '0.45rem 0.8rem',
                      borderRadius: 999,
                      border: '1px solid rgba(148,163,184,0.45)',
                      background: (!canCreateNew && !overwriteId) ? 'rgba(15,23,42,0.4)' : skin.modeActiveBg,
                      color: '#fff',
                      cursor: (!canCreateNew && !overwriteId) ? 'not-allowed' : 'pointer',
                      fontSize: '0.72rem',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      boxShadow: (!canCreateNew && !overwriteId) ? 'none' : skin.controlOnShadow,
                    }}
                    title={!canCreateNew && !overwriteId ? 'Máximo 5. Borrá uno o sobrescribí.' : 'Guardar preset'}
                  >
                    Save
                  </button>
                </div>

                {customPresets.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                    No hay presets guardados todavía.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {customPresets.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '0.45rem',
                          borderRadius: 12,
                          border: '1px solid rgba(148,163,184,0.25)',
                          background: 'rgba(2,6,23,0.35)',
                        }}
                      >
                        <input
                          value={p.name}
                          onChange={(e) => handleRenameCustom(p.id, e.target.value)}
                          style={{
                            flex: 1,
                            padding: '0.4rem 0.55rem',
                            borderRadius: 10,
                            border: '1px solid rgba(148,163,184,0.35)',
                            background: '#020617',
                            color: '#e5e7eb',
                            fontSize: '0.75rem',
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => handleLoadCustom(p.id)}
                          style={{
                            padding: '0.38rem 0.7rem',
                            borderRadius: 999,
                            border: '1px solid rgba(148,163,184,0.45)',
                            background: 'rgba(2,6,23,0.35)',
                            color: '#e5e7eb',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                          }}
                        >
                          Load
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmDelete({ id: p.id, name: p.name })}
                          style={{
                            padding: '0.38rem 0.7rem',
                            borderRadius: 999,
                            border: '1px solid rgba(248,113,113,0.65)',
                            background: 'transparent',
                            color: '#fecaca',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* ---------- PANEL EQUIPO ---------- */}
              {subPanel === 'amp' && (
                <>
                  <div style={{ position: 'absolute', top: '998px', left: '1564px', width: '211px' }}>
                    <LiveWaveform
                      analyser={getAnalyserNode()}
                      enabled={monitorEnabled}
                      height={42}
                      color={waveformColor}
                      glow={10}
                      fillAlpha={0.16}
                      amplitudePx={waveformAmplitudePx}
                    />
                    {/* 👇👇👇 ACÁ VA EL MODAL, AL FINAL */}
                    {confirmDelete && (
                      <div
                        style={{
                          position: 'fixed',
                          inset: 0,
                          background: 'rgba(0,0,0,0.55)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 9999,
                          padding: 16,
                        }}
                        onClick={() => setConfirmDelete(null)}
                      >
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: 'min(520px, 92vw)',
                            borderRadius: 18,
                            border: '1px solid rgba(148,163,184,0.35)',
                            background: 'rgba(2,6,23,0.92)',
                            boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
                            padding: '14px 14px 12px',
                          }}
                        >
                          <div style={{ fontSize: '0.72rem', letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.75 }}>
                            Confirmación
                          </div>

                          <div style={{ marginTop: 8, fontSize: '1rem', fontWeight: 800 }}>
                            ¿Querés borrar este preset?
                          </div>

                          <div style={{ marginTop: 6, fontSize: '0.85rem', opacity: 0.85 }}>
                            Preset: <b>{confirmDelete.name}</b>
                          </div>
                          <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            {/* Cancelar */}
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              style={{
                                padding: '0.52rem 0.95rem',
                                borderRadius: 999,
                                border: '1px solid rgba(148,163,184,0.45)',
                                background: 'rgba(2,6,23,0.35)',
                                color: '#e5e7eb',
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                fontWeight: 900,
                                backdropFilter: 'blur(6px)',
                                boxShadow: '0 10px 26px rgba(0,0,0,0.35)',
                                transition: 'transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
                              }}
                              onMouseDown={(e) => (e.currentTarget.style.transform = 'translateY(1px)')}
                              onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0px)')}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.95')}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                            >
                              Cancelar
                            </button>

                            {/* Borrar */}
                            <button
                              type="button"
                              onClick={() => {
                                handleDeleteCustom(confirmDelete.id);
                                setConfirmDelete(null);
                              }}
                              style={{
                                padding: '0.52rem 0.95rem',
                                borderRadius: 999,
                                border: `1px solid rgba(255,255,255,0.18)`,
                                background: skin.modeActiveBg,          // 👈 usa el color del preset actual
                                color: skin.modeActiveColor,            // 👈 texto acorde
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                fontWeight: 950,
                                boxShadow: skin.controlOnShadow,        // 👈 glow acorde al preset
                                transition: 'transform 120ms ease, box-shadow 120ms ease, filter 120ms ease',
                                filter: 'saturate(1.05)',
                              }}
                              onMouseDown={(e) => (e.currentTarget.style.transform = 'translateY(1px)')}
                              onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0px)')}
                              onMouseEnter={(e) => (e.currentTarget.style.filter = 'saturate(1.25)')}
                              onMouseLeave={(e) => (e.currentTarget.style.filter = 'saturate(1.05)')}
                            >
                              Borrar
                            </button>
                          </div>

                        </div>
                      </div>
                    )}
                  </div>

                  {/* Preset + logo + switches (Monitor / Drive) */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '-45px',
                      gap: '0.75rem',
                      maxHeight: '50px',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: 381,
                        position: 'relative',
                        top: '-144px',
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
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        padding: '0.35rem 0.6rem',
                        borderRadius: 999,
                        border: '1px solid rgba(148,163,184,0.35)',
                        background: 'rgba(2,6,23,0.45)',
                      }}
                    >
                      {/* Label */}
                      <span
                        style={{
                          fontSize: '0.65rem',
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                          opacity: 0.85,
                          color: skin.driveTextColor,
                        }}
                      >
                        Drive
                      </span>

                      {/* Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          setDriveEnabled(!driveEnabled);
                          markCustom();
                        }}
                        style={{
                          position: 'relative',
                          width: 46,
                          height: 24,
                          borderRadius: 999,
                          border: driveEnabled
                            ? `1px solid ${skin.driveOnBg}`
                            : '1px solid rgba(148,163,184,0.45)',
                          background: driveEnabled
                            ? skin.driveOnBg
                            : 'rgba(15,23,42,0.8)',
                          cursor: 'pointer',
                          boxShadow: driveEnabled
                            ? skin.controlOnShadow
                            : 'inset 0 0 0 1px rgba(0,0,0,0.25)',
                          transition: 'all 160ms ease',
                        }}
                      >
                        {/* Thumb */}
                        <span
                          style={{
                            position: 'absolute',
                            top: 2,
                            left: driveEnabled ? 24 : 2,
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: '#f9fafb',
                            boxShadow: driveEnabled
                              ? '0 0 10px rgba(255,255,255,0.75)'
                              : '0 2px 6px rgba(0,0,0,0.45)',
                            transition: 'left 160ms ease, box-shadow 160ms ease',
                          }}
                        />
                      </button>

                      {/* Estado */}
                      <span
                        style={{
                          fontSize: '0.6rem',
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          fontWeight: 800,
                          opacity: driveEnabled ? 1 : 0.55,
                          color: driveEnabled ? skin.driveTextColor : '#9ca3af',
                        }}
                      >
                        {driveEnabled ? 'ON' : 'OFF'}
                      </span>
                    </div>

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
                </>
              )}

              {/* ---------- PANEL PEDALES (DELAY + SITAR+) ---------- */}
              {subPanel === 'pedals' && (
                <div
                  style={{
                    marginTop: '0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1.6rem',
                    backgroundColor:
                      skin.grillBg === '#f2d8d4' ? '#f4d9d5' : '#020617',
                    padding: '1.2rem 0 2rem',
                    borderRadius: 18,
                  }}
                >


                  <div
                    style={{
                      display: 'flex',
                      gap: '4.5rem',
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* --------- PEDAL DELAY ---------- */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.8rem',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: 260,
                          height: 420,
                          backgroundImage: `url(${pedalImg})`,
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          paddingBottom: '1.4rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            padding: '0.4rem 0.7rem',
                            borderRadius: 999,
                            backdropFilter: 'blur(4px)',
                            background: 'rgba(0,0,0,0.4)',
                            position: 'absolute',
                            top: '255px',
                            gap: '0.5rem',
                          }}
                        >
                          <Knob
                            label="Time"
                            min={50}
                            max={1000}
                            value={delayTimeMs}
                            onChange={(v) => {
                              setDelayTimeMs(v);
                              markCustom();
                            }}
                            display={`${Math.round(delayTimeMs)} ms`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Feedback"
                            min={0}
                            max={90}
                            value={feedbackAmount * 100}
                            onChange={(v) => {
                              setFeedbackAmount(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(feedbackAmount * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Mix"
                            min={0}
                            max={100}
                            value={mixAmount * 100}
                            onChange={(v) => {
                              setMixAmount(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(mixAmount * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setDelayEnabled(!delayEnabled);
                          markCustom();
                        }}
                        style={{
                          padding: '0.55rem 1.4rem',
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

                    {/* ✅ PHASER */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.8rem',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: 260,
                          height: 420,
                          backgroundImage: `url(${pedalPhaser})`,
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {/* ===== FILA SUPERIOR (2 knobs) ===== */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 160,
                            display: 'flex',
                            gap: '0.5rem',
                            padding: '0.35rem 0.6rem',
                            borderRadius: 999,
                            backdropFilter: 'blur(4px)',
                            background: 'rgba(0,0,0,0.45)',
                          }}
                        >
                          <Knob
                            label="Rate"
                            min={0}
                            max={100}
                            value={phaserRate * 100}
                            onChange={(v) => {
                              setPhaserRate(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(phaserRate * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Depth"
                            min={0}
                            max={100}
                            value={phaserDepth * 100}
                            onChange={(v) => {
                              setPhaserDepth(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(phaserDepth * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />
                        </div>

                        {/* ===== FILA INFERIOR (3 knobs) ===== */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 255,
                            display: 'flex',
                            gap: '0.5rem',
                            padding: '0.4rem 0.7rem',
                            borderRadius: 999,
                            backdropFilter: 'blur(4px)',
                            background: 'rgba(0,0,0,0.45)',
                          }}
                        >
                          <Knob
                            label="FB"
                            min={0}
                            max={100}
                            value={phaserFeedback * 100}
                            onChange={(v) => {
                              setPhaserFeedback(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(phaserFeedback * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Mix"
                            min={0}
                            max={100}
                            value={phaserMix * 100}
                            onChange={(v) => {
                              setPhaserMix(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(phaserMix * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Center"
                            min={0}
                            max={100}
                            value={phaserCenter * 100}
                            onChange={(v) => {
                              setPhaserCenter(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(phaserCenter * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setPhaserEnabled(!phaserEnabled);
                          markCustom();
                        }}
                        style={{
                          padding: '0.55rem 1.4rem',
                          borderRadius: '999px',
                          border: phaserEnabled ? skin.delayOnBorder : skin.delayOffBorder,
                          background: phaserEnabled ? skin.modeActiveBg : 'transparent',
                          color: phaserEnabled ? skin.modeActiveColor : skin.modeInactiveColor,
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.16em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer',
                          boxShadow: phaserEnabled ? skin.controlOnShadow : skin.controlOffShadow,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '999px',
                            background: phaserEnabled ? skin.delayOnDotBg : skin.delayOffDotBg,
                          }}
                        />
                        {phaserEnabled ? 'Phaser On' : 'Phaser Off'}
                      </button>
                    </div>


                    {/* --------- PEDAL OCTAVE (prototype) ---------- */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.8rem',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: 260,
                          height: 420,
                          backgroundImage: `url(${pedalOcta})`, // ✅ por ahora reutilizamos el PNG del sitar
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          paddingBottom: '1.4rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            padding: '0.4rem 0.7rem',
                            borderRadius: 999,
                            backdropFilter: 'blur(4px)',
                            background: 'rgba(0,0,0,0.45)',
                            position: 'absolute',
                            top: '255px',
                            gap: '0.5rem',
                          }}
                        >
                          <Knob
                            label="Mix"
                            min={0}
                            max={100}
                            value={octaveMix * 100}
                            onChange={(v) => {
                              setOctaveMix(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(octaveMix * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          {/* Podés dejar 2 knobs vacíos por ahora (o agregar después Tone/Track) */}
                          <Knob
                            label="Tone"
                            min={0}
                            max={100}
                            value={octaveTone * 100}
                            onChange={(v) => {
                              setOctaveTone(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(octaveTone * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Level"
                            min={0}
                            max={100}
                            value={octaveLevel * 100}
                            onChange={(v) => {
                              setOctaveLevel(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(octaveLevel * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setOctaveEnabled(!octaveEnabled);
                          markCustom();
                        }}
                        style={{
                          padding: '0.5rem 1.4rem',
                          borderRadius: '999px',
                          border: octaveEnabled ? skin.delayOnBorder : skin.delayOffBorder,
                          background: octaveEnabled ? skin.modeActiveBg : 'transparent',
                          color: octaveEnabled ? skin.modeActiveColor : skin.modeInactiveColor,
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.16em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer',
                          boxShadow: octaveEnabled ? skin.controlOnShadow : skin.controlOffShadow,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '999px',
                            background: octaveEnabled ? skin.delayOnDotBg : skin.delayOffDotBg,
                          }}
                        />
                        {octaveEnabled ? 'Octave On' : 'Octave Off'}
                      </button>
                    </div>
                    {/* --------- PEDAL FLANGER (RAGA SWEEP) ---------- */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.8rem',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: 260,
                          height: 420,
                          backgroundImage: `url(${flangerPedal})`,
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          paddingBottom: '1.4rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            padding: '0.4rem 0.7rem',
                            borderRadius: 999,
                            backdropFilter: 'blur(4px)',
                            background: 'rgba(0,0,0,0.45)',
                            position: 'absolute',
                            top: '255px',
                            gap: '0.5rem',
                          }}
                        >
                          <Knob
                            label="Rate"
                            min={0}
                            max={100}
                            value={flangerRate * 100}
                            onChange={(v) => {
                              setFlangerRate(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(flangerRate * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Depth"
                            min={0}
                            max={100}
                            value={flangerDepth * 100}
                            onChange={(v) => {
                              setFlangerDepth(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(flangerDepth * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Mix"
                            min={0}
                            max={100}
                            value={flangerMix * 100}
                            onChange={(v) => {
                              setFlangerMix(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(flangerMix * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setFlangerEnabled(!flangerEnabled);
                          markCustom();
                        }}
                        style={{
                          padding: '0.5rem 1.4rem',
                          borderRadius: '999px',
                          border: flangerEnabled ? skin.delayOnBorder : skin.delayOffBorder,
                          background: flangerEnabled ? skin.modeActiveBg : 'transparent',
                          color: flangerEnabled ? skin.modeActiveColor : skin.modeInactiveColor,
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.16em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer',
                          boxShadow: flangerEnabled ? skin.controlOnShadow : skin.controlOffShadow,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '999px',
                            background: flangerEnabled ? skin.delayOnDotBg : skin.delayOffDotBg,
                          }}
                        />
                        {flangerEnabled ? 'Flanger On' : 'Flanger Off'}
                      </button>
                    </div>
                    {/* --------- PEDAL DISTO+ (OD / CRUNCH / DIST) ---------- */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.8rem',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: 260,
                          height: 420,
                          backgroundImage: `url(${distoPedalImg})`,
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          paddingBottom: '1.4rem',
                        }}
                      >
                        {/* MODO (OD / CR / DIST) */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '205px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            gap: '0.35rem',
                            padding: '0.35rem 0.55rem',
                            borderRadius: 999,
                            backdropFilter: 'blur(4px)',
                            background: 'rgba(0,0,0,0.45)',
                          }}
                        >
                          {(['overdrive', 'crunch', 'distortion'] as const).map((m) => {
                            const active = valveMode === m;
                            const label = m === 'overdrive' ? 'OD' : m === 'crunch' ? 'CR' : 'DIST';

                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => {
                                  setValveMode(m);
                                  markCustom();
                                }}
                                style={{
                                  padding: '0.35rem 0.55rem',
                                  borderRadius: 999,
                                  border: active ? skin.delayOnBorder : skin.delayOffBorder,
                                  background: active ? skin.modeActiveBg : 'transparent',
                                  color: active ? skin.modeActiveColor : skin.modeInactiveColor,
                                  fontSize: '0.62rem',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.16em',
                                  cursor: 'pointer',
                                  boxShadow: active ? skin.controlOnShadow : skin.controlOffShadow,
                                }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>

                        {/* KNOBS */}
                        <div
                          style={{
                            display: 'flex',
                            padding: '0.4rem 0.7rem',
                            borderRadius: 999,
                            backdropFilter: 'blur(4px)',
                            background: 'rgba(0,0,0,0.45)',
                            position: 'absolute',
                            top: '255px',
                            gap: '0.5rem',
                          }}
                        >
                          <Knob
                            label="Drive"
                            min={0}
                            max={100}
                            value={valveDrive * 100}
                            onChange={(v) => {
                              setValveDrive(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(valveDrive * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Tone"
                            min={0}
                            max={100}
                            value={valveTone * 100}
                            onChange={(v) => {
                              setValveTone(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(valveTone * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Level"
                            min={0}
                            max={120}
                            value={valveLevel * 100}
                            onChange={(v) => {
                              setValveLevel(v / 100);
                              markCustom();
                            }}
                            display={`${valveLevel.toFixed(2)}`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setValveEnabled(!valveEnabled);
                          markCustom();
                        }}
                        style={{
                          padding: '0.55rem 1.4rem',
                          borderRadius: '999px',
                          border: valveEnabled ? skin.delayOnBorder : skin.delayOffBorder,
                          background: valveEnabled ? skin.modeActiveBg : 'transparent',
                          color: valveEnabled ? skin.modeActiveColor : skin.modeInactiveColor,
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.16em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer',
                          boxShadow: valveEnabled ? skin.controlOnShadow : skin.controlOffShadow,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '999px',
                            background: valveEnabled ? skin.delayOnDotBg : skin.delayOffDotBg,
                          }}
                        />
                        {valveEnabled ? 'Disto+ On' : 'Disto+ Off'}
                      </button>
                    </div>
                    {/* --------- PEDAL COMPRESSOR ---------- */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.8rem',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: 260,
                          height: 420,
                          backgroundImage: `url(${pedalOcta})`,
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {/* ===== FILA SUPERIOR (3 knobs) ===== */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 150,
                            display: 'flex',
                            gap: '0.5rem',
                            padding: '0.4rem 0.7rem',
                            borderRadius: 999,
                            backdropFilter: 'blur(4px)',
                            background: 'rgba(0,0,0,0.45)',
                          }}
                        >
                          <Knob
                            label="Thresh"
                            min={-60}
                            max={0}
                            value={compressorThreshold}
                            onChange={(v) => {
                              setCompressorThreshold(v);
                              markCustom();
                            }}
                            display={`${Math.round(compressorThreshold)} dB`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Ratio"
                            min={1}
                            max={20}
                            value={compressorRatio}
                            onChange={(v) => {
                              setCompressorRatio(v);
                              markCustom();
                            }}
                            display={`${compressorRatio.toFixed(1)}:1`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Mix"
                            min={0}
                            max={100}
                            value={compressorMix * 100}
                            onChange={(v) => {
                              setCompressorMix(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(compressorMix * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />
                        </div>

                        {/* ===== FILA INFERIOR (4 knobs) ===== */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 256,
                            display: 'flex',
                            gap: '0.35rem',
                            padding: '0.35rem 0.6rem',
                            borderRadius: 999,
                            backdropFilter: 'blur(4px)',
                            background: 'rgba(0,0,0,0.35)',
                          }}
                        >
                          <Knob
                            label="Attack"
                            min={1}
                            max={80}
                            value={Math.round(compressorAttack * 1000)}
                            onChange={(v) => {
                              setCompressorAttack(v / 1000);
                              markCustom();
                            }}
                            display={`${Math.round(compressorAttack * 1000)} ms`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Release"
                            min={40}
                            max={800}
                            value={Math.round(compressorRelease * 1000)}
                            onChange={(v) => {
                              setCompressorRelease(v / 1000);
                              markCustom();
                            }}
                            display={`${Math.round(compressorRelease * 1000)} ms`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Knee"
                            min={0}
                            max={40}
                            value={compressorKnee}
                            onChange={(v) => {
                              setCompressorKnee(v);
                              markCustom();
                            }}
                            display={`${Math.round(compressorKnee)} dB`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Makeup"
                            min={50}
                            max={200}
                            value={compressorMakeup * 100}
                            onChange={(v) => {
                              setCompressorMakeup(v / 100);
                              markCustom();
                            }}
                            display={`${compressorMakeup.toFixed(2)}x`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />
                        </div>
                      </div>

                      {/* BOTÓN ON / OFF */}
                      <button
                        type="button"
                        onClick={() => {
                          setCompressorEnabled(!compressorEnabled);
                          markCustom();
                        }}
                        style={{
                          padding: '0.55rem 1.4rem',
                          borderRadius: '999px',
                          border: compressorEnabled ? skin.delayOnBorder : skin.delayOffBorder,
                          background: compressorEnabled ? skin.modeActiveBg : 'transparent',
                          color: compressorEnabled ? skin.modeActiveColor : skin.modeInactiveColor,
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.16em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer',
                          boxShadow: compressorEnabled ? skin.controlOnShadow : skin.controlOffShadow,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '999px',
                            background: compressorEnabled ? skin.delayOnDotBg : skin.delayOffDotBg,
                          }}
                        />
                        {compressorEnabled ? 'Comp On' : 'Comp Off'}
                      </button>
                    </div>



                    {/* --------- PEDAL SITAR+ (RAGA) ---------- */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.8rem',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: 260,
                          height: 420,
                          backgroundImage: `url(${pedalRaga})`,
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          paddingBottom: '1.4rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            padding: '0.4rem 0.7rem',
                            borderRadius: 999,
                            backdropFilter: 'blur(4px)',
                            background: 'rgba(0,0,0,0.5)',
                            position: 'absolute',
                            top: '255px',
                            gap: '0.5rem',
                          }}
                        >
                          <Knob
                            label="Resonance"
                            min={0}
                            max={100}
                            value={ragaResonance * 100}
                            onChange={(v) => {
                              setRagaResonance(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(
                              ragaResonance * 100,
                            )}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Drone"
                            min={0}
                            max={100}
                            value={ragaDroneLevel * 100}
                            onChange={(v) => {
                              setRagaDroneLevel(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(
                              ragaDroneLevel * 100,
                            )}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />

                          <Knob
                            label="Color"
                            min={0}
                            max={100}
                            value={ragaColor * 100}
                            onChange={(v) => {
                              setRagaColor(v / 100);
                              markCustom();
                            }}
                            display={`${Math.round(ragaColor * 100)}%`}
                            labelColor="#f9fafb"
                            valueColor="#e5e7eb"
                            faceGradient={skin.knobFaceGradient}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setRagaEnabled(!ragaEnabled);
                          markCustom();
                        }}
                        style={{
                          padding: '0.5rem 1.4rem',
                          borderRadius: '999px',
                          border: ragaEnabled
                            ? skin.delayOnBorder
                            : skin.delayOffBorder,
                          background: ragaEnabled
                            ? skin.modeActiveBg
                            : 'transparent',
                          color: ragaEnabled
                            ? skin.modeActiveColor
                            : skin.modeInactiveColor,
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.16em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer',
                          boxShadow: ragaEnabled
                            ? skin.controlOnShadow
                            : skin.controlOffShadow,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '999px',
                            background: ragaEnabled
                              ? skin.delayOnDotBg
                              : skin.delayOffDotBg,
                          }}
                        />
                        {ragaEnabled ? 'Raga On' : 'Raga Off'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </section>
  );
};

export default AmpPanel;
