// src/presets/presetSettings.ts
import type { EngineSettings, SitarMode, DriveMode } from "../audio/audioTypes";

export const CUSTOM_PRESETS_KEY_V1 = "neon-sitar:custom-presets:v1";
export const MAX_CUSTOM_PRESETS = 5;

export type EngineSettingsV1 = EngineSettings;

// 👇 UI (no DSP)
export type UiSkinPreset = "cleanMystic" | "desertLead" | "infernalRaga";
export type UiSubPanel = "amp" | "pedals";

export type CustomPresetV1 = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  settings: EngineSettingsV1;

  // ✅ UI snapshot
  uiSkinPreset?: UiSkinPreset;
  uiSubPanel?: UiSubPanel;
};

type CustomPresetsPayloadV1 = {
  version: 1;
  presets: CustomPresetV1[];
};

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isString = (v: unknown): v is string => typeof v === "string";

export function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function sanitizeSitarMode(raw: unknown): SitarMode | null {
  if (!isString(raw)) return null;
  if (raw === "sharp" || raw === "major" || raw === "minor" || raw === "exotic") return raw;
  return null;
}

function sanitizeValveMode(raw: unknown): DriveMode {
  if (!isString(raw)) return "overdrive";
  if (raw === "overdrive" || raw === "crunch" || raw === "distortion") return raw;
  return "overdrive";
}

function sanitizeUiSkinPreset(raw: unknown): UiSkinPreset | undefined {
  if (!isString(raw)) return undefined;
  if (raw === "cleanMystic" || raw === "desertLead" || raw === "infernalRaga") return raw;
  return undefined;
}

function sanitizeUiSubPanel(raw: unknown): UiSubPanel | undefined {
  if (!isString(raw)) return undefined;
  if (raw === "amp" || raw === "pedals") return raw;
  return undefined;
}

// ✅ defaults (para presets viejos o payload incompleto)
const DEFAULTS: EngineSettingsV1 = {
  // Amp
  ampGain: 1.0,
  ampTone: 0.5,
  ampMaster: 1.0,

  // Tonestack
  bassAmount: 0.5,
  midAmount: 0.5,
  trebleAmount: 0.5,
  presenceAmount: 0.5,

  // Drive
  driveEnabled: false,
  driveAmount: 0.3,

  // Delay
  delayEnabled: false,
  delayTimeMs: 420,
  feedbackAmount: 0.3,
  mixAmount: 0.3,

  // Reverb
  reverbAmount: 0.35,

  // Sitar
  sitarAmount: 0.3,
  sitarMode: "major",

  // Phaser
  phaserEnabled: false,
  phaserRate: 0.25,
  phaserDepth: 0.55,
  phaserFeedback: 0.0,
  phaserMix: 0.45,
  phaserCenter: 0.5,

  // Flanger
  flangerEnabled: false,
  flangerRate: 0.2,
  flangerDepth: 0.6,
  flangerMix: 0.4,

  // Octave
  octaveEnabled: false,
  octaveTone: 0.5,
  octaveLevel: 1.0,
  octaveMix: 0.5,

  // Valve / Disto+
  valveEnabled: false,
  valveDrive: 0.45,
  valveTone: 0.5,
  valveLevel: 1.0,
  valveMode: "overdrive",

  // Raga
  ragaEnabled: false,
  ragaResonance: 0.5,
  ragaDroneLevel: 0.4,
  ragaColor: 0.5,
  compressorEnabled: false,
  compressorThreshold: 0,
  compressorRatio: 0,
  compressorAttack: 0,
  compressorRelease: 0,
  compressorKnee: 0,
  compressorMakeup: 0,
  compressorMix: 0,
  flangerFeedback: 0,
  isPunchArmed: false,
  armPunchIn: function (cursorSec: number): void {
    throw new Error("Function not implemented.");
  },
  setIsPunchArmed: function (v: boolean): void {
    throw new Error("Function not implemented.");
  }
};

function sanitizeSettingsV1(raw: any): EngineSettingsV1 | null {
  if (!raw || typeof raw !== "object") return null;

  // mínimos obligatorios (core)
  const required: Array<[keyof EngineSettingsV1, (v: any) => boolean]> = [
    ["ampGain", isNumber],
    ["ampTone", isNumber],
    ["ampMaster", isNumber],

    ["bassAmount", isNumber],
    ["midAmount", isNumber],
    ["trebleAmount", isNumber],
    ["presenceAmount", isNumber],

    ["driveEnabled", isBool],
    ["driveAmount", isNumber],

    ["delayEnabled", isBool],
    ["delayTimeMs", isNumber],
    ["feedbackAmount", isNumber],
    ["mixAmount", isNumber],

    ["reverbAmount", isNumber],

    ["sitarAmount", isNumber],
    ["sitarMode", isString],
  ];

  for (const [k, test] of required) {
    if (!test(raw[k])) return null;
  }

  const sitarMode = sanitizeSitarMode(raw.sitarMode);
  if (!sitarMode) return null;

  // base defaults + core normalizado
  const s: EngineSettingsV1 = {
    ...DEFAULTS,

    ampGain: raw.ampGain,
    ampTone: clamp01(raw.ampTone),
    ampMaster: raw.ampMaster,

    bassAmount: clamp01(raw.bassAmount),
    midAmount: clamp01(raw.midAmount),
    trebleAmount: clamp01(raw.trebleAmount),
    presenceAmount: clamp01(raw.presenceAmount),

    driveEnabled: raw.driveEnabled,
    driveAmount: clamp01(raw.driveAmount),

    delayEnabled: raw.delayEnabled,
    delayTimeMs: Math.max(0, raw.delayTimeMs),
    feedbackAmount: clamp01(raw.feedbackAmount),
    mixAmount: clamp01(raw.mixAmount),

    reverbAmount: clamp01(raw.reverbAmount),

    sitarAmount: clamp01(raw.sitarAmount),
    sitarMode,
  };

  // Extras: si vienen, pisan defaults
  if (isBool(raw.phaserEnabled)) s.phaserEnabled = raw.phaserEnabled;
  if (isNumber(raw.phaserRate)) s.phaserRate = clamp01(raw.phaserRate);
  if (isNumber(raw.phaserDepth)) s.phaserDepth = clamp01(raw.phaserDepth);
  if (isNumber(raw.phaserFeedback)) s.phaserFeedback = clamp01(raw.phaserFeedback);
  if (isNumber(raw.phaserMix)) s.phaserMix = clamp01(raw.phaserMix);
  if (isNumber(raw.phaserCenter)) s.phaserCenter = clamp01(raw.phaserCenter);

  if (isBool(raw.flangerEnabled)) s.flangerEnabled = raw.flangerEnabled;
  if (isNumber(raw.flangerRate)) s.flangerRate = clamp01(raw.flangerRate);
  if (isNumber(raw.flangerDepth)) s.flangerDepth = clamp01(raw.flangerDepth);
  if (isNumber(raw.flangerMix)) s.flangerMix = clamp01(raw.flangerMix);

  if (isBool(raw.octaveEnabled)) s.octaveEnabled = raw.octaveEnabled;
  if (isNumber(raw.octaveTone)) s.octaveTone = clamp01(raw.octaveTone);
  if (isNumber(raw.octaveLevel)) s.octaveLevel = clamp01(raw.octaveLevel);
  if (isNumber(raw.octaveMix)) s.octaveMix = clamp01(raw.octaveMix);

  if (isBool(raw.valveEnabled)) s.valveEnabled = raw.valveEnabled;
  if (isNumber(raw.valveDrive)) s.valveDrive = clamp01(raw.valveDrive);
  if (isNumber(raw.valveTone)) s.valveTone = clamp01(raw.valveTone);
  if (isNumber(raw.valveLevel)) s.valveLevel = clamp01(raw.valveLevel);
  if (raw.valveMode != null) s.valveMode = sanitizeValveMode(raw.valveMode);

  if (isBool(raw.ragaEnabled)) s.ragaEnabled = raw.ragaEnabled;
  if (isNumber(raw.ragaResonance)) s.ragaResonance = clamp01(raw.ragaResonance);
  if (isNumber(raw.ragaDroneLevel)) s.ragaDroneLevel = clamp01(raw.ragaDroneLevel);
  if (isNumber(raw.ragaColor)) s.ragaColor = clamp01(raw.ragaColor);

  return s;
}

export function loadCustomPresets(): CustomPresetV1[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY_V1);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomPresetsPayloadV1;

    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.presets)) return [];

    const cleaned: CustomPresetV1[] = [];
    for (const p of parsed.presets) {
      if (!p || typeof p !== "object") continue;

      const id = (p as any).id;
      const name = (p as any).name;
      const createdAt = (p as any).createdAt;
      const updatedAt = (p as any).updatedAt;

      if (!isString(id) || !isString(name) || !isNumber(createdAt) || !isNumber(updatedAt)) continue;

      const settings = sanitizeSettingsV1((p as any).settings);
      if (!settings) continue;

      cleaned.push({
        id,
        name,
        createdAt,
        updatedAt,
        settings,

        // ✅ UI (si existe)
        uiSkinPreset: sanitizeUiSkinPreset((p as any).uiSkinPreset),
        uiSubPanel: sanitizeUiSubPanel((p as any).uiSubPanel),
      });
    }

    return cleaned.slice(0, MAX_CUSTOM_PRESETS);
  } catch {
    return [];
  }
}

export function saveCustomPresets(presets: CustomPresetV1[]) {
  const payload: CustomPresetsPayloadV1 = {
    version: 1,
    presets: presets.slice(0, MAX_CUSTOM_PRESETS),
  };
  localStorage.setItem(CUSTOM_PRESETS_KEY_V1, JSON.stringify(payload));
}

export function upsertCustomPreset(
  presets: CustomPresetV1[],
  args: {
    id?: string;
    name: string;
    settings: EngineSettingsV1;
    uiSkinPreset?: UiSkinPreset;
    uiSubPanel?: UiSubPanel;
  },
): CustomPresetV1[] {
  const now = Date.now();
  const id = args.id ?? crypto.randomUUID();

  const idx = presets.findIndex((p) => p.id === id);
  if (idx >= 0) {
    const updated: CustomPresetV1 = {
      ...presets[idx],
      name: args.name,
      updatedAt: now,
      settings: args.settings,
      uiSkinPreset: args.uiSkinPreset,
      uiSubPanel: args.uiSubPanel,
    };
    const copy = presets.slice();
    copy[idx] = updated;
    return copy;
  }

  if (presets.length >= MAX_CUSTOM_PRESETS) return presets;

  return [
    ...presets,
    {
      id,
      name: args.name,
      createdAt: now,
      updatedAt: now,
      settings: args.settings,
      uiSkinPreset: args.uiSkinPreset,
      uiSubPanel: args.uiSubPanel,
    },
  ];
}

export function deleteCustomPreset(presets: CustomPresetV1[], id: string) {
  return presets.filter((p) => p.id !== id);
}

export function renameCustomPreset(presets: CustomPresetV1[], id: string, name: string) {
  const now = Date.now();
  return presets.map((p) => (p.id === id ? { ...p, name, updatedAt: now } : p));
}
