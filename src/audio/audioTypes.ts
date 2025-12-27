// src/audio/audioTypes.ts

export type SitarMode = 'sharp' | 'major' | 'minor' | 'exotic';
export type DriveMode = 'overdrive' | 'crunch' | 'distortion';

// ✅ Settings “core” para presets (base + custom)
export type Take = {
  id: string;        // uuid o timestamp
  name: string;      // "Take 01", etc
  blob: Blob;
  url: string;       // ObjectURL o ruta
  durationSec: number;  // segundos
};
export type EngineSettings = {
  isPunchArmed: boolean;
armPunchIn: (cursorSec: number) => void;
setIsPunchArmed: (v: boolean) => void; // opcional

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
  // compresor
  compressorEnabled: boolean;
  
  compressorThreshold: number; // dB (-60..0)
  compressorRatio: number;     // (1..20)
  compressorAttack: number;    // seconds (0.001..0.2)
  compressorRelease: number;   // seconds (0.03..1.0)
  compressorKnee: number;      // dB (0..40)
  compressorMakeup: number;    // 0..2 (gain)
  compressorMix: number;       // 0..1 (parallel blend)

  // ✅ Phaser
  phaserEnabled: boolean;
  phaserRate: number;
  phaserDepth: number;
  phaserFeedback: number;
  phaserMix: number;
  phaserCenter: number;

  // ✅ Flanger
  flangerEnabled: boolean;
  flangerRate: number;
  flangerDepth: number;
  flangerMix: number;
flangerFeedback: number;
  // ✅ Octave
  octaveEnabled: boolean;
  octaveTone: number;
  octaveLevel: number;
  octaveMix: number;

  // ✅ Valve / Disto+
  valveEnabled: boolean;
  valveDrive: number;
  valveTone: number;
  valveLevel: number;
  valveMode: DriveMode;

  // ✅ Raga
  ragaEnabled: boolean;
  ragaResonance: number;
  ragaDroneLevel: number;
  ragaColor: number;
};
export type AudioEngineContextValue = {
   // Punch-in
  isPunchArmed: boolean;
  armPunchIn: (cursorSec: number) => void;

  // opcional (si lo querés exponer)
  setIsPunchArmed?: React.Dispatch<React.SetStateAction<boolean>>;
  status: string;
  isInputReady: boolean;
  isRecording: boolean;
  hasBacking: boolean;

  // ✅ Presets (aplicar / leer settings en un solo punto)
  getCurrentSettings: () => EngineSettings;
  applySettings: (settings: EngineSettings) => void;
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
valveMode: 'overdrive' | 'crunch' | 'distortion';
setValveMode: (v: 'overdrive' | 'crunch' | 'distortion') => void;


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
  ampGain: number; // 0..2 aprox
  setAmpGain: (value: number) => void;
  ampTone: number; // 0..1
  setAmpTone: (value: number) => void;
  ampMaster: number; // 0..2
  setAmpMaster: (value: number) => void;
driveMode: DriveMode;
setDriveMode: (m: DriveMode) => void;
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
octaveTone: number;
setOctaveTone: (v: number) => void;
octaveLevel: number;
setOctaveLevel: (v: number) => void;
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
  // ✅ Octave (Whammy-ish / sub octave)
  octaveEnabled: boolean;
  setOctaveEnabled: (v: boolean) => void;
  octaveMix: number; // 0..1
  setOctaveMix: (v: number) => void;
  // Monitor
  monitorEnabled: boolean;
  setMonitorEnabled: (v: boolean) => void;

  // Tiempo grabando (en segundos)
  recordingSeconds: number;


  // Valve Crunch (pedal aparte)
valveEnabled: boolean;
setValveEnabled: (v: boolean) => void;
valveDrive: number; // 0..1
setValveDrive: (v: number) => void;
valveTone: number; // 0..1
setValveTone: (v: number) => void;
valveLevel: number; // 0..1
setValveLevel: (v: number) => void;



  // ✅ Flanger (Raga Sweep)
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
  phaserRate: number;        // 0..1
  setPhaserRate: (v: number) => void;
  phaserDepth: number;       // 0..1
  setPhaserDepth: (v: number) => void;
  phaserFeedback: number;    // 0..1
  setPhaserFeedback: (v: number) => void;
  phaserMix: number;         // 0..1
  setPhaserMix: (v: number) => void;
  phaserCenter: number;      // 0..1
  setPhaserCenter: (v: number) => void;
// ✅ TAKES
  takes: Take[];
  activeTakeId: string | null;
  setActiveTakeId: React.Dispatch<React.SetStateAction<string | null>>;
  // Acciones
  setupGuitarInput: () => Promise<void>;
  loadBackingFile: (file: File) => Promise<void>;
  startPlaybackAndRecording: () => Promise<void>;
  stopRecording: () => void;


disarmPunchIn: () => void;

};
