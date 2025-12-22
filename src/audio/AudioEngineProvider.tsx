// src/audio/AudioEngineProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { AudioEngineContextValue, DriveMode, EngineSettings, SitarMode } from './audioTypes';
import { applySitarMode, makeDriveCurve, computeWaveform } from './audioDSP';

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

export const AudioEngineProvider: React.FC<Props> = ({ children }) => {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [backingBuffer, setBackingBuffer] = useState<AudioBuffer | null>(null);
  const [backingName, setBackingName] = useState<string | null>(null);
  const [backingWaveform, setBackingWaveform] = useState<number[] | null>(null);
  const [driveMode, setDriveMode] = useState<DriveMode>('overdrive');

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
  const [octaveAmount, setOctaveAmount] = useState(1); // 1 = +1 octava

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
  const getCurrentSettings = useCallback((): EngineSettings => {
    return {
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
    };
  }, [
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
    flangerMix,

    octaveEnabled,

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

  const applySettings = useCallback((s: EngineSettings) => {
    // 🔹 UI state (React)
    setAmpGain(s.ampGain);
    setAmpTone(s.ampTone);
    setAmpMaster(s.ampMaster);

    setBassAmount(s.bassAmount);
    setMidAmount(s.midAmount);
    setTrebleAmount(s.trebleAmount);
    setPresenceAmount(s.presenceAmount);

    setDriveAmount(s.driveAmount);
    setDriveEnabled(s.driveEnabled);

    setDelayEnabled(s.delayEnabled);
    setDelayTimeMs(s.delayTimeMs);
    setFeedbackAmount(s.feedbackAmount);
    setMixAmount(s.mixAmount);

    setReverbAmount(s.reverbAmount);

    setSitarAmount(s.sitarAmount);
    setSitarMode(s.sitarMode);

    // ✅ Phaser
    setPhaserEnabled(s.phaserEnabled);
    setPhaserRate(s.phaserRate);
    setPhaserDepth(s.phaserDepth);
    setPhaserFeedback(s.phaserFeedback);
    setPhaserMix(s.phaserMix);
    setPhaserCenter(s.phaserCenter);

    // ✅ Flanger
    setFlangerEnabled(s.flangerEnabled);
    setFlangerRate(s.flangerRate);
    setFlangerDepth(s.flangerDepth);
    setFlangerMix(s.flangerMix);

    // ✅ Octave
    setOctaveEnabled(s.octaveEnabled);
    setOctaveTone(s.octaveTone);
    setOctaveLevel(s.octaveLevel);
    setOctaveMix(s.octaveMix);

    // ✅ Valve
    setValveEnabled(s.valveEnabled);
    setValveDrive(s.valveDrive);
    setValveTone(s.valveTone);
    setValveLevel(s.valveLevel);
    setValveMode(s.valveMode);

    // ✅ Raga
    setRagaEnabled(s.ragaEnabled);
    setRagaResonance(s.ragaResonance);
    setRagaDroneLevel(s.ragaDroneLevel);
    setRagaColor(s.ragaColor);
  }, []);


  // Refs para la animación del cursor en el preview offline
  const offlinePreviewStartTimeRef = useRef<number | null>(null);
  const offlinePreviewAnimRef = useRef<number | null>(null);
  const droneEnvAmountRef = useRef<GainNode | null>(null);
  const droneGainRef = useRef<GainNode | null>(null);

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
  const [octaveTone, setOctaveTone] = useState(0.55);  // 0..1
  const [octaveLevel, setOctaveLevel] = useState(0.9); // 0..1

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
    const ctx = new AudioContext();
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

    const driveNode = ctx.createWaveShaper();
    driveNode.curve = makeDriveCurve(driveMode, driveEnabled ? driveAmount : 0);
    driveNode.oversample = '4x';
    driveNodeRef.current = driveNode;

    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = 'lowpass';
    const minFreq = 200;
    const maxFreq = 16000;
    toneFilter.frequency.value = minFreq + ampTone * (maxFreq - minFreq);
    toneFilterRef.current = toneFilter;

    // === MASTER GAIN NODE ===
    const masterGain = ctx.createGain();
    masterGain.gain.value = ampMaster * 2.0;
    masterGainRef.current = masterGain;

    // Declare preSitarNode here before first use
    let preSitarNode: AudioNode = toneFilter;

    // === PEDAL RAGA (sin drone: resonador nasal en paralelo) ===
    const ragaBandpass = ctx.createBiquadFilter();
    ragaBandpass.type = 'bandpass';
    // valores base, después se actualizan por useEffect
    ragaBandpass.frequency.value = 2000;
    ragaBandpass.Q.value = 5;

    const ragaGain = ctx.createGain();
    // arranca apagado, lo prende el pedal
    ragaGain.gain.value = 0;

    // Cadena: toneFilter → ragaBandpass → ragaGain → masterGain
    preSitarNode.connect(ragaBandpass);
    ragaBandpass.connect(ragaGain);
    ragaGain.connect(masterGain);

    // Guardar refs para el live update
    ragaFilterRef.current = ragaBandpass;
    ragaGainRef.current = ragaGain;

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
    toneFilter.connect(ragaSym);
    ragaSym.connect(ragaSymGain);
    ragaSymGain.connect(masterGain);

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

    ampGainNode.connect(driveNode);
    driveNode.connect(toneFilter);
    let preFxNode: AudioNode = toneFilter;
    // ======================================================
    // 🎵 OCTAVE PEDAL (OFFLINE)
    // ======================================================


    // ======================================================
    // 🌺 RESIDUAL DRONE ENGINE (alma del sitar)
    // ======================================================

    // 1) Fuente de ruido constante (muy bajo nivel)
    const droneNoiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const noiseData = droneNoiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.15;
    }

    const droneNoise = ctx.createBufferSource();
    droneNoise.buffer = droneNoiseBuffer;
    droneNoise.loop = true;

    // 2) Filtro resonante (cuerdas simpáticas)
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'bandpass';
    droneFilter.frequency.value = 2200; // rango sitar
    droneFilter.Q.value = 28;           // MUY resonante
    // 2.5) Ganancia del drone (nivel base + envelope)
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.0; // arranca cerrado, lo abre el envelope

    // 3) Envelope follower REAL (rectificador + lowpass)

    // Rectificador full-wave (abs)
    const droneRectifier = ctx.createWaveShaper();
    droneRectifier.curve = (() => {
      const n = 2048;
      const curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        curve[i] = Math.abs(x);
      }
      return curve;
    })();
    droneRectifier.oversample = "4x";

    // Lowpass para suavizar la envolvente (respira lento)
    const droneEnvLP = ctx.createBiquadFilter();
    droneEnvLP.type = "lowpass";
    droneEnvLP.frequency.value = 8; // MÁS lento = más cola

    // Excitación desde la guitarra
    toneFilter.connect(droneRectifier);
    droneRectifier.connect(droneEnvLP);
    const droneEnvAmount = ctx.createGain();
    droneEnvAmount.gain.value = 0.0; // arranca cerrado
    droneEnvAmountRef.current = droneEnvAmount;

    droneGain.gain.value = 0.0; // arranca cerrado
    droneGainRef.current = droneGain;

    droneEnvAmount.connect(droneGain.gain);


    droneEnvLP.connect(droneEnvAmount);

    // Controla la ganancia del drone


    // Camino del drone
    droneNoise.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(masterGain);

    // Arrancar ruido
    droneNoise.start();

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

    // Conexión interna del efecto
    valveShaper.connect(valveToneFilter);
    valveToneFilter.connect(valveLevelGain);

    // 2) Router dry / wet
    const valveDry = ctx.createGain();
    valveDry.gain.value = 1.0;

    const valveWet = ctx.createGain();
    valveWet.gain.value = 0.0;

    // Guardar refs para togglear ON/OFF en useEffect
    valveDryRef.current = valveDry;
    valveWetRef.current = valveWet;

    // 3) Entrada desde toneFilter: se divide a dry y al efecto
    toneFilter.connect(valveDry);
    toneFilter.connect(valveShaper);

    // salida del efecto entra al wet
    valveLevelGain.connect(valveWet);

    // 4) SUMA (mix out)
    const valveOut = ctx.createGain();
    valveDry.connect(valveOut);
    valveWet.connect(valveOut);

    // 5) Desde ahora, el grafo sigue desde valveOut
    preSitarNode = valveOut;

    // // mix out
    // valveDry.connect(valveOut);
    // valveWet.connect(valveOut);

    // // desde ahora, el grafo sigue desde valveOut
    // preSitarNode = valveOut;

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
    // ✅ CONEXIONES SITAR (LIVE) — acá SÍ existe preDelayInput

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

    delayNode.connect(wetGain);
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode);

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
  const processFileThroughSitar = useCallback(
    async (file: File) => {
      try {
        const mainCtx = getOrCreateAudioContext();
        const arrayBuffer = await file.arrayBuffer();
        const decoded = await mainCtx.decodeAudioData(arrayBuffer);

        const offlineCtx = new OfflineAudioContext(
          decoded.numberOfChannels,
          decoded.length,
          decoded.sampleRate,
        );

        const src = offlineCtx.createBufferSource();
        src.buffer = decoded;

        // === Grafo simplificado tipo SitarAmp ===
        const inputGain = offlineCtx.createGain();
        inputGain.gain.value = 1;

        // Drive
        const driveNode = offlineCtx.createWaveShaper();
        driveNode.curve = makeDriveCurve(driveMode, driveEnabled ? driveAmount : 0);
        driveNode.oversample = '4x';

        // Tone (lowpass sencillo)
        const toneFilter = offlineCtx.createBiquadFilter();
        toneFilter.type = 'lowpass';
        const minFreq = 200;
        const maxFreq = 16000;
        toneFilter.frequency.value = minFreq + ampTone * (maxFreq - minFreq);

        // Sitar
        const sitarDryGain = offlineCtx.createGain();
        sitarDryGain.gain.value = 1 - sitarAmount;

        const sitarWetGain = offlineCtx.createGain();
        sitarWetGain.gain.value = sitarAmount;

        const sitarBandpass = offlineCtx.createBiquadFilter();
        sitarBandpass.type = 'bandpass';

        const sitarSympathetic = offlineCtx.createBiquadFilter();
        sitarSympathetic.type = 'bandpass';

        const jawariDrive = offlineCtx.createWaveShaper();
        jawariDrive.curve = makeDriveCurve('distortion', 0.55);
        jawariDrive.oversample = '4x';

        const jawariDelay = offlineCtx.createDelay(0.02);
        jawariDelay.delayTime.value = 0.0009;

        const jawariFeedback = offlineCtx.createGain();
        jawariFeedback.gain.value = 0.35;

        const jawariHighpass = offlineCtx.createBiquadFilter();
        jawariHighpass.type = 'highpass';
        jawariHighpass.frequency.value = 1800;

        applySitarMode(sitarMode, {
          sitarBandpass,
          sitarSympathetic,
          jawariDrive,
          jawariHighpass,
        });

        // Delay
        const preDelayGain = offlineCtx.createGain();

        const dryGain = offlineCtx.createGain();
        dryGain.gain.value = 1 - mixAmount;

        const wetGain = offlineCtx.createGain();
        wetGain.gain.value = delayEnabled ? mixAmount : 0;

        const delayNode = offlineCtx.createDelay(2.0);
        delayNode.delayTime.value = delayTimeMs / 1000;

        const feedbackGain = offlineCtx.createGain();
        feedbackGain.gain.value = feedbackAmount;

        // Master + reverb
        const masterGainNode = offlineCtx.createGain();
        masterGainNode.gain.value = ampMaster * 3.0 * masterVolume;

        const reverbDry = offlineCtx.createGain();
        const reverbWet = offlineCtx.createGain();
        reverbDry.gain.value = 1 - reverbAmount;
        reverbWet.gain.value = reverbAmount;

        const reverb = offlineCtx.createConvolver();
        // reutilizamos el generador de IR
        reverb.buffer = getReverbImpulse(offlineCtx as unknown as AudioContext);

        // === Conexiones ===
        src.connect(inputGain);
        inputGain.connect(driveNode);
        driveNode.connect(toneFilter);
        // ======================================================
        // 🔗 FX CHAIN OFFLINE (octave + phaser)
        // ======================================================
        let preFxOffline: AudioNode = toneFilter;

        // -------- OCTAVE (OFFLINE) --------
        const octaveDryOff = offlineCtx.createGain();
        const octaveRingOff = offlineCtx.createGain();
        const octaveOutOff = offlineCtx.createGain();

        octaveDryOff.gain.value = 1.0;
        octaveRingOff.gain.value = octaveEnabled ? octaveMix : 0;

        preFxOffline.connect(octaveDryOff);
        preFxOffline.connect(octaveRingOff);

        octaveDryOff.connect(octaveOutOff);
        octaveRingOff.connect(octaveOutOff);

        preFxOffline = octaveOutOff;

        // -------- PHASER (OFFLINE) --------
        const phaserInOff = offlineCtx.createGain();

        const phaserDryOff = offlineCtx.createGain();
        const phaserWetOff = offlineCtx.createGain();
        phaserDryOff.gain.value = 1 - (phaserEnabled ? phaserMix : 0);
        phaserWetOff.gain.value = phaserEnabled ? phaserMix : 0;

        const phaserFbOff = offlineCtx.createGain();
        phaserFbOff.gain.value = phaserEnabled ? phaserFeedback * 0.85 : 0;

        const stagesOff = 6;
        const allpassesOff: BiquadFilterNode[] = [];

        for (let i = 0; i < stagesOff; i++) {
          const ap = offlineCtx.createBiquadFilter();
          ap.type = 'allpass';
          ap.Q.value = 0.7;
          allpassesOff.push(ap);
        }

        phaserInOff.connect(allpassesOff[0]);
        for (let i = 0; i < stagesOff - 1; i++) {
          allpassesOff[i].connect(allpassesOff[i + 1]);
        }

        // feedback loop
        allpassesOff[stagesOff - 1].connect(phaserFbOff);
        phaserFbOff.connect(phaserInOff);

        // wet/dry
        allpassesOff[stagesOff - 1].connect(phaserWetOff);
        phaserInOff.connect(phaserDryOff);

        // out
        const phaserOutOff = offlineCtx.createGain();
        phaserDryOff.connect(phaserOutOff);
        phaserWetOff.connect(phaserOutOff);

        // LFO
        const lfoOff = offlineCtx.createOscillator();
        lfoOff.type = 'sine';
        lfoOff.frequency.value = 0.05 + phaserRate * 2.5;

        const lfoGainOff = offlineCtx.createGain();
        lfoGainOff.gain.value = 50 + phaserDepth * 1400;

        lfoOff.connect(lfoGainOff);

        const baseFreqOff = 250 + phaserCenter * (1800 - 250);
        allpassesOff.forEach((ap) => {
          ap.frequency.value = baseFreqOff;
          lfoGainOff.connect(ap.frequency);
        });

        lfoOff.start();

        // routing: preFxOffline -> phaserInOff -> phaserOutOff
        preFxOffline.connect(phaserInOff);
        preFxOffline = phaserOutOff;


        // ======================================================
        // 🎵 OCTAVE PEDAL (OFFLINE) — usar offlineCtx
        // ======================================================
        const octaveDry = offlineCtx.createGain();
        const octaveRing = offlineCtx.createGain();
        octaveDry.gain.value = 1.0;
        octaveRing.gain.value = 0.0;

        const octaveOsc = offlineCtx.createOscillator();
        octaveOsc.type = 'sine';
        octaveOsc.frequency.value = 880;
        octaveOsc.start();

        // toneFilter -> dry + ring
        toneFilter.connect(octaveDry);
        toneFilter.connect(octaveRing);
        octaveOsc.connect(octaveRing.gain);

        // mix out
        const octaveOut = offlineCtx.createGain();
        octaveDry.connect(octaveOut);
        octaveRing.connect(octaveOut);

        // y a partir de acá seguís con octaveOut en vez de toneFilter:
        const preSitar = octaveOut;



        // // Conexiones
        // toneFilter.connect(octaveDry);
        // toneFilter.connect(octaveRing);

        // octaveOsc.connect(octaveRing.gain);

        // // Mix
        // const octaveOut = ctx.createGain();
        // octaveDry.connect(octaveOut);
        // octaveRing.connect(octaveOut);

        // // Desde ahora, preSitarNode sale de octaveOut
        // preSitarNode = octaveOut;


        // sitar dry/wet entra desde la cadena OFFLINE
        preFxOffline.connect(sitarDryGain);
        preFxOffline.connect(sitarBandpass);
        preFxOffline.connect(sitarSympathetic);
        // sitar “jawari”

        sitarBandpass.connect(jawariDrive);
        jawariDrive.connect(jawariDelay);
        jawariDelay.connect(jawariFeedback);
        jawariFeedback.connect(jawariDelay);
        jawariDelay.connect(jawariHighpass);
        jawariHighpass.connect(sitarWetGain);

        // sitar “sympathetic”

        sitarSympathetic.connect(sitarWetGain);

        // mix sitar
        sitarDryGain.connect(preDelayGain);
        sitarWetGain.connect(preDelayGain);

        // delay
        preDelayGain.connect(dryGain);
        preDelayGain.connect(delayNode);
        delayNode.connect(wetGain);
        delayNode.connect(feedbackGain);
        feedbackGain.connect(delayNode);

        // to master
        dryGain.connect(masterGainNode);
        wetGain.connect(masterGainNode);

        // reverb
        masterGainNode.connect(reverbDry);
        masterGainNode.connect(reverb);
        reverb.connect(reverbWet);

        reverbDry.connect(offlineCtx.destination);
        reverbWet.connect(offlineCtx.destination);

        src.start(0);

        const rendered = await offlineCtx.startRendering();
        setProcessedBuffer(rendered);
        setProcessedWaveform(computeWaveform(rendered));
        setStatus('Archivo procesado con Neon Sitar ✅');
      } catch (err) {
        console.error(err);
        setStatus('Error al procesar archivo con Neon Sitar');
      }
    },
    [
      getOrCreateAudioContext,
      delayTimeMs,
      feedbackAmount,
      mixAmount,
      delayEnabled,
      reverbAmount,
      sitarAmount,
      sitarMode,
      ampMaster,
      ampTone,
      driveAmount,
      driveEnabled,
      masterVolume,
      getReverbImpulse,
    ],
  );

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

      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/wav' });
        recordedChunksRef.current = [];

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'neon-sitar-take.wav';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setStatus('Grabación finalizada y exportada 🎧');
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
    const env = droneEnvAmountRef.current;
    const g = droneGainRef.current;
    if (!env || !g) return;

    const t = audioContext.currentTime;

    if (!ragaEnabled || ragaDroneLevel <= 0.001) {
      env.gain.setTargetAtTime(0, t, 0.03);
      g.gain.setTargetAtTime(0, t, 0.03);
      return;
    }

    // cuánto abre la envolvente (subí/bajá a gusto)
    env.gain.setTargetAtTime(0.35 * ragaDroneLevel, t, 0.03);
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
      backingGain.connect(ctx.destination);
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

    const bp = ragaFilterRef.current;
    const out = ragaGainRef.current;
    if (!bp || !out) return;

    const t = audioContext.currentTime;

    // Si el pedal está OFF, no mezcla nada
    if (!ragaEnabled) {
      out.gain.setTargetAtTime(0, t, 0.01);
      return;
    }

    // 1) LEVEL: cuánta señal del resonador se mezcla
    //    (usa tu knob "DRONE" como mezcla de efecto)
    out.gain.setTargetAtTime(ragaDroneLevel, t, 0.01);

    // 2) RESONANCE: Q del band-pass
    const minQ = 1;
    const maxQ = 25;
    const q = minQ + ragaResonance * (maxQ - minQ);
    bp.Q.setTargetAtTime(q, t, 0.01);

    // 3) COLOR: frecuencia central (grave → agudo)
    const minF = 800;
    const maxF = 5000;
    const f = minF + ragaColor * (maxF - minF);
    bp.frequency.setTargetAtTime(f, t, 0.01);
  }, [audioContext, ragaEnabled, ragaDroneLevel, ragaResonance, ragaColor]);



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
      0.01,
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
      const amount = driveEnabled ? driveAmount * 6 : 0;
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
        0.01,
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

    // Amp
    ampGain,
    setAmpGain,
    ampTone,
    setAmpTone,
    ampMaster,
    setAmpMaster,

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
