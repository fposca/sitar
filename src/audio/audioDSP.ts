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
  // Helper: evita clicks al cambiar de modo (si lo llamás en vivo)
  const now = nodes.sitarBandpass.context.currentTime;
  const smooth = (p: AudioParam, v: number) => p.setTargetAtTime(v, now, 0.01);

  switch (mode) {
    case 'sharp': {
      // Ultra brillante, “eléctrico”, jawari mordiente
      smooth(nodes.sitarBandpass.frequency, 5200);
      smooth(nodes.sitarBandpass.Q, 18);

      smooth(nodes.sitarSympathetic.frequency, 8400);
      smooth(nodes.sitarSympathetic.Q, 26);

      smooth(nodes.jawariHighpass.frequency, 3400);
      nodes.jawariDrive.curve = makeDriveCurve(9.0);
      break;
    }

    case 'major': {
      // Abierto/acústico: menos nasal, más “cuerpo” y menos chicharra
      smooth(nodes.sitarBandpass.frequency, 2600);
      smooth(nodes.sitarBandpass.Q, 6);

      smooth(nodes.sitarSympathetic.frequency, 6100);
      smooth(nodes.sitarSympathetic.Q, 12);

      smooth(nodes.jawariHighpass.frequency, 2100);
      nodes.jawariDrive.curve = makeDriveCurve(5.5);
      break;
    }

    case 'minor': {
      // Oscuro/quejoso: resonancia más baja y más “nasal”
      smooth(nodes.sitarBandpass.frequency, 1850);
      smooth(nodes.sitarBandpass.Q, 12);

      smooth(nodes.sitarSympathetic.frequency, 4300);
      smooth(nodes.sitarSympathetic.Q, 18);

      smooth(nodes.jawariHighpass.frequency, 1500);
      nodes.jawariDrive.curve = makeDriveCurve(6.5);
      break;
    }

    case 'exotic':
    default: {
      // Muy India profunda: súper resonante + chispa fuerte arriba
      smooth(nodes.sitarBandpass.frequency, 3600);
      smooth(nodes.sitarBandpass.Q, 24);

      smooth(nodes.sitarSympathetic.frequency, 9200);
      smooth(nodes.sitarSympathetic.Q, 30);

      smooth(nodes.jawariHighpass.frequency, 3800);
      nodes.jawariDrive.curve = makeDriveCurve(11.0);
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
