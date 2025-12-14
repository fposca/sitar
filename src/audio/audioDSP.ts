// src/audio/audioDSP.ts
import type { SitarMode } from './audioTypes';

// helper simple para saturación tipo drive
export const makeDriveCurve = (amount: number) => {
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
export const applySitarMode = (
  mode: SitarMode,
  nodes: {
    sitarBandpass: BiquadFilterNode;
    sitarSympathetic: BiquadFilterNode;
    jawariDrive: WaveShaperNode;
    jawariHighpass: BiquadFilterNode;
  },
) => {
  switch (mode) {
    case 'sharp': {
      // cuasi eléctrico, ultra brillante
      nodes.sitarBandpass.frequency.value = 5000;
      nodes.sitarBandpass.Q.value = 10;

      nodes.sitarSympathetic.frequency.value = 7800;
      nodes.sitarSympathetic.Q.value = 18;

      nodes.jawariHighpass.frequency.value = 2600;
      nodes.jawariDrive.curve = makeDriveCurve(5.0);
      break;
    }
    case 'major': {
      // abierto, acústico, menos nasal
      nodes.sitarBandpass.frequency.value = 3200;
      nodes.sitarBandpass.Q.value = 4;

      nodes.sitarSympathetic.frequency.value = 5200;
      nodes.sitarSympathetic.Q.value = 6;

      nodes.jawariHighpass.frequency.value = 1800;
      nodes.jawariDrive.curve = makeDriveCurve(3.2);
      break;
    }
    case 'minor': {
      // oscuro, fúnebre, rollo “lamento indio”
      nodes.sitarBandpass.frequency.value = 2400;
      nodes.sitarBandpass.Q.value = 7;

      nodes.sitarSympathetic.frequency.value = 4000;
      nodes.sitarSympathetic.Q.value = 10;

      nodes.jawariHighpass.frequency.value = 900;
      nodes.jawariDrive.curve = makeDriveCurve(2.5);
      break;
    }
    case 'exotic':
    default: {
      // loco, exagerado, muy “India profunda”
      nodes.sitarBandpass.frequency.value = 4200;
      nodes.sitarBandpass.Q.value = 14;

      nodes.sitarSympathetic.frequency.value = 9500;
      nodes.sitarSympathetic.Q.value = 20;

      nodes.jawariHighpass.frequency.value = 3000;
      nodes.jawariDrive.curve = makeDriveCurve(7.0);
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
