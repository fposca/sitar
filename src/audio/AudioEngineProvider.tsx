// src/audio/AudioEngineProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { AudioEngineContextValue, SitarMode } from './audioTypes';
import { applySitarMode, makeDriveCurve, computeWaveform } from './audioDSP';

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

  // Tonestack
  const [bassAmount, setBassAmount] = useState(0.5); // 0..1
  const [midAmount, setMidAmount] = useState(0.5); // 0..1
  const [trebleAmount, setTrebleAmount] = useState(0.5); // 0..1
  const [presenceAmount, setPresenceAmount] = useState(0.5); // 0..1

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

  // Tiempo de grabación
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingStartTimeRef = useRef<number | null>(null);
  const recordingTimerIdRef = useRef<number | null>(null);

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

  // Nodos principales del grafo
  const ampGainNodeRef = useRef<GainNode | null>(null);
  const toneFilterRef = useRef<BiquadFilterNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

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
    driveNode.curve = makeDriveCurve(driveEnabled ? driveAmount * 6 : 0);
    driveNode.oversample = '4x';
    driveNodeRef.current = driveNode;

    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = 'lowpass';
    const minFreq = 200;
    const maxFreq = 16000;
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

    const jawariDrive = ctx.createWaveShaper();
    jawariDrive.curve = makeDriveCurve(4.0);
    jawariDrive.oversample = '4x';
    jawariDriveRef.current = jawariDrive;

    const jawariDelay = ctx.createDelay(0.02);
    jawariDelay.delayTime.value = 0.0015;

    const jawariFeedback = ctx.createGain();
    jawariFeedback.gain.value = 0.35;

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

    // === MASTER & REVERB ===
    const masterGain = ctx.createGain();
    // un poco más agresivo para que el master se sienta
    masterGain.gain.value = ampMaster * 3.0;
    masterGainRef.current = masterGain;

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

    // === CONNECTIONS ===
    // Input -> tonestack -> amp -> drive -> tone
    monoGain.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(ampGainNode);

    ampGainNode.connect(driveNode);
    driveNode.connect(toneFilter);

    // Sitar paths
    toneFilter.connect(sitarDryGain);

    toneFilter.connect(sitarBandpass);
    sitarBandpass.connect(jawariDrive);
    jawariDrive.connect(jawariDelay);
    jawariDelay.connect(jawariFeedback);
    jawariFeedback.connect(jawariDelay);
    jawariDelay.connect(jawariHighpass);
    jawariHighpass.connect(sitarWetGain);

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
    postFxGain.connect(monitorGain);
    monitorGain.connect(ctx.destination);

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
      backingGain.gain.value = 1.0;
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
      stopProgressAnimation();
      if (recordingTimerIdRef.current != null) {
        clearInterval(recordingTimerIdRef.current);
      }
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

    bassAmount,
    setBassAmount,
    midAmount,
    setMidAmount,
    trebleAmount,
    setTrebleAmount,
    presenceAmount,
    setPresenceAmount,

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
    recordingSeconds,
  };

  return (
    <AudioEngineContext.Provider value={value}>
      {children}
    </AudioEngineContext.Provider>
  );
};
