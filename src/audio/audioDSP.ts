// src/audio/audioDSP.ts
import type { SitarMode } from './audioTypes';

// helper simple para saturación tipo drive
// amount esperado: 0..1
export function makeDriveCurve(
  mode: 'overdrive' | 'crunch' | 'distortion',
  amount: number,
) {
  const n = 2048;
  const curve = new Float32Array(n);

  const a = Math.max(0, Math.min(1, amount));

  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;

    const k =
      mode === 'overdrive' ? 2 + a * 8 :
      mode === 'crunch' ? 4 + a * 14 :
      8 + a * 30;

    let y = x;

    if (mode === 'overdrive') {
      // soft clip
      y = Math.tanh(k * x);
    } else if (mode === 'crunch') {
      // más mordida pero todavía musical
      y = (2 / Math.PI) * Math.atan(k * x);
    } else {
      // distortion: hard-ish clip
      const t = 0.6 - a * 0.35; // threshold
      const tt = Math.max(0.05, t);
      y = Math.max(-tt, Math.min(tt, x));
      y = y / tt; // normalize
    }

    curve[i] = y;
  }

  return curve;
}

// Ajusta la respuesta “india” según el modo elegido
export const applySitarMode = (
  mode: SitarMode,
  nodes: {
    sitarBandpass: BiquadFilterNode;
    sitarSympathetic: BiquadFilterNode;
    jawariDrive: WaveShaperNode;
    jawariHighpass: BiquadFilterNode;
  },
) => {
  const now = nodes.sitarBandpass.context.currentTime;
  const smooth = (p: AudioParam, v: number) => p.setTargetAtTime(v, now, 0.01);

  switch (mode) {
    case 'sharp': {
      smooth(nodes.sitarBandpass.frequency, 5200);
      smooth(nodes.sitarBandpass.Q, 18);

      smooth(nodes.sitarSympathetic.frequency, 8400);
      smooth(nodes.sitarSympathetic.Q, 26);

      smooth(nodes.jawariHighpass.frequency, 3400);

      // más agresivo/brillante
      nodes.jawariDrive.curve = makeDriveCurve('distortion', 0.75);
      break;
    }

    case 'major': {
      smooth(nodes.sitarBandpass.frequency, 2600);
      smooth(nodes.sitarBandpass.Q, 6);

      smooth(nodes.sitarSympathetic.frequency, 6100);
      smooth(nodes.sitarSympathetic.Q, 12);

      smooth(nodes.jawariHighpass.frequency, 2100);

      // más musical
      nodes.jawariDrive.curve = makeDriveCurve('crunch', 0.40);
      break;
    }

    case 'minor': {
      smooth(nodes.sitarBandpass.frequency, 1850);
      smooth(nodes.sitarBandpass.Q, 12);

      smooth(nodes.sitarSympathetic.frequency, 4300);
      smooth(nodes.sitarSympathetic.Q, 18);

      smooth(nodes.jawariHighpass.frequency, 1500);

      nodes.jawariDrive.curve = makeDriveCurve('crunch', 0.50);
      break;
    }

    case 'exotic':
    default: {
      smooth(nodes.sitarBandpass.frequency, 3600);
      smooth(nodes.sitarBandpass.Q, 24);

      smooth(nodes.sitarSympathetic.frequency, 9200);
      smooth(nodes.sitarSympathetic.Q, 30);

      smooth(nodes.jawariHighpass.frequency, 3800);

      nodes.jawariDrive.curve = makeDriveCurve('distortion', 0.90);
      break;
    }
  }
};

// Calcula forma de onda liviana para el backing
export const computeWaveform = (buffer: AudioBuffer): number[] => {
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
