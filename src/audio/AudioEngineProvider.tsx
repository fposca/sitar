// src/audio/AudioEngineProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { AudioEngineContextValue, DriveMode, EngineSettings, PresetSettings, SitarMode } from './audioTypes';
import { applySitarMode, makeDriveCurve, computeWaveform } from './audioDSP';
type Take = {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  durationSec: number;
};

// Convierte un AudioBuffer en un ArrayBuffer con formato WAV PCM 16-bit
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  const bitDepth = 16;
  const format = 1; // PCM

  const blockAlign = (numChannels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const bufferSize = 44 + dataSize;

  const wav = new ArrayBuffer(bufferSize);
  const view = new DataView(wav);

  let offset = 0;

  const writeString = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset++, str.charCodeAt(i));
    }
  };

  const writeUint32 = (val: number) => {
    view.setUint32(offset, val, true);
    offset += 4;
  };

  const writeUint16 = (val: number) => {
    view.setUint16(offset, val, true);
    offset += 2;
  };

  // RIFF header
  writeString('RIFF');
  writeUint32(36 + dataSize);
  writeString('WAVE');

  // fmt chunk
  writeString('fmt ');
  writeUint32(16); // tamaño del subchunk
  writeUint16(format);
  writeUint16(numChannels);
  writeUint32(sampleRate);
  writeUint32(byteRate);
  writeUint16(blockAlign);
  writeUint16(bitDepth);

  // data chunk
  writeString('data');
  writeUint32(dataSize);

  // Samples intercalados
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channelData[ch][i];
      sample = Math.max(-1, Math.min(1, sample)); // clamp
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return wav;
}

async function blobToAudioBuffer(ctx: AudioContext, blob: Blob) {
  const ab = await blob.arrayBuffer();
  return await ctx.decodeAudioData(ab.slice(0));
}

function sliceAudioBuffer(ctx: BaseAudioContext, src: AudioBuffer, startSec: number): AudioBuffer {
  const sr = src.sampleRate;
  const start = Math.max(0, Math.min(src.length, Math.floor(startSec * sr)));
  const outLen = Math.max(0, src.length - start);

  const out = ctx.createBuffer(src.numberOfChannels, outLen, sr);

  for (let ch = 0; ch < out.numberOfChannels; ch++) {
    const s = src.getChannelData(ch);
    const o = out.getChannelData(ch);
    o.set(s.subarray(start, start + outLen));
  }

  return out;
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const wavArrayBuffer = audioBufferToWav(buffer);
  return new Blob([wavArrayBuffer], { type: 'audio/wav' });
}


function spliceReplaceWithCrossfade(
  ctx: BaseAudioContext,
  base: AudioBuffer,
  insert: AudioBuffer,
  startSec: number,
  xfadeMs = 10
) {
  const sr = base.sampleRate;
  const start = Math.max(0, Math.min(base.length, Math.floor(startSec * sr)));
  const insertLen = insert.length;

  const endReplace = Math.min(base.length, start + insertLen);

  const outLen = start + insertLen + (base.length - endReplace);
  const out = ctx.createBuffer(base.numberOfChannels, outLen, sr);

  const xfade = Math.floor((xfadeMs / 1000) * sr);

  for (let ch = 0; ch < out.numberOfChannels; ch++) {
    const o = out.getChannelData(ch);
    const b = base.getChannelData(Math.min(ch, base.numberOfChannels - 1));
    const i = insert.getChannelData(Math.min(ch, insert.numberOfChannels - 1));

    // 1) copy base head
    o.set(b.subarray(0, start), 0);

    // 2) copy insert with fade-in + fade-out
    // fade-in
    for (let n = 0; n < Math.min(xfade, insertLen); n++) {
      const t = n / Math.max(1, Math.min(xfade, insertLen) - 1);
      o[start + n] = i[n] * t;
    }
    // middle
    const midStart = Math.min(xfade, insertLen);
    const midEnd = Math.max(midStart, insertLen - xfade);
    if (midEnd > midStart) {
      o.set(i.subarray(midStart, midEnd), start + midStart);
    }
    // fade-out
    for (let n = Math.max(midEnd, 0); n < insertLen; n++) {
      const idx = n - midEnd;
      const denom = Math.max(1, insertLen - midEnd - 1);
      const t = 1 - idx / denom;
      o[start + n] = i[n] * t;
    }

    // 3) copy base tail (después del tramo reemplazado)
    const tail = b.subarray(endReplace);
    o.set(tail, start + insertLen);
  }

  return out;
}

const AudioEngineContext = createContext<AudioEngineContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAudioEngine = () => {
  const ctx = useContext(AudioEngineContext);
  if (!ctx) throw new Error('useAudioEngine debe usarse dentro de AudioEngineProvider');
  return ctx;
};

// re-export de tipos para que puedas seguir importando desde este archivo
export type { SitarMode } from './audioTypes';

type Props = {
  children: React.ReactNode;
};
// Construye el graph OFFLINE (incluye pedales)
function buildOfflineFullGraph(ctx: BaseAudioContext, s: PresetSettings) {
  const input = new GainNode(ctx, { gain: 1 });

  // === TONESTACK ===
  const bass = new BiquadFilterNode(ctx, {
    type: 'lowshelf',
    frequency: 120,
    gain: (s.bassAmount - 0.5) * 12,
  });

  const mid = new BiquadFilterNode(ctx, {
    type: 'peaking',
    frequency: 900,
    Q: 1.0,
    gain: (s.midAmount - 0.5) * 10,
  });

  const treble = new BiquadFilterNode(ctx, {
    type: 'highshelf',
    frequency: 3500,
    gain: (s.trebleAmount - 0.5) * 12,
  });

  input.connect(bass);
  bass.connect(mid);
  mid.connect(treble);

  // === AMP INPUT ===
  const ampGain = new GainNode(ctx, { gain: s.ampGain });
  treble.connect(ampGain);

  // === PRE-DRIVE band-limit ===
  const preDriveHP = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 85, Q: 0.707 });
  const preDriveLP = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 4500, Q: 0.707 });
  ampGain.connect(preDriveHP);
  preDriveHP.connect(preDriveLP);

  // === DRIVE true bypass (offline) ===
  const driveDry = new GainNode(ctx, { gain: s.driveEnabled ? 0 : 1 });
  const driveWet = new GainNode(ctx, { gain: s.driveEnabled ? 1 : 0 });

  const drivePad = new GainNode(ctx, { gain: 0.6 });
  const antiRfPreDrive = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 9500, Q: 0.7 });

  const shaper = new WaveShaperNode(ctx, { oversample: '4x' });
  shaper.curve = makeDriveCurve(s.driveMode ?? 'overdrive', s.driveEnabled ? s.driveAmount : 0);

  preDriveLP.connect(driveDry);

  preDriveLP.connect(drivePad);
  drivePad.connect(antiRfPreDrive);
  antiRfPreDrive.connect(shaper);
  shaper.connect(driveWet);

  const driveSum = new GainNode(ctx, { gain: 1 });
  driveDry.connect(driveSum);
  driveWet.connect(driveSum);

  const postDriveLP = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 5500, Q: 0.707 });
  driveSum.connect(postDriveLP);

  // === AMP TONE (lowpass) ===
  const tone = new BiquadFilterNode(ctx, { type: 'lowpass' });
  const minTone = 200;
  const maxTone = 16000;
  tone.frequency.value = minTone + s.ampTone * (maxTone - minTone);
  postDriveLP.connect(tone);

  // === COMP (true bypass + parallel mix) ===
  const comp = new DynamicsCompressorNode(ctx, {
    threshold: s.compressorThreshold,
    ratio: s.compressorRatio,
    attack: s.compressorAttack,
    release: s.compressorRelease,
    knee: s.compressorKnee,
  });

  const makeup = new GainNode(ctx, { gain: s.compressorMakeup });

  const compDry = new GainNode(ctx, { gain: s.compressorEnabled ? (1 - s.compressorMix) : 1 });
  const compWet = new GainNode(ctx, { gain: s.compressorEnabled ? s.compressorMix : 0 });

  tone.connect(compDry);
  tone.connect(comp);
  comp.connect(makeup);
  makeup.connect(compWet);

  const compSum = new GainNode(ctx, { gain: 1 });
  compDry.connect(compSum);
  compWet.connect(compSum);

  // ====== PEDALES EN SERIE (valve -> octave -> phaser -> flanger) ======

  let chain: AudioNode = compSum;

  // --- VALVE (true bypass) ---
  {
    const dry = new GainNode(ctx, { gain: s.valveEnabled ? 0 : 1 });
    const wet = new GainNode(ctx, { gain: s.valveEnabled ? 1 : 0 });

    const antiRf = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 9500, Q: 0.7 });
    const vShaper = new WaveShaperNode(ctx, { oversample: '4x' });
    vShaper.curve = makeDriveCurve(s.valveMode ?? 'crunch', s.valveEnabled ? s.valveDrive : 0);

    const vTone = new BiquadFilterNode(ctx, { type: 'lowpass' });
    vTone.frequency.value = 800 + s.valveTone * (16000 - 800);

    const vLevel = new GainNode(ctx, { gain: s.valveLevel });

    chain.connect(dry);
    chain.connect(antiRf);
    antiRf.connect(vShaper);
    vShaper.connect(vTone);
    vTone.connect(vLevel);
    vLevel.connect(wet);

    const sum = new GainNode(ctx, { gain: 1 });
    dry.connect(sum);
    wet.connect(sum);
    chain = sum;
  }

  // --- OCTAVE (tu ring-mod simplificado) ---
  {
    const dry = new GainNode(ctx, { gain: s.octaveEnabled ? (1 - s.octaveMix) : 1 });
    const wet = new GainNode(ctx, {
      gain: s.octaveEnabled ? (s.octaveMix * (0.5 + s.octaveLevel * 1.5)) : 0,
    });

    const ring = new GainNode(ctx, { gain: 1 });

    const osc = new OscillatorNode(ctx, { type: 'sine', frequency: 440 });
    const modDepth = new GainNode(ctx, { gain: s.octaveEnabled ? (s.octaveMix * 2.0) : 0 });
    osc.connect(modDepth);
    modDepth.connect(ring.gain);
    osc.start();

    const toneF = new BiquadFilterNode(ctx, { type: 'lowpass' });
    toneF.frequency.value = 800 + s.octaveTone * (16000 - 800);

    chain.connect(dry);
    chain.connect(ring);
    ring.connect(toneF);
    toneF.connect(wet);

    const sum = new GainNode(ctx, { gain: 1 });
    dry.connect(sum);
    wet.connect(sum);
    chain = sum;
  }

  // --- PHASER (mix simple) ---
  {
    const phIn = new GainNode(ctx, { gain: 1 });
    chain.connect(phIn);

    const dry = new GainNode(ctx, { gain: s.phaserEnabled ? (1 - s.phaserMix) : 1 });
    const wet = new GainNode(ctx, { gain: s.phaserEnabled ? s.phaserMix : 0 });
    phIn.connect(dry);

    const stages = 6;
    const aps: BiquadFilterNode[] = [];
    for (let i = 0; i < stages; i++) {
      aps.push(new BiquadFilterNode(ctx, { type: 'allpass', frequency: 900, Q: 0.7 }));
    }
    phIn.connect(aps[0]);
    for (let i = 0; i < stages - 1; i++) aps[i].connect(aps[i + 1]);

    const fb = new GainNode(ctx, { gain: s.phaserEnabled ? (s.phaserFeedback * 0.85) : 0 });
    aps[stages - 1].connect(fb);
    fb.connect(phIn);

    aps[stages - 1].connect(wet);

    // LFO
    const minHz = 0.05;
    const maxHz = 2.5;
    const hz = minHz + s.phaserRate * (maxHz - minHz);

    const minF = 250;
    const maxF = 1800;
    const base = minF + s.phaserCenter * (maxF - minF);

    const sweep = 50 + s.phaserDepth * 1400;

    const lfo = new OscillatorNode(ctx, { type: 'sine', frequency: hz });
    const lfoGain = new GainNode(ctx, { gain: s.phaserEnabled ? sweep : 0 });
    lfo.connect(lfoGain);
    aps.forEach((ap) => {
      ap.frequency.value = base;
      lfoGain.connect(ap.frequency);
    });
    lfo.start();

    const sum = new GainNode(ctx, { gain: 1 });
    dry.connect(sum);
    wet.connect(sum);
    chain = sum;
  }

  // --- FLANGER ---
  {
    const flIn = new GainNode(ctx, { gain: 1 });
    chain.connect(flIn);

    const dry = new GainNode(ctx, { gain: s.flangerEnabled ? (1 - s.flangerMix) : 1 });
    const wet = new GainNode(ctx, { gain: s.flangerEnabled ? s.flangerMix : 0 });
    flIn.connect(dry);

    const d = new DelayNode(ctx, { delayTime: 0.0025, maxDelayTime: 0.02 });
    const fb = new GainNode(ctx, { gain: s.flangerEnabled ? (s.flangerFeedback * 0.85) : 0 });

    flIn.connect(d);
    d.connect(fb);
    fb.connect(d);
    d.connect(wet);

    const minHz = 0.05;
    const maxHz = 1.2;
    const hz = minHz + s.flangerRate * (maxHz - minHz);
    const depthMs = 4.0 * s.flangerDepth;

    const lfo = new OscillatorNode(ctx, { type: 'sine', frequency: hz });
    const lfoGain = new GainNode(ctx, { gain: s.flangerEnabled ? (depthMs / 1000) : 0 });
    lfo.connect(lfoGain);
    lfoGain.connect(d.delayTime);
    lfo.start();

    const sum = new GainNode(ctx, { gain: 1 });
    dry.connect(sum);
    wet.connect(sum);
    chain = sum;
  }

  // ====== RAGA (paralelo al bus, lo sumamos antes del delay) ======
  // Bus donde se suma TODO antes del delay (incluye sitar/raga)
  const preDelayBus = new GainNode(ctx, { gain: 1 });

  // --- SITAR (dry/wet) ---
  {
    const sitarDry = new GainNode(ctx, { gain: 1 - s.sitarAmount });
    const sitarWet = new GainNode(ctx, { gain: s.sitarAmount });

    const band = new BiquadFilterNode(ctx, { type: 'bandpass' });
    const symp = new BiquadFilterNode(ctx, { type: 'bandpass' });

    const jawari = new WaveShaperNode(ctx, { oversample: '4x' });
    jawari.curve = makeDriveCurve('distortion', 0.55);

    const jDelay = new DelayNode(ctx, { delayTime: 0.0015, maxDelayTime: 0.02 });
    const jFb = new GainNode(ctx, { gain: 0.65 });
    const jHP = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 1800 });

    applySitarMode(s.sitarMode, {
      sitarBandpass: band,
      sitarSympathetic: symp,
      jawariDrive: jawari,
      jawariHighpass: jHP,
    });

    // entrada a la sección sitar es "chain"
    chain.connect(sitarDry);
    chain.connect(band);
    chain.connect(symp);

    band.connect(jawari);
    jawari.connect(jDelay);
    jDelay.connect(jFb);
    jFb.connect(jDelay);
    jDelay.connect(jHP);
    jHP.connect(sitarWet);

    symp.connect(sitarWet);

    // suma en preDelay
    sitarDry.connect(preDelayBus);
    sitarWet.connect(preDelayBus);
  }

  // --- RAGA resonador en paralelo ---
  {
    const res1 = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 2200, Q: 10, gain: 0 });
    const res2 = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 6200, Q: 16, gain: 0 });

    const rDrive = new WaveShaperNode(ctx, { oversample: '4x' });
    rDrive.curve = makeDriveCurve('crunch', 0.25);

    const mix = new GainNode(ctx, { gain: s.ragaEnabled ? (0.15 + s.ragaDroneLevel * 1.35) : 0 });

    // parámetros en base a knobs
    const base1 = 900 + s.ragaColor * 3200;
    const base2 = 2800 + s.ragaColor * 2200;
    res1.frequency.value = base1;
    res2.frequency.value = base2;

    const q1 = 3 + s.ragaResonance * 22;
    const q2 = 3 + s.ragaResonance * 6;
    res1.Q.value = q1;
    res2.Q.value = q2;

    const g1 = 2 + s.ragaResonance * 16;
    const g2 = 1 + s.ragaResonance * 6;
    res1.gain.value = g1;
    res2.gain.value = g2;

    const preHP = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 120, Q: 0.707 });
    const preLP = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 3600, Q: 0.707 });
    const preDriveLP = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 5200, Q: 0.707 });
    const antiRF = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 6000, Q: 0.7 });

    chain.connect(preHP);
    preHP.connect(preLP);
    preLP.connect(res1);
    res1.connect(res2);
    res2.connect(preDriveLP);
    preDriveLP.connect(rDrive);
    rDrive.connect(mix);
    mix.connect(antiRF);

    antiRF.connect(preDelayBus);
  }

  // ====== DELAY ======
  const dry = new GainNode(ctx, { gain: 1 - s.mixAmount });
  const wet = new GainNode(ctx, { gain: s.delayEnabled ? s.mixAmount : 0 });

  const delay = new DelayNode(ctx, { delayTime: s.delayTimeMs / 1000, maxDelayTime: 2.0 });
  const fb = new GainNode(ctx, { gain: s.feedbackAmount });

  preDelayBus.connect(dry);
  preDelayBus.connect(delay);
  delay.connect(wet);
  delay.connect(fb);
  fb.connect(delay);

  // ====== AMP MASTER + PRESENCE ======
  const master = new GainNode(ctx, { gain: s.ampMaster * 2.0 });

  dry.connect(master);
  wet.connect(master);

  const presence = new BiquadFilterNode(ctx, {
    type: 'highshelf',
    frequency: 5500,
    gain: (s.presenceAmount - 0.5) * 14,
  });

  master.connect(presence);

  // ====== REVERB ======
  const reverbDry = new GainNode(ctx, { gain: 1 - s.reverbAmount });
  const reverbWet = new GainNode(ctx, { gain: s.reverbAmount });

  const convolver = new ConvolverNode(ctx);
  // OJO: acá NO tenemos getReverbImpulse (AudioContext) porque ctx puede ser Offline.
  // Creamos impulse simple inline (igual al tuyo).
  {
    const duration = 1.8;
    const rate = ctx.sampleRate;
    const length = Math.floor(duration * rate);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5);
      }
    }
    convolver.buffer = impulse;
  }

  presence.connect(reverbDry);
  presence.connect(convolver);
  convolver.connect(reverbWet);

  const output = new GainNode(ctx, { gain: 1 });
  reverbDry.connect(output);
  reverbWet.connect(output);

  return { input, output };
}

function rms(buffer: AudioBuffer) {
  const ch0 = buffer.getChannelData(0);
  let sum = 0;
  for (let i = 0; i < ch0.length; i++) sum += ch0[i] * ch0[i];
  return Math.sqrt(sum / ch0.length);
}

// Construye el graph con el ctx que le pases (AudioContext u OfflineAudioContext)
function buildBasicGraph(ctx: BaseAudioContext, settings: EngineSettings) {
  const input = new GainNode(ctx, { gain: 1 });

  // PRE
  const pre = new GainNode(ctx, { gain: 1 });
  input.connect(pre);

  // DRIVE paralelo
  const shaper = new WaveShaperNode(ctx, { oversample: '4x' });

  // 🔥 FIX: makeDriveCurve(mode, amount)
  // Si vos tenés driveMode en settings, usalo. Si no, default “distortion”.
  const mode = (settings as any).driveMode ?? 'distortion';
  shaper.curve = makeDriveCurve(mode, settings.driveAmount);

  const driveMix = new GainNode(ctx, { gain: settings.driveEnabled ? 1 : 0 });
  const dryMix = new GainNode(ctx, { gain: settings.driveEnabled ? 0 : 1 });

  // pre.connect(dryMix);
  // dryMix.connect(ctx.destination); // OJO: esto NO, lo conectamos luego (ver abajo)
  // ⛔️ IMPORTANTE: NO conectes a destination acá. Abajo te muestro cómo.

  // En vez de conectarlo a destination, armamos un “sum node”
  const sum = new GainNode(ctx, { gain: 1 });

  // dry
  pre.connect(dryMix);
  dryMix.connect(sum);

  // wet
  pre.connect(shaper);
  shaper.connect(driveMix);
  driveMix.connect(sum);

  // COMP
  const comp = new DynamicsCompressorNode(ctx, {
    threshold: settings.compressorThreshold,
    ratio: settings.compressorRatio,
    attack: settings.compressorAttack,
    release: settings.compressorRelease,
    knee: settings.compressorKnee,
  });

  const makeup = new GainNode(ctx, { gain: settings.compressorMakeup });

  sum.connect(comp);
  comp.connect(makeup);

  // EQ (simple)
  const bass = new BiquadFilterNode(ctx, {
    type: 'lowshelf',
    frequency: 120,
    gain: (settings.bassAmount - 0.5) * 24,
  });
  const mid = new BiquadFilterNode(ctx, {
    type: 'peaking',
    frequency: 750,
    Q: 1,
    gain: (settings.midAmount - 0.5) * 18,
  });
  const treble = new BiquadFilterNode(ctx, {
    type: 'highshelf',
    frequency: 3500,
    gain: (settings.trebleAmount - 0.5) * 24,
  });
  const presence = new BiquadFilterNode(ctx, {
    type: 'peaking',
    frequency: 4200,
    Q: 0.7,
    gain: (settings.presenceAmount - 0.5) * 18,
  });

  makeup.connect(bass);
  bass.connect(mid);
  mid.connect(treble);
  treble.connect(presence);

  const ampGain = new GainNode(ctx, { gain: settings.ampGain });
  const master = new GainNode(ctx, { gain: settings.ampMaster });

  presence.connect(ampGain);
  ampGain.connect(master);

  return { input, output: master };
}

export const AudioEngineProvider: React.FC<Props> = ({ children }) => {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [backingBuffer, setBackingBuffer] = useState<AudioBuffer | null>(null);
  const [backingName, setBackingName] = useState<string | null>(null);
  const [backingWaveform, setBackingWaveform] = useState<number[] | null>(null);
  const [driveMode, setDriveMode] = useState<DriveMode>('overdrive');
  // ✅ Compressor
  const [compressorEnabled, setCompressorEnabled] = useState(false);
  const [compressorThreshold, setCompressorThreshold] = useState(-24);
  const [compressorRatio, setCompressorRatio] = useState(4);
  const [compressorAttack, setCompressorAttack] = useState(0.01);
  const [compressorRelease, setCompressorRelease] = useState(0.12);
  const [compressorKnee, setCompressorKnee] = useState(20);
  const [compressorMakeup, setCompressorMakeup] = useState(1.0);
  const [compressorMix, setCompressorMix] = useState(1.0); // 1 = full comp, 0 = dry
  // const [processedBuffer, setProcessedBffer] = useState<AudioBuffer | null>(null);


  // ✅ Phaser
  const [phaserEnabled, setPhaserEnabled] = useState(false);
  const [phaserRate, setPhaserRate] = useState(0.35);     // 0..1
  const [phaserDepth, setPhaserDepth] = useState(0.6);    // 0..1
  const [phaserFeedback, setPhaserFeedback] = useState(0.25); // 0..1
  const [phaserMix, setPhaserMix] = useState(0.35);       // 0..1
  const [phaserCenter, setPhaserCenter] = useState(0.5);  // 0..1 (base freq)

  // 🎵 Octave pedal
  const [octaveEnabled, setOctaveEnabled] = useState(false);
  const [octaveMix, setOctaveMix] = useState(0.4); // 0..1
  const [octaveTone, setOctaveTone] = useState(0.55);  // 0..1
  const [octaveLevel, setOctaveLevel] = useState(0.9); // 0..1
  // const [octaveAmount, setOctaveAmount] = useState(1); // 1 = +1 octava

  const [isInputReady, setIsInputReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<string>('Esperando...');
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const [monitorEnabled, setMonitorEnabled] = useState<boolean>(false);

  // Parámetros del delay
  const [delayTimeMs, setDelayTimeMs] = useState(350);
  const [feedbackAmount, setFeedbackAmount] = useState(0.4);
  const [mixAmount, setMixAmount] = useState(0.6);

  // ✅ Valve Crunch
  const [valveEnabled, setValveEnabled] = useState(false);
  const [valveDrive, setValveDrive] = useState(0.55); // saturación
  const [valveTone, setValveTone] = useState(0.6);    // brillo
  const [valveLevel, setValveLevel] = useState(0.9);  // volumen pedal
  const [valveMode, setValveMode] =
    useState<'overdrive' | 'crunch' | 'distortion'>('crunch');

  // ✅ Flanger (Raga Sweep)
  const [flangerEnabled, setFlangerEnabled] = useState(false);
  const [flangerRate, setFlangerRate] = useState(0.25);      // velocidad LFO
  const [flangerDepth, setFlangerDepth] = useState(0.55);    // profundidad mod
  const [flangerFeedback, setFlangerFeedback] = useState(0.25); // realimentación
  const [flangerMix, setFlangerMix] = useState(0.35);        // mezcla wet


  // Controles de ampli
  const [ampGain, setAmpGain] = useState(1.0); // 1 = unity
  const [ampTone, setAmpTone] = useState(0.5); // 0..1
  const [ampMaster, setAmpMaster] = useState(1.0);

  // Tonestack
  const [bassAmount, setBassAmount] = useState(0.5); // 0..1
  const [midAmount, setMidAmount] = useState(0.5); // 0..1
  const [trebleAmount, setTrebleAmount] = useState(0.5); // 0..1
  const [presenceAmount, setPresenceAmount] = useState(0.5); // 0..1

  // Delay bypass
  const [delayEnabled, setDelayEnabled] = useState(true);
  // 🔁 Delay extras
  const [delayHPHz, setDelayHPHz] = useState(120);     // corte graves
  const [delayLPHz, setDelayLPHz] = useState(6000);   // corte agudos
  const [delayModRate, setDelayModRate] = useState(0.35); // Hz
  const [delayModDepthMs, setDelayModDepthMs] = useState(3); // ms


  // volumen master
  const [masterVolume, setMasterVolume] = useState(1.0);

  // Efecto sitar
  const [sitarAmount, setSitarAmount] = useState(0.0); // 0 = apagado
  const [sitarMode, setSitarMode] = useState<SitarMode>('exotic');

  // 👇 NUEVOS ESTADOS PARA EL PEDAL RAGA
  const [ragaEnabled, setRagaEnabled] = useState(false);
  const [ragaResonance, setRagaResonance] = useState(0.5); // 0..1
  const [ragaDroneLevel, setRagaDroneLevel] = useState(0.3); // 0..1
  const [ragaColor, setRagaColor] = useState(0.5); // 0..1

  // Distorsión
  const [driveAmount, setDriveAmount] = useState(0.6);
  const [driveEnabled, setDriveEnabled] = useState(false);

  // Reverb
  const [reverbAmount, setReverbAmount] = useState(0.4);

  // 🔹 Volumen del backing track (0–1)
  const [backingVolume, setBackingVolume] = useState(0.7);

  // 🔸 Progreso del preview offline (0..1)
  const [offlinePreviewProgress, setOfflinePreviewProgress] = useState(0);

  // ✅ Helpers para presets (base / custom)
  const getCurrentSettings = useCallback((): PresetSettings => ({
    ampGain,
    ampTone,
    ampMaster,

    bassAmount,
    midAmount,
    trebleAmount,
    presenceAmount,

    driveAmount,
    driveEnabled,
    driveMode, // si existe en tu state

    delayEnabled,
    delayTimeMs,
    feedbackAmount,
    mixAmount,

    reverbAmount,

    sitarAmount,
    sitarMode,

    compressorEnabled,
    compressorThreshold,
    compressorRatio,
    compressorAttack,
    compressorRelease,
    compressorKnee,
    compressorMakeup,
    compressorMix,

    phaserEnabled,
    phaserRate,
    phaserDepth,
    phaserFeedback,
    phaserMix,
    phaserCenter,

    flangerEnabled,
    flangerRate,
    flangerDepth,
    flangerFeedback,
    flangerMix,

    octaveEnabled,
    octaveTone,
    octaveLevel,
    octaveMix,

    valveEnabled,
    valveDrive,
    valveTone,
    valveLevel,
    valveMode,

    ragaEnabled,
    ragaResonance,
    ragaDroneLevel,
    ragaColor,
    delayHPHz: 0,
    delayLPHz: 0,
    delayModRate: 0,
    delayModDepthMs: 0
  }), [
    compressorEnabled,
    compressorThreshold,
    compressorRatio,
    compressorAttack,
    compressorRelease,
    compressorKnee,
    compressorMakeup,
    compressorMix,
    ampGain,
    ampTone,
    ampMaster,
    bassAmount,
    midAmount,
    trebleAmount,
    presenceAmount,
    driveAmount,
    driveEnabled,
    delayEnabled,
    delayTimeMs,
    feedbackAmount,
    mixAmount,
    reverbAmount,
    sitarAmount,
    sitarMode,
    phaserEnabled,
    phaserRate,
    phaserDepth,
    phaserFeedback,
    phaserMix,
    phaserCenter,
    flangerEnabled,
    flangerRate,
    flangerDepth,
    flangerFeedback,
    flangerMix,
    octaveEnabled,
    octaveTone,
    octaveLevel,
    octaveMix,
    valveEnabled,
    valveDrive,
    valveTone,
    valveLevel,
    valveMode,
    ragaEnabled,
    ragaResonance,
    ragaDroneLevel,
    ragaColor,

  ]);

  const applySettings = (s: PresetSettings) => {
    setAmpGain(s.ampGain);
    setAmpTone(s.ampTone);
    setAmpMaster(s.ampMaster);

    setBassAmount(s.bassAmount);
    setMidAmount(s.midAmount);
    setTrebleAmount(s.trebleAmount);
    setPresenceAmount(s.presenceAmount);

    setDriveAmount(s.driveAmount);
    setDriveEnabled(s.driveEnabled);
    setDriveMode(s.driveMode);

    setDelayEnabled(s.delayEnabled);
    setDelayTimeMs(s.delayTimeMs);
    setFeedbackAmount(s.feedbackAmount);
    setMixAmount(s.mixAmount);

    setReverbAmount(s.reverbAmount);

    setSitarAmount(s.sitarAmount);
    setSitarMode(s.sitarMode);

    setCompressorEnabled(s.compressorEnabled);
    setCompressorThreshold(s.compressorThreshold);
    setCompressorRatio(s.compressorRatio);
    setCompressorAttack(s.compressorAttack);
    setCompressorRelease(s.compressorRelease);
    setCompressorKnee(s.compressorKnee);
    setCompressorMakeup(s.compressorMakeup);
    setCompressorMix(s.compressorMix);

    setPhaserEnabled(s.phaserEnabled);
    setPhaserRate(s.phaserRate);
    setPhaserDepth(s.phaserDepth);
    setPhaserFeedback(s.phaserFeedback);
    setPhaserMix(s.phaserMix);
    setPhaserCenter(s.phaserCenter);

    setFlangerEnabled(s.flangerEnabled);
    setFlangerRate(s.flangerRate);
    setFlangerDepth(s.flangerDepth);
    setFlangerFeedback(s.flangerFeedback);
    setFlangerMix(s.flangerMix);

    setOctaveEnabled(s.octaveEnabled);
    setOctaveTone(s.octaveTone);
    setOctaveLevel(s.octaveLevel);
    setOctaveMix(s.octaveMix);

    setValveEnabled(s.valveEnabled);
    setValveDrive(s.valveDrive);
    setValveTone(s.valveTone);
    setValveLevel(s.valveLevel);
    setValveMode(s.valveMode);

    setRagaEnabled(s.ragaEnabled);
    setRagaResonance(s.ragaResonance);
    setRagaDroneLevel(s.ragaDroneLevel);
    setRagaColor(s.ragaColor);
  };


  // Refs para la animación del cursor en el preview offline
  const offlinePreviewStartTimeRef = useRef<number | null>(null);
  const offlinePreviewAnimRef = useRef<number | null>(null);
  const droneEnvAmountRef = useRef<GainNode | null>(null);
  const droneGainRef = useRef<GainNode | null>(null);
  const [takes, setTakes] = useState<Take[]>([]);
  const activeTakeIdRef = useRef<string | null>(null);


  const driveDryRef = useRef<GainNode | null>(null);
  const driveWetRef = useRef<GainNode | null>(null);

  const antiRfPreDriveRef = useRef<BiquadFilterNode | null>(null);

// --- PUNCH (no destructivo) ---
const punchRef = useRef<{ armed: boolean; sec: number }>({ armed: false, sec: 0 });



  // punch-in session
  const punchCursorSecRef = useRef<number>(0);
  const isPunchArmedRef = useRef<boolean>(false);

  const compNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const compDryRef = useRef<GainNode | null>(null);
  const compWetRef = useRef<GainNode | null>(null);
  const compMakeupRef = useRef<GainNode | null>(null);


  const valveDryRef = useRef<GainNode | null>(null);
  const valveWetRef = useRef<GainNode | null>(null);
  // Octave pedal refs
  const octaveDryRef = useRef<GainNode | null>(null);
  const octaveWetRef = useRef<GainNode | null>(null);
  const octaveOscRef = useRef<OscillatorNode | null>(null);
  const octaveRingRef = useRef<GainNode | null>(null);
  const octaveModDepthRef = useRef<GainNode | null>(null);
  const octaveToneFilterRef = useRef<BiquadFilterNode | null>(null);

  // ✅ Phaser refs
  const phaserAllpassRefs = useRef<BiquadFilterNode[]>([]);
  const phaserDryRef = useRef<GainNode | null>(null);
  const phaserWetRef = useRef<GainNode | null>(null);
  const phaserFeedbackRef = useRef<GainNode | null>(null);
  const phaserLfoRef = useRef<OscillatorNode | null>(null);
  const phaserLfoGainRef = useRef<GainNode | null>(null);

  // Waveform / analyser (para UI)
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Flanger refs
  const flangerDelayRef = useRef<DelayNode | null>(null);
  const flangerFeedbackRef = useRef<GainNode | null>(null);
  const flangerWetRef = useRef<GainNode | null>(null);
  const flangerDryRef = useRef<GainNode | null>(null);
  const flangerLfoRef = useRef<OscillatorNode | null>(null);
  const flangerLfoGainRef = useRef<GainNode | null>(null);

  // Buffer procesado offline
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [processedWaveform, setProcessedWaveform] = useState<number[] | null>(null);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);
  const [isPunchArmed, setIsPunchArmed] = useState(false);

  // Volumen de preview offline (0–1)
  const [offlineVolume, setOfflineVolume] = useState(1.0);

  // Tiempo de grabación
  const [recordingSeconds, setRecordingSeconds] = useState(0);


  const recordingStartTimeRef = useRef<number | null>(null);
  const recordingTimerIdRef = useRef<number | null>(null);

  // Fuente para pre-escuchar el audio procesado
  const offlinePreviewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const offlinePreviewGainRef = useRef<GainNode | null>(null);

  const guitarStreamRef = useRef<MediaStream | null>(null);
  const guitarSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const backingSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recordingDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(
    null,
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const valveShaperRef = useRef<WaveShaperNode | null>(null);
  const valveToneRef = useRef<BiquadFilterNode | null>(null);
  const valveLevelRef = useRef<GainNode | null>(null);

  // Raga pedal refs
  const ragaFilterRef = useRef<BiquadFilterNode | null>(null);
  const ragaGainRef = useRef<GainNode | null>(null);

  // Sympathetic Strings (segundo resonador)
  const ragaSympatheticRef = useRef<BiquadFilterNode | null>(null);
  const ragaSympatheticGainRef = useRef<GainNode | null>(null);

  // para la animación del cursor
  const playbackStartTimeRef = useRef<number | null>(null);
  const progressAnimationRef = useRef<number | null>(null);
  const isPlayingBackingRef = useRef<boolean>(false);

  // Nodos principales del grafo
  const ampGainNodeRef = useRef<GainNode | null>(null);
  const toneFilterRef = useRef<BiquadFilterNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  // Gain final para controlar todo el output
  const finalMasterGainRef = useRef<GainNode | null>(null);

  const preDelayGainRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const feedbackGainRef = useRef<GainNode | null>(null);

  const sitarDryRef = useRef<GainNode | null>(null);
  const sitarWetRef = useRef<GainNode | null>(null);
  const driveNodeRef = useRef<WaveShaperNode | null>(null);
  const sitarBandpassRef = useRef<BiquadFilterNode | null>(null);
  const sitarSympatheticRef = useRef<BiquadFilterNode | null>(null);
  const jawariDriveRef = useRef<WaveShaperNode | null>(null);
  const jawariHighpassRef = useRef<BiquadFilterNode | null>(null);

  const reverbWetRef = useRef<GainNode | null>(null);
  const reverbDryRef = useRef<GainNode | null>(null);
  const reverbImpulseRef = useRef<AudioBuffer | null>(null);

  const postFxGainRef = useRef<GainNode | null>(null);

  // Tonestack refs
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null);
  const presenceFilterRef = useRef<BiquadFilterNode | null>(null);

  // Monitor + grabación
  const monitorGainRef = useRef<GainNode | null>(null);
  const recordGainRef = useRef<GainNode | null>(null);

  // 🔹 Gain node del backing para poder ajustarlo en vivo
  const backingGainRef = useRef<GainNode | null>(null);

  const getOrCreateAudioContext = useCallback(() => {
    if (audioContext) return audioContext;

    const ctx = new AudioContext({
      latencyHint: 'interactive', // <- clave para evitar saltos
      // sampleRate: 48000, // opcional (si querés fijarlo)
    });

    setAudioContext(ctx);
    return ctx;
  }, [audioContext]);

  // 🔹 METRÓNOMO
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [metronomeVolume, setMetronomeVolume] = useState(0.15); // volumen inicial
  const metronomeIntervalRef = useRef<number | null>(null);

  const startMetronome = useCallback(() => {
    if (!audioContext) return;
    setMetronomeOn(true);
  }, [audioContext]);

  const stopMetronome = useCallback(() => {
    setMetronomeOn(false);
  }, []);

  useEffect(() => { activeTakeIdRef.current = activeTakeId; }, [activeTakeId]);
  const takesRef = useRef<Take[]>([]);
  useEffect(() => { takesRef.current = takes; }, [takes]);

  // crear / actualizar intervalo del metrónomo
  useEffect(() => {
    if (!audioContext) return;

    if (!metronomeOn) {
      if (metronomeIntervalRef.current != null) {
        clearInterval(metronomeIntervalRef.current);
        metronomeIntervalRef.current = null;
      }
      return;
    }


    const effectiveBpm = bpm <= 0 ? 1 : bpm;
    const intervalMs = (60 / effectiveBpm) * 1000;

    const tick = () => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      gain.gain.value = metronomeVolume; // volumen configurable
      osc.type = 'square';
      osc.frequency.value = 1000;
      osc.connect(gain).connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + 0.05);
    };

    // primer click inmediato
    tick();

    metronomeIntervalRef.current = window.setInterval(tick, intervalMs);

    return () => {
      if (metronomeIntervalRef.current != null) {
        clearInterval(metronomeIntervalRef.current);
        metronomeIntervalRef.current = null;
      }
    };
  }, [audioContext, bpm, metronomeOn, metronomeVolume]);

  useEffect(() => {
    isPunchArmedRef.current = isPunchArmed;
  }, [isPunchArmed]);
  // ---------- PLAY / EXPORT DEL PROCESADO OFFLINE ----------

  const playProcessed = useCallback(() => {
    if (!processedBuffer) {
      setStatus('No hay audio procesado todavía.');
      return;
    }

    const ctx = getOrCreateAudioContext();

    // parar preview anterior si hubiera
    if (offlinePreviewSourceRef.current) {
      try {
        offlinePreviewSourceRef.current.stop();
      } catch {
        // ignore
      }
      offlinePreviewSourceRef.current.disconnect();
      offlinePreviewSourceRef.current = null;
    }

    // asegurar gain del preview
    if (!offlinePreviewGainRef.current) {
      const g = ctx.createGain();
      g.gain.value = offlineVolume; // usamos el volumen del estado
      g.connect(ctx.destination);
      offlinePreviewGainRef.current = g;
    }

    const src = ctx.createBufferSource();
    src.buffer = processedBuffer;
    src.connect(offlinePreviewGainRef.current!);
    src.start();

    offlinePreviewSourceRef.current = src;

    // animación del cursor sobre la waveform
    const startTime = ctx.currentTime;
    const duration = processedBuffer.duration;

    const step = () => {
      if (!offlinePreviewSourceRef.current || offlinePreviewSourceRef.current !== src) {
        return;
      }
      const elapsed = ctx.currentTime - startTime;
      const progress = Math.min(1, Math.max(0, elapsed / duration));
      setOfflinePreviewProgress(progress);
      if (elapsed < duration) {
        requestAnimationFrame(step);
      } else {
        setOfflinePreviewProgress(0);
      }
    };

    requestAnimationFrame(step);

    src.onended = () => {
      if (offlinePreviewSourceRef.current === src) {
        offlinePreviewSourceRef.current = null;
        setOfflinePreviewProgress(0);
      }
    };

    setStatus('Reproduciendo audio procesado...');
  }, [processedBuffer, getOrCreateAudioContext, offlineVolume]);

  const stopProcessed = useCallback(() => {
    if (offlinePreviewSourceRef.current) {
      try {
        offlinePreviewSourceRef.current.stop();
      } catch {
        // ignore
      }
      offlinePreviewSourceRef.current.disconnect();
      offlinePreviewSourceRef.current = null;
    }

    if (offlinePreviewAnimRef.current != null) {
      cancelAnimationFrame(offlinePreviewAnimRef.current);
      offlinePreviewAnimRef.current = null;
    }

    offlinePreviewStartTimeRef.current = null;
    setOfflinePreviewProgress(0);
    setStatus('Reproducción detenida.');
  }, []);

  const exportProcessed = useCallback(() => {
    if (!processedBuffer) {
      setStatus('No hay audio procesado para exportar.');
      return;
    }

    const wavArrayBuffer = audioBufferToWav(processedBuffer);
    const blob = new Blob([wavArrayBuffer], { type: 'audio/wav' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'neon-sitar-processed.wav';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);

    setStatus('Archivo procesado exportado como WAV 🎧');
  }, [processedBuffer]);

  // simple IR para reverb (ruido con decay)
  const getReverbImpulse = useCallback(
    (ctx: AudioContext): AudioBuffer => {
      if (reverbImpulseRef.current) return reverbImpulseRef.current;

      const duration = 1.8;
      const rate = ctx.sampleRate;
      const length = Math.floor(duration * rate);
      const impulse = ctx.createBuffer(2, length, rate);

      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          const t = i / length;
          // ruido blanco con decay exponencial
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5);
        }
      }

      reverbImpulseRef.current = impulse;
      return impulse;
    },
    [],
  );

  // Construye (una sola vez) el grafo de efectos de la guitarra.
  // Este mismo grafo se usa tanto para el monitor como para la grabación.
  const ensureGuitarGraph = useCallback(() => {
    if (!audioContext) return;
    if (!guitarSourceRef.current) return;

    // Si ya lo armamos, no volvemos a conectar nada
    if (postFxGainRef.current) return;

    const ctx = audioContext;
    const guitarSource = guitarSourceRef.current;

    // Forzar la guitarra a mono (un solo canal) para que salga centrada
    const monoGain = ctx.createGain();
    monoGain.channelCount = 1;
    monoGain.channelCountMode = 'explicit';
    guitarSource.connect(monoGain);

    // === TONESTACK (Bass / Mid / Treble) ===
    const bassFilter = ctx.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 120;
    bassFilter.gain.value = (bassAmount - 0.5) * 12;
    bassFilterRef.current = bassFilter;

    const midFilter = ctx.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 900;
    midFilter.Q.value = 1.0;
    midFilter.gain.value = (midAmount - 0.5) * 10;
    midFilterRef.current = midFilter;

    const trebleFilter = ctx.createBiquadFilter();
    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 3500;
    trebleFilter.gain.value = (trebleAmount - 0.5) * 12;
    trebleFilterRef.current = trebleFilter;

    // === AMP INPUT & DRIVE ===
    const ampGainNode = ctx.createGain();
    ampGainNode.gain.value = ampGain;
    ampGainNodeRef.current = ampGainNode;

    // ✅ Band-limit “de guitarra” ANTES del drive (mata RF antes de la no-linealidad)
    const preDriveHP = ctx.createBiquadFilter();
    preDriveHP.type = 'highpass';
    preDriveHP.frequency.value = 85;  // 70..120 Hz
    preDriveHP.Q.value = 0.707;

    const preDriveLP = ctx.createBiquadFilter();
    preDriveLP.type = 'lowpass';
    preDriveLP.frequency.value = 4500; // 4500..6500 (clave contra “radio”)
    preDriveLP.Q.value = 0.707;


    const driveNode = ctx.createWaveShaper();
    driveNode.curve = makeDriveCurve(driveMode, driveEnabled ? driveAmount : 0);
    driveNode.oversample = '4x';
    driveNodeRef.current = driveNode;
    // ✅ anti-radio antes del drive (mata HF antes de distorsionar)
    const antiRfPreDrive = ctx.createBiquadFilter();
    antiRfPreDrive.type = 'lowpass';
    antiRfPreDrive.frequency.value = 9500; // probá 8000..12000
    antiRfPreDrive.Q.value = 0.7;
    antiRfPreDriveRef.current = antiRfPreDrive;


    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = 'lowpass';

    const minFreq = 200;
    const maxFreq = 16000;
    toneFilter.frequency.value = minFreq + ampTone * (maxFreq - minFreq);
    toneFilterRef.current = toneFilter;

    // ✅ TRUE BYPASS del drive (para que el shaper no procese nada cuando está OFF)
    const driveDry = ctx.createGain();
    const driveWet = ctx.createGain();
    driveDry.gain.value = 1.0;
    driveWet.gain.value = 0.0;

    const driveOut = ctx.createGain();

    driveDryRef.current = driveDry;
    driveWetRef.current = driveWet;



    // === COMPRESSOR (true bypass + parallel mix) ===
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = compressorThreshold;
    comp.ratio.value = compressorRatio;
    comp.attack.value = compressorAttack;
    comp.release.value = compressorRelease;
    comp.knee.value = compressorKnee;
    compNodeRef.current = comp;

    const compMakeup = ctx.createGain();
    compMakeup.gain.value = compressorMakeup;
    compMakeupRef.current = compMakeup;

    // router dry/wet
    const compDry = ctx.createGain();
    const compWet = ctx.createGain();
    compDryRef.current = compDry;
    compWetRef.current = compWet;

    // por defecto OFF
    compDry.gain.value = 1.0;
    compWet.gain.value = 0.0;

    // split desde toneFilter
    toneFilter.connect(compDry);
    toneFilter.connect(comp);

    // comp path
    comp.connect(compMakeup);
    compMakeup.connect(compWet);

    // sum
    const compOut = ctx.createGain();
    compDry.connect(compOut);
    compWet.connect(compOut);
    let preSitarNode: AudioNode = compOut;
    preSitarNode = compOut;




    // === MASTER GAIN NODE ===
    const masterGain = ctx.createGain();
    masterGain.gain.value = ampMaster * 2.0;
    masterGainRef.current = masterGain;

    // Declare preSitarNode here before first use


    // === SYMPATHETIC STRINGS — brillo super agudo estilo sitar ===

    // Filtro band-pass super agudo
    const ragaSym = ctx.createBiquadFilter();
    ragaSym.type = "bandpass";
    ragaSym.frequency.value = 7000;   // MUY agudo
    ragaSym.Q.value = 22;             // muy resonante / metálico

    // Tiny vibrato → vibración típica del sitar real
    const ragaLFO = ctx.createOscillator();
    ragaLFO.type = "sine";
    ragaLFO.frequency.value = 4.2; // vibración lenta estilo sitar

    const ragaLFOgain = ctx.createGain();
    ragaLFOgain.gain.value = 180; // mueve la frecuencia del resonador
    ragaLFO.connect(ragaLFOgain);
    ragaLFOgain.connect(ragaSym.frequency);
    ragaLFO.start();

    // ganancia de mezcla (controlada por el pedal Raga)
    const ragaSymGain = ctx.createGain();
    ragaSymGain.gain.value = 0; // se activa solo con el pedal

    // Conexión en paralelo
    // toneFilter.connect(ragaSym);
    // ragaSym.connect(ragaSymGain);
    // ragaSymGain.connect(masterGain);

    // Referencias opcionales
    ragaSympatheticRef.current = ragaSym;
    ragaSympatheticGainRef.current = ragaSymGain;





    // === SITAR SECTION ===
    const sitarDryGain = ctx.createGain();
    sitarDryGain.gain.value = 1 - sitarAmount;
    sitarDryRef.current = sitarDryGain;

    const sitarWetGain = ctx.createGain();
    sitarWetGain.gain.value = sitarAmount;
    sitarWetRef.current = sitarWetGain;

    const sitarBandpass = ctx.createBiquadFilter();
    sitarBandpass.type = 'bandpass';
    const sitarSympathetic = ctx.createBiquadFilter();
    sitarSympathetic.type = 'bandpass';
    sitarBandpassRef.current = sitarBandpass;
    sitarSympatheticRef.current = sitarSympathetic;

    const jawariDrive = ctx.createWaveShaper();
    jawariDrive.curve = makeDriveCurve('distortion', 0.55);
    jawariDrive.oversample = '4x';
    jawariDriveRef.current = jawariDrive;

    const jawariDelay = ctx.createDelay(0.02);
    jawariDelay.delayTime.value = 0.0015;

    const jawariFeedback = ctx.createGain();
    jawariFeedback.gain.value = 0.65;

    const jawariHighpass = ctx.createBiquadFilter();
    jawariHighpass.type = 'highpass';
    jawariHighpass.frequency.value = 1800;
    jawariHighpassRef.current = jawariHighpass;

    // Aplicamos el modo actual
    applySitarMode(sitarMode, {
      sitarBandpass,
      sitarSympathetic,
      jawariDrive,
      jawariHighpass,
    });

    // === DELAY & MIX ===
    const preDelayGain = ctx.createGain();
    preDelayGainRef.current = preDelayGain;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1 - mixAmount;
    dryGainRef.current = dryGain;

    const wetGain = ctx.createGain();
    wetGain.gain.value = delayEnabled ? mixAmount : 0;
    wetGainRef.current = wetGain;

    const delayNode = ctx.createDelay(2.0);
    // 🔽 Delay tone shaping (muy importante)
    const delayHP = ctx.createBiquadFilter();
    delayHP.type = 'highpass';
    delayHP.frequency.value = 120; // 80–200 típico
    delayHP.Q.value = 0.707;

    const delayLP = ctx.createBiquadFilter();
    delayLP.type = 'lowpass';
    delayLP.frequency.value = 6000; // 3k–6k clave
    delayLP.Q.value = 0.707;

    delayNode.delayTime.value = delayTimeMs / 1000;
    delayNodeRef.current = delayNode;

    const feedbackGain = ctx.createGain();
    feedbackGain.gain.value = feedbackAmount;
    feedbackGainRef.current = feedbackGain;

    // === REVERB ===

    // Presence (post-master)
    const presenceFilter = ctx.createBiquadFilter();
    presenceFilter.type = 'highshelf';
    presenceFilter.frequency.value = 5500;
    presenceFilter.gain.value = (presenceAmount - 0.5) * 14;
    presenceFilterRef.current = presenceFilter;

    const reverbDry = ctx.createGain();
    const reverbWet = ctx.createGain();
    reverbDry.gain.value = 1 - reverbAmount;
    reverbWet.gain.value = reverbAmount;
    reverbDryRef.current = reverbDry;
    reverbWetRef.current = reverbWet;

    const reverb = ctx.createConvolver();
    reverb.buffer = getReverbImpulse(ctx);

    const postFxGain = ctx.createGain();
    postFxGainRef.current = postFxGain;
    // ✅ Analyser para UI (onda en vivo)
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;
    analyserRef.current = analyser;

    // postFxGain -> analyser (solo para medir, no cambia audio)
    postFxGain.connect(analyser);


    // === CONNECTIONS PRINCIPALES ===
    // Input -> tonestack -> amp -> drive -> tone
    monoGain.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(ampGainNode);

    // ✅ NUEVO orden: band-limit antes del drive
    ampGainNode.connect(preDriveHP);
    preDriveHP.connect(preDriveLP);
    // split: dry directo + wet al shaper
    preDriveLP.connect(driveDry);
    // ✅ PAD antes del shaper (baja demodulación / “radio” cuando hay drive)
    const drivePad = ctx.createGain();
    drivePad.gain.value = 0.6; // probá 0.4..0.8

    preDriveLP.connect(drivePad);
    drivePad.connect(antiRfPreDrive);

    antiRfPreDrive.connect(driveNode);
    driveNode.connect(driveWet);

    // sum
    driveDry.connect(driveOut);
    driveWet.connect(driveOut);

    // ✅ filtro post-drive (mata fizz + restos de “radio”)
    const postDriveLP = ctx.createBiquadFilter();
    postDriveLP.type = 'lowpass';
    postDriveLP.frequency.value = 5500; // probá 4500..8000
    postDriveLP.Q.value = 0.707;

    // a tone (ahora pasa por postDriveLP)
    driveOut.connect(postDriveLP);
    postDriveLP.connect(toneFilter);



    // ======================================================
    // 🎵 OCTAVE PEDAL (OFFLINE)
    // ======================================================


    // ======================================================
    // ======================================================
    // 🌺 TONAL DRONE ENGINE (sin shhhh)
    // ======================================================

    // Gain general del drone (lo abre/cierra el useEffect con ragaDroneLevel)
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.0;
    droneGainRef.current = droneGain;

    // Tónico base (después lo ajustamos por useEffect con ragaColor)
    const tonicOsc = ctx.createOscillator();
    tonicOsc.type = 'sine';
    tonicOsc.frequency.value = 110; // default, luego se actualiza

    const fifthOsc = ctx.createOscillator();
    fifthOsc.type = 'sine';
    fifthOsc.frequency.value = 165; // 110*1.5

    const octaveOsc = ctx.createOscillator();
    octaveOsc.type = 'sine';
    octaveOsc.frequency.value = 220; // 110*2

    // Mezcla muy suave
    const droneMix = ctx.createGain();
    droneMix.gain.value = 0.12;

    tonicOsc.connect(droneMix);
    fifthOsc.connect(droneMix);
    octaveOsc.connect(droneMix);

    // Filtrado para que suene "tipo sitar" (sin subgrave)
    const droneHP = ctx.createBiquadFilter();
    droneHP.type = 'highpass';
    droneHP.frequency.value = 90;

    const droneLP = ctx.createBiquadFilter();
    droneLP.type = 'lowpass';
    droneLP.frequency.value = 1800;

    droneMix.connect(droneHP);
    droneHP.connect(droneLP);
    droneLP.connect(droneGain);
    droneGain.connect(masterGain);

    tonicOsc.start();
    fifthOsc.start();
    octaveOsc.start();

    // guardamos refs para update
    octaveOscRef.current = octaveOsc; // si querés reutilizar ref, o creá una ref nueva
    // === VALVE CRUNCH (true bypass con dry/wet) ===

    // 1) Wet chain (efecto)
    const valveShaper = ctx.createWaveShaper();
    valveShaper.oversample = '4x';
    valveShaperRef.current = valveShaper;

    const valveToneFilter = ctx.createBiquadFilter();
    valveToneFilter.type = 'lowpass';
    valveToneRef.current = valveToneFilter;

    const valveLevelGain = ctx.createGain();
    valveLevelRef.current = valveLevelGain;

    // ✅ anti-radio antes de la saturación
    const antiRfLP = ctx.createBiquadFilter();
    antiRfLP.type = 'lowpass';
    antiRfLP.frequency.value = 9500; // probá 8000..12000
    antiRfLP.Q.value = 0.7;

    // Conexión interna del efecto (WET)
    antiRfLP.connect(valveShaper);
    valveShaper.connect(valveToneFilter);
    valveToneFilter.connect(valveLevelGain);

    // 2) Router dry / wet
    const valveDry = ctx.createGain();
    valveDry.gain.value = 1.0;

    const valveWet = ctx.createGain();
    valveWet.gain.value = 0.0;

    valveDryRef.current = valveDry;
    valveWetRef.current = valveWet;

    // 3) Split desde preSitarNode
    preSitarNode.connect(valveDry);
    preSitarNode.connect(antiRfLP); // ✅ la entrada al efecto pasa SI o SI por el filtro

    // salida del efecto al wet
    valveLevelGain.connect(valveWet);

    // 4) SUMA
    const valveOut = ctx.createGain();
    valveDry.connect(valveOut);
    valveWet.connect(valveOut);

    // 5) Seguir desde valveOut
    preSitarNode = valveOut;



    // ======================================================
    // 🎵 OCTAVE PEDAL (MAIN graph) — ring-mod simple
    // ======================================================

    // Split dry/wet
    const octaveDryNode = ctx.createGain();
    octaveDryNode.gain.value = 1.0;
    octaveDryRef.current = octaveDryNode;

    // “Ring” (audio * osc)
    const octaveRingNode = ctx.createGain();
    octaveRingNode.gain.value = 1.0;
    octaveRingRef.current = octaveRingNode;

    // Wet gain (level real del octave)
    const octaveWetNode = ctx.createGain();
    octaveWetNode.gain.value = 0.0; // lo prende useEffect
    octaveWetRef.current = octaveWetNode;

    // Tone filter del wet (lowpass)
    const octaveToneFilterNode = ctx.createBiquadFilter();
    octaveToneFilterNode.type = 'lowpass';
    octaveToneFilterNode.frequency.value = 800 + octaveTone * (16000 - 800);
    octaveToneFilterRef.current = octaveToneFilterNode;

    // Oscillator (modulador)
    const octaveOscNode = ctx.createOscillator();
    octaveOscNode.type = 'sine';
    octaveOscNode.frequency.value = 440;
    octaveOscRef.current = octaveOscNode;

    // ✅ Mod depth real (on/off verdadero)
    const octaveModDepthNode = ctx.createGain();
    octaveModDepthNode.gain.value = 0.0; // arranca OFF
    octaveModDepthRef.current = octaveModDepthNode;

    octaveOscNode.connect(octaveModDepthNode);
    octaveModDepthNode.connect(octaveRingNode.gain);
    octaveOscNode.start();

    // Routing: preSitarNode -> dry + ring
    preSitarNode.connect(octaveDryNode);
    preSitarNode.connect(octaveRingNode);

    // Wet chain: ring -> toneFilter -> wetGain
    octaveRingNode.connect(octaveToneFilterNode);
    octaveToneFilterNode.connect(octaveWetNode);

    // Mix out
    const octaveOutNode = ctx.createGain();
    octaveDryNode.connect(octaveOutNode);
    octaveWetNode.connect(octaveOutNode);

    // Desde ahora, el flujo sigue desde octaveOutNode
    preSitarNode = octaveOutNode;


    // ======================================================
    // 🎛️ PHASER (MAIN graph)
    // ======================================================
    const phaserIn = ctx.createGain();
    phaserIn.gain.value = 1.0;

    // dry/wet
    const phaserDry = ctx.createGain();
    phaserDry.gain.value = 1.0;
    phaserDryRef.current = phaserDry;

    const phaserWet = ctx.createGain();
    phaserWet.gain.value = 0.0;
    phaserWetRef.current = phaserWet;

    // feedback
    const phaserFb = ctx.createGain();
    phaserFb.gain.value = 0.0;
    phaserFeedbackRef.current = phaserFb;

    // 4 a 6 stages suena bien. Arrancá con 6.
    const stages = 6;
    const allpasses: BiquadFilterNode[] = [];

    for (let i = 0; i < stages; i++) {
      const ap = ctx.createBiquadFilter();
      ap.type = 'allpass';
      ap.frequency.value = 900; // base (después lo modula el LFO)
      ap.Q.value = 0.7;         // suave
      allpasses.push(ap);
    }
    phaserAllpassRefs.current = allpasses;

    // chain allpass
    phaserIn.connect(allpasses[0]);
    for (let i = 0; i < stages - 1; i++) {
      allpasses[i].connect(allpasses[i + 1]);
    }

    // feedback loop: output -> fb -> input
    allpasses[stages - 1].connect(phaserFb);
    phaserFb.connect(phaserIn);

    // wet out desde el último allpass
    allpasses[stages - 1].connect(phaserWet);

    // dry path
    phaserIn.connect(phaserDry);

    // mix
    const phaserOut = ctx.createGain();
    phaserDry.connect(phaserOut);
    phaserWet.connect(phaserOut);

    // LFO para modular frecuencia de TODOS los allpass
    const phaserLFO = ctx.createOscillator();
    phaserLFO.type = 'sine';
    phaserLFO.frequency.value = 0.3;
    phaserLfoRef.current = phaserLFO;

    const phaserLFOGain = ctx.createGain();
    // en Hz (se ajusta por useEffect)
    phaserLFOGain.gain.value = 0;
    phaserLfoGainRef.current = phaserLFOGain;

    phaserLFO.connect(phaserLFOGain);

    // con esto un LFO modula muchas frecuencias
    allpasses.forEach((ap) => phaserLFOGain.connect(ap.frequency));

    phaserLFO.start();

    // Routing: preSitarNode -> phaserIn, y el "nuevo preSitarNode" es phaserOut
    preSitarNode.connect(phaserIn);
    preSitarNode = phaserOut;



    // === FLANGER (Raga Sweep) ===
    // Lo armamos acá para que afecte tanto señal dry como sitar antes del delay principal
    const flangerIn = ctx.createGain();
    flangerIn.gain.value = 1.0;

    const flangerDelay = ctx.createDelay(0.02); // 20ms max
    flangerDelay.delayTime.value = 0.003; // base 3ms
    flangerDelayRef.current = flangerDelay;

    const flangerFeedbackGain = ctx.createGain();
    flangerFeedbackGain.gain.value = 0.0;
    flangerFeedbackRef.current = flangerFeedbackGain;

    const flangerDry = ctx.createGain();
    flangerDry.gain.value = 1.0;
    flangerDryRef.current = flangerDry;

    const flangerWet = ctx.createGain();
    flangerWet.gain.value = 0.0;
    flangerWetRef.current = flangerWet;

    // feedback loop
    flangerDelay.connect(flangerFeedbackGain);
    flangerFeedbackGain.connect(flangerDelay);
    // LFO modula delayTime
    const flangerLFO = ctx.createOscillator();
    flangerLFO.type = 'sine';
    flangerLFO.frequency.value = 0.3; // se actualiza por useEffect
    flangerLfoRef.current = flangerLFO;

    const flangerLFOGain = ctx.createGain();
    flangerLFOGain.gain.value = 0.0; // profundidad (segundos) por useEffect
    flangerLfoGainRef.current = flangerLFOGain;

    flangerLFO.connect(flangerLFOGain);
    flangerLFOGain.connect(flangerDelay.delayTime);
    flangerLFO.start();


    // routing flanger: in -> dry + delay -> wet -> out
    const flangerOut = ctx.createGain();
    flangerOut.gain.value = 1.0;
    flangerIn.connect(flangerDry);
    flangerIn.connect(flangerDelay);
    flangerDelay.connect(flangerWet);

    flangerDry.connect(flangerOut);
    flangerWet.connect(flangerOut);

    // Conectar preSitar al flangerIn
    preSitarNode.connect(flangerIn);

    // Desde ahora, todo lo que antes iba a preDelayGain, sale de flangerOut
    const preDelayInput = flangerOut;

    // === PEDAL RAGA (resonador REAL en paralelo) ===
    const ragaRes1 = ctx.createBiquadFilter();
    ragaRes1.type = 'peaking';
    ragaRes1.frequency.value = 2200;
    ragaRes1.Q.value = 10;
    ragaRes1.gain.value = 0; // lo mueve el useEffect

    const ragaRes2 = ctx.createBiquadFilter();
    ragaRes2.type = 'peaking';
    ragaRes2.frequency.value = 6200;
    ragaRes2.Q.value = 16;
    ragaRes2.gain.value = 0;

    // leve drive en el resonador (para que “muerda”)
    const ragaDrive = ctx.createWaveShaper();
    ragaDrive.oversample = '4x';
    ragaDrive.curve = makeDriveCurve('crunch', 0.25);

    // ON/OFF real por useEffect
    const ragaMix = ctx.createGain();
    ragaMix.gain.value = 0;

    // ✅ Band-limit ANTES del Raga (mata RF antes de resonancias + drive)
    const preRagaHP = ctx.createBiquadFilter();
    preRagaHP.type = 'highpass';
    preRagaHP.frequency.value = 120; // 80..160
    preRagaHP.Q.value = 0.707;

    const preRagaLP = ctx.createBiquadFilter();
    preRagaLP.type = 'lowpass';
    preRagaLP.frequency.value = 3600; // 3800..6000 (si hay radio, bajá más)
    preRagaLP.Q.value = 0.707;

    // ✅ anti-radio antes del drive del Raga (la no-linealidad demodula RF)
    const preRagaDriveLP = ctx.createBiquadFilter();
    preRagaDriveLP.type = 'lowpass';
    preRagaDriveLP.frequency.value = 5200; // 4500..6500
    preRagaDriveLP.Q.value = 0.707;

    // ✅ filtro final antes de volver al bus (limpia fizz y restos)
    const ragaAntiRF = ctx.createBiquadFilter();
    ragaAntiRF.type = 'lowpass';
    ragaAntiRF.frequency.value = 6000;
    ragaAntiRF.Q.value = 0.7;

    // input del Raga: desde el bus preDelayInput (post flanger/phaser/octave/valve)
    preDelayInput.connect(preRagaHP);
    preRagaHP.connect(preRagaLP);
    preRagaLP.connect(ragaRes1);

    ragaRes1.connect(ragaRes2);
    ragaRes2.connect(preRagaDriveLP);
    preRagaDriveLP.connect(ragaDrive);

    ragaDrive.connect(ragaMix);
    ragaMix.connect(ragaAntiRF);

    // ✅ IMPORTANTE: sumarlo SIEMPRE al MISMO BUS que el resto (preDelayGain)
    // así el delay y la reverb también lo afectan
    ragaAntiRF.connect(preDelayGain);

    // refs
    ragaFilterRef.current = ragaRes1;
    ragaGainRef.current = ragaMix;

    // si querés controlar el 2do resonador también:
    ragaSympatheticRef.current = ragaRes2;


    // Alimentar el camino WET (jawari + resonancias)
    preDelayInput.connect(sitarBandpass);
    sitarBandpass.connect(jawariDrive);
    jawariDrive.connect(jawariDelay);
    jawariDelay.connect(jawariFeedback);
    jawariFeedback.connect(jawariDelay);
    jawariDelay.connect(jawariHighpass);
    jawariHighpass.connect(sitarWetGain);

    // Sympathetic en paralelo (entra también al wet)
    preDelayInput.connect(sitarSympathetic);
    sitarSympathetic.connect(sitarWetGain);

    // Sitar paths
    preDelayInput.connect(sitarDryGain);
    // Mix dry + sitar into preDelay (ahora entra por preDelayGain)
    sitarDryGain.connect(preDelayGain);
    sitarWetGain.connect(preDelayGain);

    // Delay network
    preDelayGain.connect(dryGain);
    preDelayGain.connect(delayNode);

    // delay → filtros → wet
    delayNode.connect(delayHP);
    delayHP.connect(delayLP);
    delayLP.connect(wetGain);

    // feedback desde señal ya filtrada (oscurece cada repeat)
    delayLP.connect(feedbackGain);
    feedbackGain.connect(delayNode);

    feedbackGain.connect(delayNode);

    // 🎛️ Delay modulation (tape / analog vibe)
    const delayLFO = ctx.createOscillator();
    delayLFO.type = 'sine';
    delayLFO.frequency.value = 0.35; // 0.2–0.6 Hz

    const delayLFODepth = ctx.createGain();
    delayLFODepth.gain.value = 0.003; // ≈ 3ms (MUY IMPORTANTE no pasarse)

    // LFO → depth → delayTime
    delayLFO.connect(delayLFODepth);
    delayLFODepth.connect(delayNode.delayTime);

    delayLFO.start();


    // To master
    dryGain.connect(masterGain);
    wetGain.connect(masterGain);

    // Presence post-master
    masterGain.connect(presenceFilter);

    // Reverb
    presenceFilter.connect(reverbDry);
    presenceFilter.connect(reverb);
    reverb.connect(reverbWet);

    reverbDry.connect(postFxGain);
    reverbWet.connect(postFxGain);

    // Monitor bus → parlantes (control por ganancia)
    const monitorGain = ctx.createGain();
    monitorGain.gain.value = monitorEnabled ? 1 : 0;
    monitorGainRef.current = monitorGain;

    // === MASTER GLOBAL ===
    const finalMasterGain = ctx.createGain();
    finalMasterGain.gain.value = masterVolume;
    finalMasterGainRef.current = finalMasterGain;

    // Monitor -> Master -> Destination
    postFxGain.connect(monitorGain);
    monitorGain.connect(finalMasterGain);
    finalMasterGain.connect(ctx.destination);

    // Bus de grabación (post-FX)
    const recordGain = ctx.createGain();
    recordGain.gain.value = 1.0;
    recordGainRef.current = recordGain;
    postFxGain.connect(recordGain);

    if (recordingDestinationRef.current) {
      recordGain.connect(recordingDestinationRef.current);
    }
  }, [
    audioContext,
    ampGain,
    ampMaster,
    ampTone,
    delayEnabled,
    delayTimeMs,
    driveAmount,
    driveEnabled,
    feedbackAmount,
    mixAmount,
    reverbAmount,
    sitarAmount,
    sitarMode,
    getReverbImpulse,
    monitorEnabled,
    bassAmount,
    midAmount,
    trebleAmount,
    presenceAmount,
    masterVolume,
  ]);
  // Entrada de guitarra
  const setupGuitarInput = useCallback(async () => {
    try {
      const ctx = getOrCreateAudioContext();

      if (!guitarStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        guitarStreamRef.current = stream;
      }

      if (!guitarSourceRef.current && guitarStreamRef.current) {
        const src = ctx.createMediaStreamSource(guitarStreamRef.current);
        guitarSourceRef.current = src;
      }

      // Armamos el grafo de FX apenas tenemos la entrada
      ensureGuitarGraph();

      setIsInputReady(true);
      setStatus('Entrada de guitarra lista ✅');
    } catch (err) {
      console.error(err);
      setStatus('Error al acceder al micrófono/placa');
    }
  }, [getOrCreateAudioContext, ensureGuitarGraph]);
  const getAnalyserNode = useCallback(() => analyserRef.current, []);
  // Cargar backing
  const loadBackingFile = useCallback(
    async (file: File) => {
      try {
        const ctx = getOrCreateAudioContext();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuffer);

        setBackingBuffer(audioBuf);
        setBackingName(file.name);
        setBackingWaveform(computeWaveform(audioBuf));
        setPlaybackProgress(0);

        setStatus(`Backing cargado: ${file.name}`);
      } catch (err) {
        console.error(err);
        setStatus('Error al cargar backing');
      }
    },
    [getOrCreateAudioContext],
  );

  // Procesar un archivo a través del Sitar Amp usando OfflineAudioContext
  const processFileThroughSitar = useCallback(async (file: File) => {
    console.log('[offline] processing:', file.name);

    const arr = await file.arrayBuffer();

    // decode con un AudioContext temporal
    const temp = new AudioContext();
    const decoded = await temp.decodeAudioData(arr.slice(0));
    await temp.close();

    // Offline con el sampleRate del archivo
    const offline = new OfflineAudioContext(
      decoded.numberOfChannels,
      decoded.length,
      decoded.sampleRate
    );

    const src = new AudioBufferSourceNode(offline, { buffer: decoded });

    // settings actuales (usá TU fuente real)
    const settings = getCurrentSettings(); // vos lo tenés en tu archivo (se ve en tu screenshot)

    const graph = buildOfflineFullGraph(offline, settings);



    src.connect(graph.input);
    graph.output.connect(offline.destination);

    src.start(0);

    const rendered = await offline.startRendering();

    console.log('[offline] rendered RMS:', rms(rendered));

    setProcessedBuffer(rendered);
    console.log('[offline] rendered duration:', rendered.duration);
    console.log('[offline] rendered max:', Math.max(...rendered.getChannelData(0).slice(0, 50000).map(Math.abs)));


    const wf = computeWaveform(rendered);
    setProcessedWaveform(wf);
  }, [getCurrentSettings]);


  const setupRecordingGraph = useCallback(() => {
    if (!audioContext) return;

    if (!recordingDestinationRef.current) {
      recordingDestinationRef.current = audioContext.createMediaStreamDestination();
    }

    const destNode = recordingDestinationRef.current;

    if (!mediaRecorderRef.current && destNode) {
      const mr = new MediaRecorder(destNode.stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mr.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/wav' });
        recordedChunksRef.current = [];

        const ctx = getOrCreateAudioContext();
        const punchBufFull = await blobToAudioBuffer(ctx, blob);
        const punchUrl = URL.createObjectURL(blob);

        const doPunch = isPunchArmedRef.current && !!activeTakeIdRef.current;

        // --- TAKE NORMAL ---
        if (!doPunch) {
          const take: Take = {
            id: crypto.randomUUID(),
            name: `Take ${takesRef.current.length + 1}`,
            blob,
            url: punchUrl,
            durationSec: punchBufFull.duration,
          };

          setTakes((prev) => [...prev, take]);
          setActiveTakeId(take.id);
          setStatus('Take guardado ✅');
          return;
        }

        // --- PUNCH REPLACE ---
        setStatus('Aplicando punch-in…');

        const cursorSec = Math.max(0, punchCursorSecRef.current);

        const baseId = activeTakeIdRef.current!;
        const baseTake = takesRef.current.find((t) => t.id === baseId);

        if (!baseTake) {
          // fallback si no hay base
          const fallback: Take = {
            id: crypto.randomUUID(),
            name: `Take ${takesRef.current.length + 1}`,
            blob,
            url: punchUrl,
            durationSec: punchBufFull.duration,
          };

          setTakes((prev) => [...prev, fallback]);
          setActiveTakeId(fallback.id);
          setStatus('Take guardado ✅ (no se encontró base para punch)');
          setIsPunchArmed(false);
          return;
        }

        // decodificar base take
        const baseBuf = await blobToAudioBuffer(ctx, baseTake.blob);
        const safeCursor = Math.min(cursorSec, baseBuf.duration);

        // ojo: cortamos el punch desde el mismo cursor, así el insert arranca alineado
        const insertBuf = sliceAudioBuffer(ctx, punchBufFull, safeCursor);

        const merged = spliceReplaceWithCrossfade(ctx, baseBuf, insertBuf, safeCursor, 12);

        const mergedBlob = audioBufferToWavBlob(merged);
        const mergedUrl = URL.createObjectURL(mergedBlob);

        // update state (SYNC) sin async
        setTakes((prev) =>
          prev.map((t) =>
            t.id === baseTake.id
              ? {
                ...t,
                blob: mergedBlob,
                url: mergedUrl,
                durationSec: merged.duration,
                name: `${t.name} (Punch)`,
              }
              : t
          )
        );

        setActiveTakeId(baseTake.id);
        setStatus(`Punch aplicado en ${safeCursor.toFixed(2)}s ✅`);
        setIsPunchArmed(false);

        // liberar URLs viejas
        try { URL.revokeObjectURL(baseTake.url); } catch { }
        try { URL.revokeObjectURL(punchUrl); } catch { }
      };



    }

    // si ya existe el grafo y el recordGain, nos aseguramos que conecte
    if (recordGainRef.current && destNode) {
      try {
        recordGainRef.current.disconnect();
      } catch {
        // ignore
      }
      recordGainRef.current.connect(destNode);
    }
  }, [audioContext]);

  useEffect(() => {
    if (!audioContext) return;

    const comp = compNodeRef.current;
    const dry = compDryRef.current;
    const wet = compWetRef.current;
    const makeup = compMakeupRef.current;
    if (!comp || !dry || !wet || !makeup) return;

    const t = audioContext.currentTime;

    // Params
    comp.threshold.setTargetAtTime(compressorThreshold, t, 0.01);
    comp.ratio.setTargetAtTime(compressorRatio, t, 0.01);
    comp.attack.setTargetAtTime(compressorAttack, t, 0.01);
    comp.release.setTargetAtTime(compressorRelease, t, 0.01);
    comp.knee.setTargetAtTime(compressorKnee, t, 0.01);

    makeup.gain.setTargetAtTime(compressorMakeup, t, 0.01);

    // True bypass + parallel blend
    if (!compressorEnabled) {
      wet.gain.setTargetAtTime(0, t, 0.01);
      dry.gain.setTargetAtTime(1, t, 0.01);
    } else {
      // mix = cuánto comp entra (parallel). dry = 1 - mix
      wet.gain.setTargetAtTime(compressorMix, t, 0.01);
      dry.gain.setTargetAtTime(1 - compressorMix, t, 0.01);
    }
  }, [
    audioContext,
    compressorEnabled,
    compressorThreshold,
    compressorRatio,
    compressorAttack,
    compressorRelease,
    compressorKnee,
    compressorMakeup,
    compressorMix,
  ]);

  useEffect(() => {
    if (!audioContext) return;

    const dry = driveDryRef.current;
    const wet = driveWetRef.current;
    if (!dry || !wet) return;

    const t = audioContext.currentTime;

    if (!driveEnabled) {
      wet.gain.setTargetAtTime(0, t, 0.01);
      dry.gain.setTargetAtTime(1, t, 0.01);
    } else {
      wet.gain.setTargetAtTime(1, t, 0.01);
      dry.gain.setTargetAtTime(0, t, 0.01);
    }
  }, [audioContext, driveEnabled]);

  useEffect(() => {
    if (!audioContext) return;

    const env = droneEnvAmountRef.current;
    const g = droneGainRef.current;
    if (!env || !g) return;

    const t = audioContext.currentTime;

    // OFF total
    if (!ragaEnabled || ragaDroneLevel <= 0.001) {
      env.gain.setTargetAtTime(0, t, 0.05);
      g.gain.setTargetAtTime(0, t, 0.05);
      return;
    }

    // 🔥 DRONE REAL (alma del sitar)
    // cuánto abre la envolvente (respuesta a la guitarra)
    const envAmount = 0.25 + ragaDroneLevel * 0.75; // rango musical
    env.gain.setTargetAtTime(envAmount, t, 0.06);

    // volumen final del drone (cola constante)
    const droneLevel = ragaDroneLevel * 0.6;
    g.gain.setTargetAtTime(droneLevel, t, 0.08);
  }, [audioContext, ragaEnabled, ragaDroneLevel]);

  useEffect(() => {
    if (!audioContext) return;

    const allpasses = phaserAllpassRefs.current;
    const wet = phaserWetRef.current;
    const dry = phaserDryRef.current;
    const fb = phaserFeedbackRef.current;
    const lfo = phaserLfoRef.current;
    const lfoGain = phaserLfoGainRef.current;

    if (!allpasses.length || !wet || !dry || !fb || !lfo || !lfoGain) return;

    const t = audioContext.currentTime;

    // ON/OFF por mix (simple, estable)
    const mix = phaserEnabled ? phaserMix : 0;
    wet.gain.setTargetAtTime(mix, t, 0.01);
    dry.gain.setTargetAtTime(1 - mix, t, 0.01);

    // Rate: 0..1 -> 0.05..2.5 Hz
    const minHz = 0.05;
    const maxHz = 2.5;
    const hz = minHz + phaserRate * (maxHz - minHz);
    lfo.frequency.setTargetAtTime(hz, t, 0.01);

    // Center freq: 0..1 -> 250..1800 Hz (zona “phaser guitarra”)
    const minF = 250;
    const maxF = 1800;
    const base = minF + phaserCenter * (maxF - minF);

    // Depth: rango de barrido (Hz)
    const sweep = 50 + phaserDepth * 1400;
    lfoGain.gain.setTargetAtTime(sweep, t, 0.01);

    // Set base en cada allpass (el LFO suma/resta alrededor)
    allpasses.forEach((ap) => {
      ap.frequency.setTargetAtTime(base, t, 0.01);
      ap.Q.setTargetAtTime(0.7, t, 0.01);
    });

    // Feedback: 0..1 -> 0..0.85 (cuidado auto-osc)
    const fbAmt = phaserEnabled ? phaserFeedback * 0.85 : 0;
    fb.gain.setTargetAtTime(fbAmt, t, 0.01);
  }, [
    audioContext,
    phaserEnabled,
    phaserRate,
    phaserDepth,
    phaserCenter,
    phaserFeedback,
    phaserMix,
  ]);



  useEffect(() => {
    if (!audioContext) return;
    const f = octaveToneFilterRef.current;
    if (!f) return;

    const t = audioContext.currentTime;
    const minF = 800;
    const maxF = 16000;
    const freq = minF + octaveTone * (maxF - minF);

    f.frequency.setTargetAtTime(freq, t, 0.01);
  }, [audioContext, octaveTone]);
  useEffect(() => {
    if (!audioContext) return;

    const wet = octaveWetRef.current;
    if (!wet) return;

    const t = audioContext.currentTime;

    // wet = (mix * level) cuando está ON, si no 0
    const targetWet = octaveEnabled
      ? octaveMix * (0.5 + octaveLevel * 1.5)
      : 0;
    wet.gain.setTargetAtTime(targetWet, t, 0.01);
  }, [audioContext, octaveEnabled, octaveMix, octaveLevel]);
  useEffect(() => {
    if (!audioContext) return;

    const t = audioContext.currentTime;
    const dry = octaveDryRef.current;
    const modDepth = octaveModDepthRef.current;

    if (!dry || !modDepth) return;

    if (!octaveEnabled) {
      dry.gain.setTargetAtTime(1, t, 0.01);
      modDepth.gain.setTargetAtTime(0, t, 0.01); // OFF real
      return;
    }

    dry.gain.setTargetAtTime(1 - octaveMix, t, 0.01);

    // cuánto “muerde” el ring (ajustable)
    modDepth.gain.setTargetAtTime(octaveMix * 2.0, t, 0.01);
  }, [audioContext, octaveEnabled, octaveMix]);


  useEffect(() => {
    if (!audioContext) return;

    const d = flangerDelayRef.current;
    const fb = flangerFeedbackRef.current;
    const wet = flangerWetRef.current;
    const dry = flangerDryRef.current;
    const lfo = flangerLfoRef.current;
    const lfoGain = flangerLfoGainRef.current;
    if (!d || !fb || !wet || !dry || !lfo || !lfoGain) return;

    const t = audioContext.currentTime;

    // Base delay (ms)
    const baseMs = 2.5;
    d.delayTime.setTargetAtTime(baseMs / 1000, t, 0.01);

    // Rate: 0..1 -> 0.05..1.2 Hz (lento/místico)
    const minHz = 0.05;
    const maxHz = 1.2;
    const hz = minHz + flangerRate * (maxHz - minHz);
    lfo.frequency.setTargetAtTime(hz, t, 0.01);

    // Depth: 0..1 -> 0..4ms (en segundos)
    const depthMs = 4.0 * flangerDepth;
    lfoGain.gain.setTargetAtTime(depthMs / 1000, t, 0.01);

    // Mix
    const mix = flangerEnabled ? flangerMix : 0;
    wet.gain.setTargetAtTime(mix, t, 0.01);
    dry.gain.setTargetAtTime(1 - mix, t, 0.01);

    // Feedback
    const fbAmt = flangerEnabled ? flangerFeedback * 0.85 : 0;
    fb.gain.setTargetAtTime(fbAmt, t, 0.01);
  }, [audioContext, flangerEnabled, flangerRate, flangerDepth, flangerFeedback, flangerMix]);


  // loop del cursor
  const startProgressAnimation = useCallback(() => {
    if (!audioContext || !backingBuffer) return;

    const duration = backingBuffer.duration;

    const step = () => {
      if (!audioContext || !playbackStartTimeRef.current || !isPlayingBackingRef.current) {
        return;
      }

      const elapsed = audioContext.currentTime - playbackStartTimeRef.current;
      const progress = Math.min(1, Math.max(0, elapsed / duration));
      setPlaybackProgress(progress);

      if (elapsed < duration && isPlayingBackingRef.current) {
        progressAnimationRef.current = requestAnimationFrame(step);
      }
    };

    if (progressAnimationRef.current != null) {
      cancelAnimationFrame(progressAnimationRef.current);
      progressAnimationRef.current = null;
    }
    progressAnimationRef.current = requestAnimationFrame(step);
  }, [audioContext, backingBuffer]);

  const stopProgressAnimation = () => {
    if (progressAnimationRef.current != null) {
      cancelAnimationFrame(progressAnimationRef.current);
      progressAnimationRef.current = null;
    }
    isPlayingBackingRef.current = false;
    setPlaybackProgress(0);
    playbackStartTimeRef.current = null;
  };


  // ✅ PEGAR ACÁ (ANTES del startPlaybackAndRecording)
  const armPunchIn = useCallback((cursorSec: number) => {
    punchCursorSecRef.current = cursorSec;
    setIsPunchArmed(true);
    setStatus(`Punch armado en ${cursorSec.toFixed(2)}s`);
  }, [setIsPunchArmed, setStatus]);

  const disarmPunchIn = useCallback(() => {
    setIsPunchArmed(false);
    punchCursorSecRef.current = 0;
    setStatus('Punch desarmado');
  }, [setIsPunchArmed, setStatus]);


  const startPlaybackAndRecording = useCallback(async () => {
    if (!isInputReady || !guitarSourceRef.current) {
      setStatus('Configurá primero la entrada de guitarra');
      return;
    }

    const ctx = getOrCreateAudioContext();
    setupRecordingGraph();

    const destNode = recordingDestinationRef.current;
    const mediaRecorder = mediaRecorderRef.current;

    if (!destNode || !mediaRecorder) {
      setStatus('No se pudo inicializar el grafo de audio');
      return;
    }

    // Ensure main guitar FX graph exists
    ensureGuitarGraph();

    const postFxGain = postFxGainRef.current;
    if (!postFxGain) {
      setStatus('Error interno: grafo de guitarra no creado');
      return;
    }

    // Connect post-FX signal to recording destination
    if (!recordGainRef.current) {
      const recordGain = ctx.createGain();
      recordGain.gain.value = 1; // pequeño boost
      recordGainRef.current = recordGain;
      postFxGain.connect(recordGain);
    }

    try {
      recordGainRef.current.disconnect();
    } catch {
      // ignore
    }
    recordGainRef.current.connect(destNode);

    // ==== BACKING TRACK (opcional) ====
    let backingSource: AudioBufferSourceNode | null = null;
    if (backingBuffer) {
      backingSource = ctx.createBufferSource();
      backingSource.buffer = backingBuffer;
      backingSourceRef.current = backingSource;

      const backingGain = ctx.createGain();
      backingGain.gain.value = backingVolume; // usamos el estado
      backingGainRef.current = backingGain; // lo guardamos para live update

      backingSource.connect(backingGain);
      backingGain.connect(finalMasterGainRef.current ?? ctx.destination);
    } else {
      backingSourceRef.current = null;
    }

    // Iniciamos la grabación
    recordedChunksRef.current = [];

    // --- iniciar contador de grabación ---
    setRecordingSeconds(0);
    recordingStartTimeRef.current = ctx.currentTime;

    if (recordingTimerIdRef.current != null) {
      clearInterval(recordingTimerIdRef.current);
    }

    recordingTimerIdRef.current = window.setInterval(() => {
      if (!audioContext || recordingStartTimeRef.current == null) return;
      const elapsed = audioContext.currentTime - recordingStartTimeRef.current;
      setRecordingSeconds(Math.floor(elapsed));
    }, 250);

    mediaRecorder.start();

    if (backingSource) {
      playbackStartTimeRef.current = ctx.currentTime;
      isPlayingBackingRef.current = true;
      setPlaybackProgress(0);
      startProgressAnimation();

      backingSource.start();

      setIsRecording(true);
      setStatus('Grabando con backing... 🔴');

      backingSource.onended = () => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        setIsRecording(false);
        stopProgressAnimation();
      };
    } else {
      // grabación “libre” sin backing
      playbackStartTimeRef.current = null;
      isPlayingBackingRef.current = false;
      setPlaybackProgress(0);

      setIsRecording(true);
      setStatus('Grabando (sin backing)... 🔴');
    }
  }, [
    isInputReady,
    backingBuffer,
    ensureGuitarGraph,
    getOrCreateAudioContext,
    setupRecordingGraph,
    startProgressAnimation,
  ]);

  const stopRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    const backingSource = backingSourceRef.current;

    if (backingSource) {
      try {
        backingSource.stop();
      } catch {
        // ignore
      }
      backingSourceRef.current = null;
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    // detener contador
    if (recordingTimerIdRef.current != null) {
      clearInterval(recordingTimerIdRef.current);
      recordingTimerIdRef.current = null;
    }
    recordingStartTimeRef.current = null;
    setRecordingSeconds(0);

    setIsRecording(false);
    setStatus('Grabación detenida manualmente');
    stopProgressAnimation();
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (backingSourceRef.current) {
        try {
          backingSourceRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (offlinePreviewAnimRef.current != null) {
        cancelAnimationFrame(offlinePreviewAnimRef.current);
      }
      stopProgressAnimation();
      if (recordingTimerIdRef.current != null) {
        clearInterval(recordingTimerIdRef.current);
      }
      guitarStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContext?.close();
    };
  }, [audioContext]);



  // === Live update del pedal Raga (simple y notorio) ===
  useEffect(() => {
    if (!audioContext) return;

    const res1 = ragaFilterRef.current;           // peaking 1
    const mix = ragaGainRef.current;              // gain final
    const res2 = ragaSympatheticRef.current;      // peaking 2 (reusé tu ref)

    if (!res1 || !mix || !res2) return;

    const t = audioContext.currentTime;

    if (!ragaEnabled) {
      mix.gain.setTargetAtTime(0, t, 0.02);
      res1.gain.setTargetAtTime(0, t, 0.02);
      res2.gain.setTargetAtTime(0, t, 0.02);
      return;
    }

    // 1) MIX real (Drone knob = “level” del pedal, más útil)
    // subilo fuerte: esto es lo que te faltaba para que se note
    const level = 0.15 + ragaDroneLevel * 1.35;   // 0.15..1.5
    mix.gain.setTargetAtTime(level, t, 0.02);

    // 2) COLOR = mueve las 2 resonancias (cambia “nota” del timbre)
    const base1 = 900 + ragaColor * 3200;         // 900..4100
    const base2 = 2800 + ragaColor * 2200;        // 4200..9400
    res1.frequency.setTargetAtTime(base1, t, 0.02);
    res2.frequency.setTargetAtTime(base2, t, 0.02);

    // 3) RESONANCE = Q + dB (acá aparece el carácter)
    const q1 = 3 + ragaResonance * 22;            // 3..25
    const q2 = 3 + ragaResonance * 6;            // 6..32
    res1.Q.setTargetAtTime(q1, t, 0.02);
    res2.Q.setTargetAtTime(q2, t, 0.02);

    // ganancia de resonancia (peaking gain en dB)
    const g1 = 2 + ragaResonance * 16;            // 2..18 dB
    const g2 = 1 + ragaResonance * 6;           // 1..15 dB
    res1.gain.setTargetAtTime(g1, t, 0.02);
    res2.gain.setTargetAtTime(g2, t, 0.02);
  }, [audioContext, ragaEnabled, ragaResonance, ragaDroneLevel, ragaColor]);




  // Volumen del preview offline en vivo
  useEffect(() => {
    if (!audioContext) return;
    if (offlinePreviewGainRef.current) {
      offlinePreviewGainRef.current.gain.setTargetAtTime(
        offlineVolume,
        audioContext.currentTime,
        0.01,
      );
    }
  }, [offlineVolume, audioContext]);

  // === Actualizar efectos en tiempo real ===

  // Delay bypass / mix
  useEffect(() => {
    if (!audioContext) return;
    if (wetGainRef.current) {
      const target = delayEnabled ? mixAmount : 0;
      wetGainRef.current.gain.setTargetAtTime(
        target,
        audioContext.currentTime,
        0.01,
      );
    }
  }, [delayEnabled, mixAmount, audioContext]);

  // Delay time & feedback
  useEffect(() => {
    if (!audioContext) return;
    if (delayNodeRef.current) {
      delayNodeRef.current.delayTime.setTargetAtTime(
        delayTimeMs / 1000,
        audioContext.currentTime,
        0.01,
      );
    }
    if (feedbackGainRef.current) {
      feedbackGainRef.current.gain.setTargetAtTime(
        feedbackAmount,
        audioContext.currentTime,
        0.01,
      );
    }
  }, [delayTimeMs, feedbackAmount, audioContext]);

  // Amp gain / tone / master
  useEffect(() => {
    if (!audioContext) return;
    if (ampGainNodeRef.current) {
      ampGainNodeRef.current.gain.setTargetAtTime(
        ampGain,
        audioContext.currentTime,
        0.01,
      );
    }
  }, [ampGain, audioContext]);

  useEffect(() => {
    if (!audioContext) return;

    // curve
    if (valveShaperRef.current) {
      valveShaperRef.current.curve = makeDriveCurve(
        valveMode,
        valveEnabled ? valveDrive : 0,
      );
    }

    // tone
    if (valveToneRef.current) {
      const minF = 800;
      const maxF = 16000;
      const f = minF + valveTone * (maxF - minF);
      valveToneRef.current.frequency.setTargetAtTime(f, audioContext.currentTime, 0.01);
    }

    // level (solo afecta el wet chain)
    if (valveLevelRef.current) {
      valveLevelRef.current.gain.setTargetAtTime(valveLevel, audioContext.currentTime, 0.01);
    }

    // ✅ TRUE BYPASS (dry/wet router)
    const dry = valveDryRef.current;
    const wet = valveWetRef.current;
    if (dry && wet) {
      const t = audioContext.currentTime;
      if (!valveEnabled) {
        wet.gain.setTargetAtTime(0, t, 0.01);
        dry.gain.setTargetAtTime(1, t, 0.01);
      } else {
        wet.gain.setTargetAtTime(1, t, 0.01);
        dry.gain.setTargetAtTime(0, t, 0.01);
      }
    }
  }, [audioContext, valveEnabled, valveDrive, valveTone, valveLevel, valveMode]);


  useEffect(() => {
    if (!audioContext) return;
    if (toneFilterRef.current) {
      const minFreq = 200;
      const maxFreq = 16000;
      const freq = minFreq + ampTone * (maxFreq - minFreq);
      toneFilterRef.current.frequency.setTargetAtTime(
        freq,
        audioContext.currentTime,
        0.01,
      );
    }
  }, [ampTone, audioContext]);
  // === Live update de Sympathetic Strings según el pedal ===
  useEffect(() => {
    if (!audioContext) return;
    if (!ragaSympatheticGainRef.current || !ragaSympatheticRef.current) return;

    const t = audioContext.currentTime;

    // Si el pedal está apagado, cero mezcla
    if (!ragaEnabled) {
      ragaSympatheticGainRef.current.gain.setTargetAtTime(0, t, 0.01);
      return;
    }

    // Mezcla proporcional al knob DRONE/LEVEL
    ragaSympatheticGainRef.current.gain.setTargetAtTime(
      ragaDroneLevel * 0.9,
      t,
      0.01
    );

    // Resonancia controlada por el knob RESONANCE
    const minQ = 10;
    const maxQ = 25;
    ragaSympatheticRef.current.Q.setTargetAtTime(
      minQ + (maxQ - minQ) * ragaResonance,
      t,
      0.01
    );

    // Color combina el rango
    const minF = 5500;
    const maxF = 9000;
    ragaSympatheticRef.current.frequency.setTargetAtTime(
      minF + ragaColor * (maxF - minF),
      t,
      0.01
    );
  }, [audioContext, ragaEnabled, ragaDroneLevel, ragaResonance, ragaColor]);

  useEffect(() => {
    if (!audioContext) return;
    if (masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(
        ampMaster * 2.0,
        audioContext.currentTime,
        0.01,
      );
    }
  }, [ampMaster, audioContext]);

  // Tonestack live (bass / mid / treble / presence)
  useEffect(() => {
    if (!audioContext) return;
    if (bassFilterRef.current) {
      bassFilterRef.current.gain.setTargetAtTime(
        (bassAmount - 0.5) * 12,
        audioContext.currentTime,
        0.01,
      );
    }
  }, [bassAmount, audioContext]);

  useEffect(() => {
    if (!audioContext) return;
    if (midFilterRef.current) {
      midFilterRef.current.gain.setTargetAtTime(
        (midAmount - 0.5) * 10,
        audioContext.currentTime,
        0.01,
      );
    }
  }, [midAmount, audioContext]);

  useEffect(() => {
    if (!audioContext) return;
    if (trebleFilterRef.current) {
      trebleFilterRef.current.gain.setTargetAtTime(
        (trebleAmount - 0.5) * 12,
        audioContext.currentTime,
        0.01,
      );
    }
  }, [trebleAmount, audioContext]);

  useEffect(() => {
    if (!audioContext) return;
    if (presenceFilterRef.current) {
      presenceFilterRef.current.gain.setTargetAtTime(
        (presenceAmount - 0.5) * 14,
        audioContext.currentTime,
        0.01,
      );
    }
  }, [presenceAmount, audioContext]);

  // Monitor on/off → cambiamos ganancia
  useEffect(() => {
    if (!audioContext) return;
    if (!monitorGainRef.current) return;
    monitorGainRef.current.gain.setTargetAtTime(
      monitorEnabled ? 1 : 0,
      audioContext.currentTime,
      0.05
    );
  }, [monitorEnabled, audioContext]);

  // Sitar amount
  useEffect(() => {
    if (!audioContext) return;
    if (sitarDryRef.current && sitarWetRef.current) {
      sitarDryRef.current.gain.setTargetAtTime(
        1 - sitarAmount,
        audioContext.currentTime,
        0.01,
      );
      sitarWetRef.current.gain.setTargetAtTime(
        sitarAmount,
        audioContext.currentTime,
        0.01,
      );
    }
  }, [sitarAmount, audioContext]);

  // Drive amount / bypass
  useEffect(() => {
    if (!audioContext) return;
    if (driveNodeRef.current) {
      driveNodeRef.current.curve = makeDriveCurve(driveMode, driveEnabled ? driveAmount : 0);
    }
  }, [driveAmount, driveEnabled, audioContext, driveMode]);

  // Reverb amount
  useEffect(() => {
    if (!audioContext) return;
    if (reverbWetRef.current && reverbDryRef.current) {
      reverbWetRef.current.gain.setTargetAtTime(
        reverbAmount,
        audioContext.currentTime,
        0.01,
      );
      reverbDryRef.current.gain.setTargetAtTime(
        1 - reverbAmount,
        audioContext.currentTime,
        0.01,
      );
    }
  }, [reverbAmount, audioContext]);

  // Volumen del backing en vivo
  useEffect(() => {
    if (!audioContext) return;
    if (backingGainRef.current) {
      backingGainRef.current.gain.setTargetAtTime(
        backingVolume,
        audioContext.currentTime,
        0.01,
      );
    }
  }, [backingVolume, audioContext]);

  // 🔹 Master output en vivo
  useEffect(() => {
    if (!audioContext) return;
    if (finalMasterGainRef.current) {
      finalMasterGainRef.current.gain.setTargetAtTime(
        masterVolume,
        audioContext.currentTime,
        0.03,
      );
    }
  }, [masterVolume, audioContext]);

  // Cambios de modo del sitar (en vivo)
  useEffect(() => {
    if (!audioContext) return;
    if (
      !sitarBandpassRef.current ||
      !sitarSympatheticRef.current ||
      !jawariDriveRef.current ||
      !jawariHighpassRef.current
    ) {
      return;
    }

    applySitarMode(sitarMode, {
      sitarBandpass: sitarBandpassRef.current,
      sitarSympathetic: sitarSympatheticRef.current,
      jawariDrive: jawariDriveRef.current,
      jawariHighpass: jawariHighpassRef.current,
    });
  }, [sitarMode, audioContext]);
  // 🔥 Actualización en vivo del pedal Raga

  const value: AudioEngineContextValue = {
    // ✅ TAKES (ESTO ES LO NUEVO)
    takes,
    activeTakeId,
    setActiveTakeId,

    status,
    isInputReady,
    isRecording,
    hasBacking: !!backingBuffer,
    // ✅ Presets
    getCurrentSettings,
    applySettings,
    getAnalyserNode,
    // 🔹 Metronome
    bpm,
    setBpm,
    metronomeOn,
    startMetronome,
    stopMetronome,
    metronomeVolume,
    setMetronomeVolume,
    driveMode,
    setDriveMode,
    // 🔹 Volumen del backing
    backingVolume,
    setBackingVolume,

    backingName,
    backingWaveform,
    playbackProgress,
    // Flanger
    flangerEnabled,
    setFlangerEnabled,
    flangerRate,
    setFlangerRate,
    flangerDepth,
    setFlangerDepth,
    flangerFeedback,
    setFlangerFeedback,
    flangerMix,
    setFlangerMix,

    // Phaser
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

    // Delay
    delayTimeMs,
    setDelayTimeMs,
    feedbackAmount,
    setFeedbackAmount,
    mixAmount,
    setMixAmount,

    // Delay extras (agregá esto)
    delayHPHz,
    setDelayHPHz,
    delayLPHz,
    setDelayLPHz,
    delayModRate,
    setDelayModRate,
    delayModDepthMs,
    setDelayModDepthMs,


    isPunchArmed,
    armPunchIn,
    disarmPunchIn,

    // Amp
    ampGain,
    setAmpGain,
    ampTone,
    setAmpTone,
    ampMaster,
    setAmpMaster,
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
    // Tonestack
    bassAmount,
    setBassAmount,
    midAmount,
    setMidAmount,
    trebleAmount,
    setTrebleAmount,
    presenceAmount,
    setPresenceAmount,

    // Delay bypass
    delayEnabled,
    setDelayEnabled,

    // Raga pedal
    ragaEnabled,
    setRagaEnabled,
    ragaResonance,
    setRagaResonance,
    ragaDroneLevel,
    setRagaDroneLevel,
    ragaColor,
    setRagaColor,

    // Sitar
    sitarAmount,
    setSitarAmount,
    sitarMode,
    setSitarMode,
    octaveTone,
    setOctaveTone,
    octaveLevel,
    setOctaveLevel,
    // Drive
    driveAmount,
    setDriveAmount,
    driveEnabled,
    setDriveEnabled,

    // Reverb
    reverbAmount,
    setReverbAmount,
    valveEnabled,
    setValveEnabled,
    valveDrive,
    setValveDrive,
    valveTone,
    setValveTone,
    valveLevel,
    setValveLevel,
    // Monitor
    monitorEnabled,
    setMonitorEnabled,

    // Master global
    masterVolume,
    setMasterVolume,

    // Procesado offline
    processFileThroughSitar,
    playProcessed,
    stopProcessed,
    exportProcessed,
    processedWaveform,
    offlineVolume,
    setOfflineVolume,
    offlinePreviewProgress,
    // Octave
    octaveEnabled,
    setOctaveEnabled,
    octaveMix,
    setOctaveMix,
    // Acciones principales
    setupGuitarInput,
    loadBackingFile,
    startPlaybackAndRecording,
    stopRecording,
    recordingSeconds,
    valveMode,
    setValveMode,


  };

  return (
    <AudioEngineContext.Provider value={value}>
      {children}
    </AudioEngineContext.Provider>
  );
};
