// src/audio/audioTypes.ts
import type React from 'react';

export type SitarMode = 'sharp' | 'major' | 'minor' | 'exotic';
export type DriveMode = 'overdrive' | 'crunch' | 'distortion';

// ✅ Audio takes (grabaciones)
export type Take = {
  id: string; // uuid o timestamp
  name: string; // "Take 01", etc
  blob: Blob;
  url: string; // ObjectURL
  durationSec: number; // segundos
};

// ✅ Settings “core” (SOLO serializable) para presets (base + custom)
// Regla: acá adentro NO van funciones, NO van setters, NO van dispatchers.
export type PresetSettings = {
  // Amp
  ampGain: number;
  ampTone: number;
  ampMaster: number;

  // Tone stack
  bassAmount: number;
  midAmount: number;
  trebleAmount: number;
  presenceAmount: number;

  // Drive (global)
  driveMode: DriveMode;
  driveAmount: number; // 0..1
  driveEnabled: boolean;

  // Delay
  delayEnabled: boolean;
  delayTimeMs: number;
  feedbackAmount: number;
  mixAmount: number;

  // 🔥 Delay extras
  delayHPHz: number;        // High-pass del delay (Hz)
  delayLPHz: number;        // Low-pass del delay (Hz)
  delayModRate: number;     // Hz (0..2)
  delayModDepthMs: number;  // ms (0..20)
  // Reverb
  reverbAmount: number; // 0..1

  // Sitar
  sitarAmount: number; // 0..1
  sitarMode: SitarMode;

  // Compressor
  compressorEnabled: boolean;
  compressorThreshold: number; // dB (-60..0)
  compressorRatio: number; // (1..20)
  compressorAttack: number; // seconds (0.001..0.2)
  compressorRelease: number; // seconds (0.03..1.0)
  compressorKnee: number; // dB (0..40)
  compressorMakeup: number; // 0..2 (gain)
  compressorMix: number; // 0..1 (parallel blend)

  // Phaser
  phaserEnabled: boolean;
  phaserRate: number;
  phaserDepth: number;
  phaserFeedback: number;
  phaserMix: number;
  phaserCenter: number;

  // Flanger
  flangerEnabled: boolean;
  flangerRate: number;
  flangerDepth: number;
  flangerFeedback: number;
  flangerMix: number;

  // Octave
  octaveEnabled: boolean;
  octaveTone: number;
  octaveLevel: number;
  octaveMix: number;

  // Valve / Disto+
  valveEnabled: boolean;
  valveDrive: number;
  valveTone: number;
  valveLevel: number;
  valveMode: DriveMode;

  // Raga
  ragaEnabled: boolean;
  ragaResonance: number;
  ragaDroneLevel: number;
  ragaColor: number;
};

// ✅ Alias para que no tengas que cambiar imports en todo el proyecto
export type EngineSettings = PresetSettings;

// ✅ Context (runtime + acciones + estado UI)
export type AudioEngineContextValue = {
  // Estado general
  status: string;
  isInputReady: boolean;
  isRecording: boolean;
  hasBacking: boolean;

  // ✅ Presets: leer/aplicar settings (UN SOLO PUNTO)
  getCurrentSettings: () => PresetSettings;
  applySettings: (settings: PresetSettings) => void;

  // Analyzer (para visualizaciones)
  getAnalyserNode: () => AnalyserNode | null;

  // 🔹 Metronome
  bpm: number;
  setBpm: (v: number) => void;
  metronomeOn: boolean;
  startMetronome: () => void;
  stopMetronome: () => void;
  metronomeVolume: number;
  setMetronomeVolume: (v: number) => void;

  // 🔹 Procesado offline
  processFileThroughSitar: (file: File) => Promise<void>;
  playProcessed: () => void;
  stopProcessed: () => void;
  exportProcessed: () => void;
  processedWaveform: number[] | null;
  offlinePreviewProgress: number; // 0..1
  offlineVolume: number;
  setOfflineVolume: (v: number) => void;

  // Master global
  masterVolume: number;
  setMasterVolume: (v: number) => void;

  // Volumen del backing
  backingVolume: number;
  setBackingVolume: (v: number) => void;

  // 🔥 Delay extras
  delayHPHz: number;
  setDelayHPHz: (v: number) => void;

  delayLPHz: number;
  setDelayLPHz: (v: number) => void;

  delayModRate: number;
  setDelayModRate: (v: number) => void;

  delayModDepthMs: number;
  setDelayModDepthMs: (v: number) => void;

  backingName: string | null;
  backingWaveform: number[] | null;
  playbackProgress: number; // 0..1

  // Delay (control directo en UI)
  delayTimeMs: number;
  setDelayTimeMs: (value: number) => void;
  feedbackAmount: number;
  setFeedbackAmount: (value: number) => void;
  mixAmount: number;
  setMixAmount: (value: number) => void;

  // ✅ Drive mode (global)
  driveMode: DriveMode;
  setDriveMode: (m: DriveMode) => void;

  // ✅ Valve mode (pedal aparte)
  valveMode: DriveMode;
  setValveMode: (v: DriveMode) => void;

  // ✅ Compressor (pedal)
  compressorEnabled: boolean;
  setCompressorEnabled: (v: boolean) => void;

  compressorThreshold: number;
  setCompressorThreshold: (v: number) => void;

  compressorRatio: number;
  setCompressorRatio: (v: number) => void;

  compressorAttack: number;
  setCompressorAttack: (v: number) => void;

  compressorRelease: number;
  setCompressorRelease: (v: number) => void;

  compressorKnee: number;
  setCompressorKnee: (v: number) => void;

  compressorMakeup: number;
  setCompressorMakeup: (v: number) => void;

  compressorMix: number;
  setCompressorMix: (v: number) => void;

  // Controles de ampli
  ampGain: number;
  setAmpGain: (value: number) => void;
  ampTone: number;
  setAmpTone: (value: number) => void;
  ampMaster: number;
  setAmpMaster: (value: number) => void;

  // Tonestack
  bassAmount: number;
  setBassAmount: (v: number) => void;
  midAmount: number;
  setMidAmount: (v: number) => void;
  trebleAmount: number;
  setTrebleAmount: (v: number) => void;

  // Presence
  presenceAmount: number;
  setPresenceAmount: (v: number) => void;

  // Delay bypass
  delayEnabled: boolean;
  setDelayEnabled: (value: boolean) => void;

  // Sitar
  sitarAmount: number;
  setSitarAmount: (value: number) => void;
  sitarMode: SitarMode;
  setSitarMode: (mode: SitarMode) => void;

  // Distorsión / Drive
  driveAmount: number;
  setDriveAmount: (value: number) => void;
  driveEnabled: boolean;
  setDriveEnabled: (value: boolean) => void;

  // Reverb
  reverbAmount: number;
  setReverbAmount: (value: number) => void;

  // ✅ Octave
  octaveEnabled: boolean;
  setOctaveEnabled: (v: boolean) => void;
  octaveTone: number;
  setOctaveTone: (v: number) => void;
  octaveLevel: number;
  setOctaveLevel: (v: number) => void;
  octaveMix: number;
  setOctaveMix: (v: number) => void;

  // Monitor
  monitorEnabled: boolean;
  setMonitorEnabled: (v: boolean) => void;

  // Tiempo grabando (en segundos)
  recordingSeconds: number;

  // ✅ Valve Crunch (pedal aparte)
  valveEnabled: boolean;
  setValveEnabled: (v: boolean) => void;
  valveDrive: number;
  setValveDrive: (v: number) => void;
  valveTone: number;
  setValveTone: (v: number) => void;
  valveLevel: number;
  setValveLevel: (v: number) => void;

  // ✅ Flanger
  flangerEnabled: boolean;
  setFlangerEnabled: (v: boolean) => void;
  flangerRate: number;
  setFlangerRate: (v: number) => void;
  flangerDepth: number;
  setFlangerDepth: (v: number) => void;
  flangerFeedback: number;
  setFlangerFeedback: (v: number) => void;
  flangerMix: number;
  setFlangerMix: (v: number) => void;

  // ✅ Phaser
  phaserEnabled: boolean;
  setPhaserEnabled: (v: boolean) => void;
  phaserRate: number;
  setPhaserRate: (v: number) => void;
  phaserDepth: number;
  setPhaserDepth: (v: number) => void;
  phaserFeedback: number;
  setPhaserFeedback: (v: number) => void;
  phaserMix: number;
  setPhaserMix: (v: number) => void;
  phaserCenter: number;
  setPhaserCenter: (v: number) => void;

  // ✅ Raga
  ragaEnabled: boolean;
  setRagaEnabled: (value: boolean) => void;
  ragaResonance: number;
  setRagaResonance: (value: number) => void;
  ragaDroneLevel: number;
  setRagaDroneLevel: (value: number) => void;
  ragaColor: number;
  setRagaColor: (value: number) => void;

  // ✅ TAKES
  takes: Take[];
  activeTakeId: string | null;
  setActiveTakeId: React.Dispatch<React.SetStateAction<string | null>>;

  // Acciones
  setupGuitarInput: () => Promise<void>;
  loadBackingFile: (file: File) => Promise<void>;
  startPlaybackAndRecording: () => Promise<void>;
  stopRecording: () => void;

  // Punch-in (runtime)
  isPunchArmed: boolean;
  armPunchIn: (cursorSec: number) => void;
  disarmPunchIn: () => void;

  // (opcional) si querés exponer el setter
  setIsPunchArmed?: React.Dispatch<React.SetStateAction<boolean>>;
};
