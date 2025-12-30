// src/presets/normalizePreset.ts
import type { PresetSettings, DriveMode, SitarMode } from '../audio/audioTypes';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const num = (v: unknown, fallback: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toBool = (v: unknown, fallback: boolean) => {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
};

const toDriveMode = (v: unknown, fallback: DriveMode): DriveMode => {
  return v === 'overdrive' || v === 'crunch' || v === 'distortion' ? v : fallback;
};

const toSitarMode = (v: unknown, fallback: SitarMode): SitarMode => {
  return v === 'sharp' || v === 'major' || v === 'minor' || v === 'exotic' ? v : fallback;
};

// Defaults: usá exactamente los defaults que tenés en useState()
export const DEFAULT_PRESET: PresetSettings = {
  ampGain: 1.0,
  ampTone: 0.5,
  ampMaster: 1.0,

  bassAmount: 0.5,
  midAmount: 0.5,
  trebleAmount: 0.5,
  presenceAmount: 0.5,

  driveMode: 'overdrive',
  driveAmount: 0.6,
  driveEnabled: false,

  delayEnabled: true,
  delayTimeMs: 350,
  feedbackAmount: 0.4,
  mixAmount: 0.6,

  reverbAmount: 0.4,

  sitarAmount: 0.0,
  sitarMode: 'exotic',

  compressorEnabled: false,
  compressorThreshold: -24,
  compressorRatio: 4,
  compressorAttack: 0.01,
  compressorRelease: 0.12,
  compressorKnee: 20,
  compressorMakeup: 1.0,
  compressorMix: 1.0,

  phaserEnabled: false,
  phaserRate: 0.35,
  phaserDepth: 0.6,
  phaserFeedback: 0.25,
  phaserMix: 0.35,
  phaserCenter: 0.5,

  flangerEnabled: false,
  flangerRate: 0.25,
  flangerDepth: 0.55,
  flangerFeedback: 0.25,
  flangerMix: 0.35,

  octaveEnabled: false,
  octaveTone: 0.55,
  octaveLevel: 0.9,
  octaveMix: 0.4,

  valveEnabled: false,
  valveDrive: 0.55,
  valveTone: 0.6,
  valveLevel: 0.9,
  valveMode: 'crunch',

  ragaEnabled: false,
  ragaResonance: 0.5,
  ragaDroneLevel: 0.3,
  ragaColor: 0.5,
};

export function normalizePresetSettings(raw: Partial<PresetSettings> | any): PresetSettings {
  const d = DEFAULT_PRESET;

  return {
    ampGain: clamp(num(raw.ampGain, d.ampGain), 0, 6),
    ampTone: clamp(num(raw.ampTone, d.ampTone), 0, 1),
    ampMaster: clamp(num(raw.ampMaster, d.ampMaster), 0, 3),

    bassAmount: clamp(num(raw.bassAmount, d.bassAmount), 0, 1),
    midAmount: clamp(num(raw.midAmount, d.midAmount), 0, 1),
    trebleAmount: clamp(num(raw.trebleAmount, d.trebleAmount), 0, 1),
    presenceAmount: clamp(num(raw.presenceAmount, d.presenceAmount), 0, 1),

    driveMode: toDriveMode(raw.driveMode, d.driveMode),
    driveAmount: clamp(num(raw.driveAmount, d.driveAmount), 0, 1),
    driveEnabled: toBool(raw.driveEnabled, d.driveEnabled),

    delayEnabled: toBool(raw.delayEnabled, d.delayEnabled),
    delayTimeMs: clamp(num(raw.delayTimeMs, d.delayTimeMs), 0, 2000),
    feedbackAmount: clamp(num(raw.feedbackAmount, d.feedbackAmount), 0, 0.97),
    mixAmount: clamp(num(raw.mixAmount, d.mixAmount), 0, 1),

    reverbAmount: clamp(num(raw.reverbAmount, d.reverbAmount), 0, 1),

    sitarAmount: clamp(num(raw.sitarAmount, d.sitarAmount), 0, 1),
    sitarMode: toSitarMode(raw.sitarMode, d.sitarMode),

    compressorEnabled: toBool(raw.compressorEnabled, d.compressorEnabled),
    compressorThreshold: clamp(num(raw.compressorThreshold, d.compressorThreshold), -60, 0),
    compressorRatio: clamp(num(raw.compressorRatio, d.compressorRatio), 1, 20),
    compressorAttack: clamp(num(raw.compressorAttack, d.compressorAttack), 0.001, 0.2),
    compressorRelease: clamp(num(raw.compressorRelease, d.compressorRelease), 0.03, 1.0),
    compressorKnee: clamp(num(raw.compressorKnee, d.compressorKnee), 0, 40),
    compressorMakeup: clamp(num(raw.compressorMakeup, d.compressorMakeup), 0, 3),
    compressorMix: clamp(num(raw.compressorMix, d.compressorMix), 0, 1),

    phaserEnabled: toBool(raw.phaserEnabled, d.phaserEnabled),
    phaserRate: clamp(num(raw.phaserRate, d.phaserRate), 0, 1),
    phaserDepth: clamp(num(raw.phaserDepth, d.phaserDepth), 0, 1),
    phaserFeedback: clamp(num(raw.phaserFeedback, d.phaserFeedback), 0, 1),
    phaserMix: clamp(num(raw.phaserMix, d.phaserMix), 0, 1),
    phaserCenter: clamp(num(raw.phaserCenter, d.phaserCenter), 0, 1),

    flangerEnabled: toBool(raw.flangerEnabled, d.flangerEnabled),
    flangerRate: clamp(num(raw.flangerRate, d.flangerRate), 0, 1),
    flangerDepth: clamp(num(raw.flangerDepth, d.flangerDepth), 0, 1),
    flangerFeedback: clamp(num(raw.flangerFeedback, d.flangerFeedback), 0, 1),
    flangerMix: clamp(num(raw.flangerMix, d.flangerMix), 0, 1),

    octaveEnabled: toBool(raw.octaveEnabled, d.octaveEnabled),
    octaveTone: clamp(num(raw.octaveTone, d.octaveTone), 0, 1),
    octaveLevel: clamp(num(raw.octaveLevel, d.octaveLevel), 0, 1),
    octaveMix: clamp(num(raw.octaveMix, d.octaveMix), 0, 1),

    valveEnabled: toBool(raw.valveEnabled, d.valveEnabled),
    valveDrive: clamp(num(raw.valveDrive, d.valveDrive), 0, 1),
    valveTone: clamp(num(raw.valveTone, d.valveTone), 0, 1),
    valveLevel: clamp(num(raw.valveLevel, d.valveLevel), 0, 2),
    valveMode: toDriveMode(raw.valveMode, d.valveMode),

    ragaEnabled: toBool(raw.ragaEnabled, d.ragaEnabled),
    ragaResonance: clamp(num(raw.ragaResonance, d.ragaResonance), 0, 1),
    ragaDroneLevel: clamp(num(raw.ragaDroneLevel, d.ragaDroneLevel), 0, 1),
    ragaColor: clamp(num(raw.ragaColor, d.ragaColor), 0, 1),
  };
}
