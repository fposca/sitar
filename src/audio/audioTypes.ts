// src/audio/audioTypes.ts

export type SitarMode = 'sharp' | 'major' | 'minor' | 'exotic';

export type AudioEngineContextValue = {
  status: string;
  isInputReady: boolean;
  isRecording: boolean;
  hasBacking: boolean;

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

   // Volumen del preview offline
  offlineVolume: number;
  setOfflineVolume: (v: number) => void;

  // Master global
  masterVolume: number;
  setMasterVolume: (v: number) => void;

  // Volumen del backing
  backingVolume: number;
  setBackingVolume: (v: number) => void;

  backingName: string | null;
  backingWaveform: number[] | null;
  playbackProgress: number; // 0..1

  // Delay
  delayTimeMs: number;
  setDelayTimeMs: (value: number) => void;
  feedbackAmount: number;
  setFeedbackAmount: (value: number) => void;
  mixAmount: number;
  setMixAmount: (value: number) => void;

  // Controles de ampli
  ampGain: number; // 0..2 aprox
  setAmpGain: (value: number) => void;
  ampTone: number; // 0..1
  setAmpTone: (value: number) => void;
  ampMaster: number; // 0..2
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

  ragaEnabled: boolean;
setRagaEnabled: (value: boolean) => void;
ragaResonance: number;
setRagaResonance: (value: number) => void;
ragaDroneLevel: number;
setRagaDroneLevel: (value: number) => void;
ragaColor: number;
setRagaColor: (value: number) => void;

  // Efecto sitar (0 = apagado, 1 = máximo)
  sitarAmount: number;
  setSitarAmount: (value: number) => void;

  // Modo del sitar (sharp/major/minor/exotic)
  sitarMode: SitarMode;
  setSitarMode: (mode: SitarMode) => void;

  // Distorsión
  driveAmount: number; // 0..1
  setDriveAmount: (value: number) => void;
  driveEnabled: boolean;
  setDriveEnabled: (value: boolean) => void;

  // Reverb
  reverbAmount: number; // 0..1
  setReverbAmount: (value: number) => void;

  // Monitor
  monitorEnabled: boolean;
  setMonitorEnabled: (v: boolean) => void;

  // Tiempo grabando (en segundos)
  recordingSeconds: number;

  // Acciones
  setupGuitarInput: () => Promise<void>;
  loadBackingFile: (file: File) => Promise<void>;
  startPlaybackAndRecording: () => Promise<void>;
  stopRecording: () => void;
};
