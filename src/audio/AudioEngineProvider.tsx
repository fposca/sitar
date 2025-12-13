// src/audio/AudioEngineProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

export type SitarMode = 'sharp' | 'major' | 'minor' | 'exotic';

type AudioEngineContextValue = {
  status: string;
  isInputReady: boolean;
  isRecording: boolean;
  hasBacking: boolean;

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

  // Delay bypass
  delayEnabled: boolean;
  setDelayEnabled: (value: boolean) => void;

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

  // Acciones
  setupGuitarInput: () => Promise<void>;
  loadBackingFile: (file: File) => Promise<void>;
  startPlaybackAndRecording: () => Promise<void>;
  stopRecording: () => void;
};

const AudioEngineContext = createContext<AudioEngineContextValue | null>(null);

// helper simple para saturación tipo drive
const makeDriveCurve = (amount: number) => {
  const k = amount;
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
};

// Ajusta la respuesta “india” según el modo elegido
const applySitarMode = (
  mode: SitarMode,
  nodes: {
    sitarBandpass: BiquadFilterNode;
    sitarSympathetic: BiquadFilterNode;
  },
) => {
  switch (mode) {
    case 'sharp': {
      // bien filoso, brillante
      nodes.sitarBandpass.frequency.value = 3800;
      nodes.sitarBandpass.Q.value = 7;

      nodes.sitarSympathetic.frequency.value = 6500;
      nodes.sitarSympathetic.Q.value = 10;
      break;
    }
    case 'major': {
      // más abierto, menos nasal
      nodes.sitarBandpass.frequency.value = 3200;
      nodes.sitarBandpass.Q.value = 5;

      nodes.sitarSympathetic.frequency.value = 5400;
      nodes.sitarSympathetic.Q.value = 7;
      break;
    }
    case 'minor': {
      // más oscuro y triste
      nodes.sitarBandpass.frequency.value = 2800;
      nodes.sitarBandpass.Q.value = 5;

      nodes.sitarSympathetic.frequency.value = 5000;
      nodes.sitarSympathetic.Q.value = 6;
      break;
    }
    case 'exotic':
    default: {
      // loco / raro / re indio
      nodes.sitarBandpass.frequency.value = 4300;
      nodes.sitarBandpass.Q.value = 8;

      nodes.sitarSympathetic.frequency.value = 7200;
      nodes.sitarSympathetic.Q.value = 12;
      break;
    }
  }
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAudioEngine = () => {
  const ctx = useContext(AudioEngineContext);
  if (!ctx) throw new Error('useAudioEngine debe usarse dentro de AudioEngineProvider');
  return ctx;
};

type Props = {
  children: React.ReactNode;
};

export const AudioEngineProvider: React.FC<Props> = ({ children }) => {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [backingBuffer, setBackingBuffer] = useState<AudioBuffer | null>(null);
  const [backingName, setBackingName] = useState<string | null>(null);
  const [backingWaveform, setBackingWaveform] = useState<number[] | null>(null);

  const [isInputReady, setIsInputReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<string>('Esperando...');
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const [monitorEnabled, setMonitorEnabled] = useState<boolean>(false);

  // Parámetros del delay
  const [delayTimeMs, setDelayTimeMs] = useState(350);
  const [feedbackAmount, setFeedbackAmount] = useState(0.4);
  const [mixAmount, setMixAmount] = useState(0.6);

  // Controles de ampli
  const [ampGain, setAmpGain] = useState(1.0); // 1 = unity
  const [ampTone, setAmpTone] = useState(0.5); // 0..1
  const [ampMaster, setAmpMaster] = useState(1.0);

  // Delay bypass
  const [delayEnabled, setDelayEnabled] = useState(true);

  // Efecto sitar
  const [sitarAmount, setSitarAmount] = useState(0.0); // 0 = apagado
  const [sitarMode, setSitarMode] = useState<SitarMode>('exotic');

  // Distorsión
  const [driveAmount, setDriveAmount] = useState(0.6);
  const [driveEnabled, setDriveEnabled] = useState(false);

  // Reverb
  const [reverbAmount, setReverbAmount] = useState(0.4);

  const guitarStreamRef = useRef<MediaStream | null>(null);
  const guitarSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const backingSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recordingDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // para la animación del cursor
  const playbackStartTimeRef = useRef<number | null>(null);
  const progressAnimationRef = useRef<number | null>(null);
  const isPlayingBackingRef = useRef<boolean>(false);

  // Effect graph nodes (compartidos entre monitor + recording)
  const ampGainNodeRef = useRef<GainNode | null>(null);
  const toneFilterRef = useRef<BiquadFilterNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  const wetGainRef = useRef<GainNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const feedbackGainRef = useRef<GainNode | null>(null);

  const sitarDryRef = useRef<GainNode | null>(null);
  const sitarWetRef = useRef<GainNode | null>(null);
  const driveNodeRef = useRef<WaveShaperNode | null>(null);
  const sitarBandpassRef = useRef<BiquadFilterNode | null>(null);
  const sitarSympatheticRef = useRef<BiquadFilterNode | null>(null);

  const reverbWetRef = useRef<GainNode | null>(null);
  const reverbDryRef = useRef<GainNode | null>(null);
  const reverbImpulseRef = useRef<AudioBuffer | null>(null);

  const postFxGainRef = useRef<GainNode | null>(null);

  // Monitor + bus de grabación
  const monitorNodeRef = useRef<GainNode | null>(null);
  const recordGainRef = useRef<GainNode | null>(null);

  const getOrCreateAudioContext = useCallback(() => {
    if (audioContext) return audioContext;
    const ctx = new AudioContext();
    setAudioContext(ctx);
    return ctx;
  }, [audioContext]);

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

    // === AMP INPUT & DRIVE ===
    const ampGainNode = ctx.createGain();
    ampGainNode.gain.value = ampGain;
    ampGainNodeRef.current = ampGainNode;

    const driveNode = ctx.createWaveShaper();
    driveNode.curve = makeDriveCurve(driveEnabled ? driveAmount * 6 : 0);
    driveNode.oversample = '4x';
    driveNodeRef.current = driveNode;

    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = 'lowpass';
    const minFreq = 500;
    const maxFreq = 10000;
    toneFilter.frequency.value = minFreq + ampTone * (maxFreq - minFreq);
    toneFilterRef.current = toneFilter;

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

    applySitarMode(sitarMode, {
      sitarBandpass,
      sitarSympathetic,
    });

    const sitarDrive = ctx.createWaveShaper();
    sitarDrive.curve = makeDriveCurve(4.0);
    sitarDrive.oversample = '4x';

    const jawariDelay = ctx.createDelay(0.02);
    jawariDelay.delayTime.value = 0.003;

    const jawariFeedback = ctx.createGain();
    jawariFeedback.gain.value = 0.35;

    const sitarHighpass = ctx.createBiquadFilter();
    sitarHighpass.type = 'highpass';
    sitarHighpass.frequency.value = 1800;

    // === DELAY & MIX ===
    const preDelayGain = ctx.createGain();

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1 - mixAmount;

    const wetGain = ctx.createGain();
    wetGain.gain.value = delayEnabled ? mixAmount : 0;
    wetGainRef.current = wetGain;

    const delayNode = ctx.createDelay(2.0);
    delayNode.delayTime.value = delayTimeMs / 1000;
    delayNodeRef.current = delayNode;

    const feedbackGain = ctx.createGain();
    feedbackGain.gain.value = feedbackAmount;
    feedbackGainRef.current = feedbackGain;

    // === MASTER & REVERB ===
    const masterGain = ctx.createGain();
    masterGain.gain.value = ampMaster;
    masterGainRef.current = masterGain;

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

    // === CONNECTIONS ===
    // Guitar -> amp -> drive -> tone
    guitarSource.connect(ampGainNode);
    ampGainNode.connect(driveNode);
    driveNode.connect(toneFilter);

    // Sitar paths
    toneFilter.connect(sitarDryGain);

    toneFilter.connect(sitarBandpass);
    sitarBandpass.connect(sitarDrive);
    sitarDrive.connect(jawariDelay);
    jawariDelay.connect(jawariFeedback);
    jawariFeedback.connect(jawariDelay);
    jawariDelay.connect(sitarHighpass);
    sitarHighpass.connect(sitarWetGain);

    toneFilter.connect(sitarSympathetic);
    sitarSympathetic.connect(sitarWetGain);

    // Mix dry + sitar into preDelay
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

    // Reverb
    masterGain.connect(reverbDry);
    masterGain.connect(reverb);
    reverb.connect(reverbWet);

    reverbDry.connect(postFxGain);
    reverbWet.connect(postFxGain);

    // Monitor bus (to speakers controlled by monitorEnabled)
    if (!monitorNodeRef.current) {
      const monitorGain = ctx.createGain();
      monitorGain.gain.value = 2;
      monitorNodeRef.current = monitorGain;
    }

    postFxGain.connect(monitorNodeRef.current!);

    // Si el monitor ya estaba encendido, conectamos ahora al destino
    if (monitorEnabled) {
      try {
        monitorNodeRef.current!.connect(ctx.destination);
      } catch {
        // ignore si ya estaba conectado
      }
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

  // Calcula forma de onda liviana
  const computeWaveform = (buffer: AudioBuffer): number[] => {
    const channelData = buffer.getChannelData(0);
    const samples = 400;
    const blockSize = Math.max(1, Math.floor(channelData.length / samples));
    const waveform: number[] = [];

    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, channelData.length);
      let peak = 0;

      for (let j = start; j < end; j++) {
        const v = Math.abs(channelData[j]);
        if (v > peak) peak = v;
      }

      waveform.push(peak);
    }

    return waveform;
  };

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
  }, [audioContext]);

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
    }

    // Limpiamos conexiones previas hacia la salida de grabación
    try {
      postFxGain.disconnect(recordGainRef.current);
    } catch {
      // ignore
    }
    try {
      recordGainRef.current.disconnect(destNode);
    } catch {
      // ignore
    }

    postFxGain.connect(recordGainRef.current);
    recordGainRef.current.connect(destNode);

    // ==== BACKING TRACK (opcional) ====
    let backingSource: AudioBufferSourceNode | null = null;
    if (backingBuffer) {
      backingSource = ctx.createBufferSource();
      backingSource.buffer = backingBuffer;
      backingSourceRef.current = backingSource;

      const backingGain = ctx.createGain();
      backingGain.gain.value = 1.0;
      backingSource.connect(backingGain);
      backingGain.connect(ctx.destination);
    } else {
      backingSourceRef.current = null;
    }

    // Iniciamos la grabación
    recordedChunksRef.current = [];
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

    // Desconectar envío a la salida de grabación
    if (postFxGainRef.current && recordGainRef.current && recordingDestinationRef.current) {
      try {
        postFxGainRef.current.disconnect(recordGainRef.current);
      } catch {
        // ignore
      }
      try {
        recordGainRef.current.disconnect(recordingDestinationRef.current);
      } catch {
        // ignore
      }
    }

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
      stopProgressAnimation();
      guitarStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContext?.close();
    };
  }, [audioContext]);

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
    if (toneFilterRef.current) {
      const minFreq = 500;
      const maxFreq = 10000;
      const freq = minFreq + ampTone * (maxFreq - minFreq);
      toneFilterRef.current.frequency.setTargetAtTime(
        freq,
        audioContext.currentTime,
        0.01,
      );
    }
  }, [ampTone, audioContext]);

  useEffect(() => {
    if (!audioContext) return;
    if (masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(
        ampMaster,
        audioContext.currentTime,
        0.01,
      );
    }
  }, [ampMaster, audioContext]);

  // Monitor on/off
  useEffect(() => {
    if (!audioContext) return;
    if (!monitorNodeRef.current) return;
    const node = monitorNodeRef.current;

    if (monitorEnabled) {
      try {
        node.connect(audioContext.destination);
      } catch {
        // already connected
      }
    } else {
      try {
        node.disconnect(audioContext.destination);
      } catch {
        // ignore
      }
    }
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
      driveNodeRef.current.curve = makeDriveCurve(amount);
    }
  }, [driveAmount, driveEnabled, audioContext]);

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

  // Cambios de modo del sitar (en vivo)
  useEffect(() => {
    if (!audioContext) return;
    if (!sitarBandpassRef.current || !sitarSympatheticRef.current) return;

    applySitarMode(sitarMode, {
      sitarBandpass: sitarBandpassRef.current,
      sitarSympathetic: sitarSympatheticRef.current,
    });
  }, [sitarMode, audioContext]);

  const value: AudioEngineContextValue = {
    status,
    isInputReady,
    isRecording,
    hasBacking: !!backingBuffer,

    backingName,
    backingWaveform,
    playbackProgress,

    delayTimeMs,
    setDelayTimeMs,
    feedbackAmount,
    setFeedbackAmount,
    mixAmount,
    setMixAmount,

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
    sitarMode,
    setSitarMode,

    driveAmount,
    setDriveAmount,
    driveEnabled,
    setDriveEnabled,

    reverbAmount,
    setReverbAmount,

    monitorEnabled,
    setMonitorEnabled,

    setupGuitarInput,
    loadBackingFile,
    startPlaybackAndRecording,
    stopRecording,
  };

  return (
    <AudioEngineContext.Provider value={value}>
      {children}
    </AudioEngineContext.Provider>
  );
};
