import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAudioEngine } from '../audio/AudioEngineProvider';
import LiveBarsWaveform from './LiveBarsWaveform';

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${pad2(m)}:${pad2(s)}`;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const RecordingPanel: React.FC = () => {
  const {
    isRecording,
    startPlaybackAndRecording,
    stopRecording,
    recordingSeconds,
    getAnalyserNode,

    // punch
    armPunchIn,
    disarmPunchIn,
    isPunchArmed,

    // takes
    takes,
    activeTakeId,
    setActiveTakeId,
  } = useAudioEngine();

  // Accordion state
  const [open, setOpen] = useState(false);

  // Audio player (take base)
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [blinkOn, setBlinkOn] = useState(true);

  // Cursor en segundos (lo mueve el user)
  const [cursorSec, setCursorSec] = useState(0);

  // Scrub: cuando movés el slider, también salta el audio a ese punto
  const [scrubEnabled, setScrubEnabled] = useState(true);

  // Loop corto para practicar el punch alrededor del cursor
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopMs, setLoopMs] = useState(1200); // ventana total (ms). Ej 1200 => +/- 0.6s

  const activeTake = useMemo(() => {
    return (takes ?? []).find((t) => t.id === activeTakeId) ?? null;
  }, [takes, activeTakeId]);

  const takeDuration = activeTake?.durationSec ?? 0;

  const recLabel = formatTime(recordingSeconds);
  const cursorLabel = formatTime(cursorSec);

  // Auto-open cuando empieza a grabar
  useEffect(() => {
    if (isRecording) setOpen(true);
  }, [isRecording]);

  // blink REC
  useEffect(() => {
    if (!isRecording) {
      setBlinkOn(true);
      return;
    }
    const id = window.setInterval(() => setBlinkOn((p) => !p), 500);
    return () => clearInterval(id);
  }, [isRecording]);

  // Si cambia el take activo, ajusto cursor dentro del rango + reseteo audio
  useEffect(() => {
    setCursorSec((prev) => clamp(prev, 0, takeDuration || 0));
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [activeTakeId, takeDuration]);

  // Si scrub está on, al mover cursor también salto el audio
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!scrubEnabled) return;
    if (!activeTake) return;

    const next = clamp(cursorSec, 0, takeDuration || 0);
    // Evitar micro-loops por flotar
    if (Math.abs((el.currentTime || 0) - next) > 0.02) {
      el.currentTime = next;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorSec, scrubEnabled, activeTakeId]);

  // Sync cursor cuando el audio avanza (si el user no está scrubbeando)
  // Acá: siempre actualizamos el cursor mientras está reproduciendo,
  // pero solo si scrub está ON (para que lo veas correr).
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => {
      if (!scrubEnabled) return;
      const t = clamp(el.currentTime || 0, 0, takeDuration || 0);
      setCursorSec(t);
    };

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('seeked', onTime);
    el.addEventListener('loadedmetadata', onTime);

    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('seeked', onTime);
      el.removeEventListener('loadedmetadata', onTime);
    };
  }, [scrubEnabled, takeDuration]);

  // Loop corto alrededor del cursor (para practicar)
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!activeTake) return;
    if (!loopEnabled) return;
    if (isRecording) return; // no loop mientras grabás
    if (takeDuration <= 0) return;

    const half = loopMs / 1000 / 2;
    const loopStart = clamp(cursorSec - half, 0, takeDuration);
    const loopEnd = clamp(cursorSec + half, 0, takeDuration);

    // si la ventana queda muy chica, no hacemos nada
    if (loopEnd - loopStart < 0.05) return;

    // Asegura que arranque cerca del start del loop
    if (el.currentTime < loopStart || el.currentTime > loopEnd) {
      el.currentTime = loopStart;
    }

    const tick = window.setInterval(() => {
      const t = el.currentTime || 0;
      if (t >= loopEnd) {
        el.currentTime = loopStart;
        // si estaba pausado, no forzamos play
      }
    }, 30);

    return () => window.clearInterval(tick);
  }, [loopEnabled, loopMs, cursorSec, isRecording, activeTakeId, takeDuration]);

  const handleArmPunch = () => {
    // Punch EXACTO donde dejó el cursor el user
    armPunchIn(cursorSec);
  };

  const handlePunchNow = () => {
    const el = audioRef.current;
    if (!el || !activeTake || isRecording) return;

    const now = clamp(el.currentTime || 0, 0, takeDuration || 0);
    setCursorSec(now);
    armPunchIn(now);
  };

  const handleCursorNowOnly = () => {
    const el = audioRef.current;
    if (!el || !activeTake || isRecording) return;

    const now = clamp(el.currentTime || 0, 0, takeDuration || 0);
    setCursorSec(now);
  };

  const handleNudge = (deltaMs: number) => {
    if (!activeTake || isRecording) return;
    const next = clamp(cursorSec + deltaMs / 1000, 0, takeDuration || 0);
    setCursorSec(next);
  };

  return (
    <section
      style={{
        border: '1px solid rgba(148,163,184,0.25)',
        borderRadius: 14,
        background: '#0b1020',
        overflow: 'hidden',
        width: '100%',
        maxWidth: 600,
      }}
    >
      {/* Header accordion */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '0.9rem 1.1rem',
          background: 'rgba(2,6,23,0.35)',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
        }}
        aria-expanded={open}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>Grabación</span>
          <span style={{ fontFamily: 'monospace', fontSize: 12, opacity: 0.75 }}>
            {isRecording
              ? `REC ${recLabel}`
              : activeTake
              ? `Take: ${activeTake.name ?? '—'} · Cursor ${cursorLabel}`
              : 'Sin take seleccionado'}
          </span>
        </div>

        <span style={{ fontFamily: 'monospace', opacity: 0.85 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Body accordion */}
      <div
        style={{
          maxHeight: open ? 1400 : 0,
          transition: 'max-height 260ms ease',
        }}
      >
        <div style={{ padding: '1rem 1.5rem' }}>
          {/* Take selector + cursor info */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', opacity: 0.9 }}>Take base:</span>

              <select
                value={activeTakeId ?? ''}
                onChange={(e) => setActiveTakeId(e.target.value || null)}
                disabled={isRecording}
                style={{
                  background: 'rgba(2,6,23,0.8)',
                  color: '#fff',
                  border: '1px solid rgba(148,163,184,0.35)',
                  borderRadius: 10,
                  padding: '0.35rem 0.6rem',
                  minWidth: 220,
                  opacity: isRecording ? 0.6 : 1,
                  cursor: isRecording ? 'not-allowed' : 'pointer',
                }}
              >
                <option value="">(sin selección)</option>
                {(takes ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name ?? `Take ${t.id}`}
                  </option>
                ))}
              </select>

              <span style={{ fontFamily: 'monospace', opacity: 0.8 }}>
                Cursor: {cursorLabel}
                {activeTake ? ` / ${formatTime(takeDuration)}` : ''}
              </span>
            </div>

            {/* Player */}
            {activeTake ? (
              <audio
                ref={audioRef}
                src={activeTake.url}
                controls
                style={{ width: '100%', marginTop: 6 }}
              />
            ) : null}

            {/* Cursor panel */}
            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(148,163,184,0.2)',
                background: 'rgba(2,6,23,0.55)',
                opacity: activeTake ? 1 : 0.6,
              }}
            >
              {/* Slider */}
              <input
                type="range"
                min={0}
                max={takeDuration || 0}
                step={0.001} // 1ms aprox
                value={clamp(cursorSec, 0, takeDuration || 0)}
                onChange={(e) => setCursorSec(Number(e.target.value))}
                disabled={!activeTake || takeDuration <= 0 || isRecording}
                style={{ width: '100%' }}
              />

              {/* Ticks: cursor con ms + total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, opacity: 0.8 }}>
                  00:00.000
                </span>

                <span style={{ fontFamily: 'monospace', fontSize: 12, opacity: 0.95 }}>
                  {activeTake ? `${cursorSec.toFixed(3)}s` : '--'}
                </span>

                <span style={{ fontFamily: 'monospace', fontSize: 12, opacity: 0.8 }}>
                  {activeTake ? `${formatTime(takeDuration)}.000` : '--:--.---'}
                </span>
              </div>

              {/* Nudge buttons (milisegundos) */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {[
                  { label: '-500ms', v: -500 },
                  { label: '-100ms', v: -100 },
                  { label: '-10ms', v: -10 },
                  { label: '+10ms', v: 10 },
                  { label: '+100ms', v: 100 },
                  { label: '+500ms', v: 500 },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => handleNudge(b.v)}
                    disabled={!activeTake || isRecording}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: 999,
                      border: '1px solid rgba(148,163,184,0.35)',
                      background: 'rgba(2,6,23,0.6)',
                      color: '#fff',
                      cursor: !activeTake || isRecording ? 'not-allowed' : 'pointer',
                      opacity: !activeTake || isRecording ? 0.5 : 1,
                      fontFamily: 'monospace',
                      fontSize: 12,
                    }}
                    title="Ajuste fino del cursor"
                  >
                    {b.label}
                  </button>
                ))}

                <div style={{ flex: 1 }} />

                {/* Scrub toggle */}
                <button
                  type="button"
                  onClick={() => setScrubEnabled((v) => !v)}
                  disabled={!activeTake || isRecording}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 999,
                    border: '1px solid rgba(239,68,68,0.35)',
                    background: scrubEnabled ? 'rgba(239,68,68,0.18)' : 'rgba(2,6,23,0.6)',
                    color: '#fff',
                    cursor: !activeTake || isRecording ? 'not-allowed' : 'pointer',
                    opacity: !activeTake || isRecording ? 0.5 : 1,
                    fontWeight: 700,
                    fontSize: 12,
                    fontFamily: 'monospace',
                  }}
                  title="Si está ON, mover el cursor mueve el audio (como scrub)"
                >
                  Scrub: {scrubEnabled ? 'ON' : 'OFF'}
                </button>

                {/* Loop toggle */}
                <button
                  type="button"
                  onClick={() => setLoopEnabled((v) => !v)}
                  disabled={!activeTake || isRecording}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 999,
                    border: '1px solid rgba(148,163,184,0.35)',
                    background: loopEnabled ? 'rgba(148,163,184,0.18)' : 'rgba(2,6,23,0.6)',
                    color: '#fff',
                    cursor: !activeTake || isRecording ? 'not-allowed' : 'pointer',
                    opacity: !activeTake || isRecording ? 0.5 : 1,
                    fontWeight: 700,
                    fontSize: 12,
                    fontFamily: 'monospace',
                  }}
                  title="Loop corto alrededor del cursor para practicar"
                >
                  Loop: {loopEnabled ? 'ON' : 'OFF'}
                </button>

                {/* Loop size */}
                <select
                  value={loopMs}
                  onChange={(e) => setLoopMs(Number(e.target.value))}
                  disabled={!loopEnabled || !activeTake || isRecording}
                  style={{
                    background: 'rgba(2,6,23,0.8)',
                    color: '#fff',
                    border: '1px solid rgba(148,163,184,0.35)',
                    borderRadius: 10,
                    padding: '0.25rem 0.5rem',
                    opacity: !loopEnabled || !activeTake || isRecording ? 0.6 : 1,
                    cursor: !loopEnabled || !activeTake || isRecording ? 'not-allowed' : 'pointer',
                    fontFamily: 'monospace',
                    fontSize: 12,
                  }}
                  title="Tamaño del loop"
                >
                  <option value={800}>0.8s</option>
                  <option value={1200}>1.2s</option>
                  <option value={2000}>2.0s</option>
                  <option value={3000}>3.0s</option>
                </select>
              </div>

              {!activeTake && (
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
                  No hay take seleccionado. Grabá una toma (REC + Stop) para que aparezca acá.
                </div>
              )}
            </div>
          </div>

          {/* Punch controls */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleArmPunch}
              disabled={!activeTake || isRecording}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 999,
                border: '1px solid rgba(239,68,68,0.45)',
                background: !activeTake || isRecording ? 'rgba(148,163,184,0.08)' : 'rgba(239,68,68,0.15)',
                color: '#fff',
                cursor: !activeTake || isRecording ? 'not-allowed' : 'pointer',
                opacity: !activeTake || isRecording ? 0.5 : 1,
                fontWeight: 700,
              }}
              title={
                !activeTake
                  ? 'Seleccioná un take base para armar punch'
                  : isRecording
                  ? 'No podés armar punch mientras estás grabando'
                  : 'Arma el punch en el cursor'
              }
            >
              Punch In (cursor)
            </button>

            <button
              type="button"
              onClick={handlePunchNow}
              disabled={!activeTake || isRecording}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 999,
                border: '1px solid rgba(239,68,68,0.45)',
                background: !activeTake || isRecording ? 'rgba(148,163,184,0.08)' : 'rgba(239,68,68,0.15)',
                color: '#fff',
                cursor: !activeTake || isRecording ? 'not-allowed' : 'pointer',
                opacity: !activeTake || isRecording ? 0.5 : 1,
                fontWeight: 700,
              }}
              title="Arma punch exactamente donde está sonando el take"
            >
              Punch = ahora
            </button>

            <button
              type="button"
              onClick={handleCursorNowOnly}
              disabled={!activeTake || isRecording}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.35)',
                background: 'rgba(2,6,23,0.6)',
                color: '#fff',
                cursor: !activeTake || isRecording ? 'not-allowed' : 'pointer',
                opacity: !activeTake || isRecording ? 0.5 : 1,
                fontWeight: 600,
              }}
              title="Mueve el cursor a donde está sonando (sin armar punch)"
            >
              Cursor = ahora
            </button>

            <button
              type="button"
              onClick={disarmPunchIn}
              disabled={!isPunchArmed}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.35)',
                background: 'transparent',
                color: '#fff',
                cursor: !isPunchArmed ? 'not-allowed' : 'pointer',
                opacity: !isPunchArmed ? 0.5 : 1,
                fontWeight: 600,
              }}
            >
              Cancelar
            </button>

            <span style={{ fontFamily: 'monospace', opacity: 0.85 }}>
              {isPunchArmed ? `Punch armado en ${cursorLabel} (${cursorSec.toFixed(3)}s)` : 'Punch apagado'}
            </span>
          </div>

          {/* Barra de estado REC */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.75rem',
              minHeight: '24px',
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                opacity: isRecording ? (blinkOn ? 1 : 0.25) : 0,
                transition: 'opacity 0.2s',
              }}
            />
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.95rem',
                color: isRecording ? '#f97373' : '#888',
                letterSpacing: 1,
              }}
            >
              {isRecording ? `REC ${recLabel}` : 'REC 00:00'}
            </span>
          </div>

          {/* waveform live (input) */}
          <div
            style={{
              marginBottom: '0.9rem',
              height: 48,
              borderRadius: 10,
              background: 'rgba(2,6,23,0.8)',
              border: '1px solid rgba(239,68,68,0.35)',
              boxShadow: isRecording ? '0 0 18px rgba(239,68,68,0.35)' : 'none',
              display: 'flex',
              alignItems: 'center',
              padding: '0 10px',
              overflow: 'hidden',
            }}
          >
            <LiveBarsWaveform
              analyser={getAnalyserNode()}
              enabled={isRecording}
              height={36}
              bars={44}
              glow={12}
              color="#ef4444"
            />
          </div>

          {/* REC/STOP */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="button"
              onClick={startPlaybackAndRecording}
              disabled={isRecording}
              style={{
                padding: '0.6rem 1.6rem',
                borderRadius: '999px',
                border: 'none',
                cursor: isRecording ? 'not-allowed' : 'pointer',
                background: isRecording ? '#7f1d1d' : '#ef4444',
                color: '#fff',
                fontWeight: 700,
                letterSpacing: 1,
                boxShadow: isRecording ? '0 0 0 0' : '0 0 10px rgba(239,68,68,0.5)',
                opacity: isRecording ? 0.6 : 1,
              }}
              title="Graba (y si hay punch armado, mezcla en ese punto)"
            >
              ● REC
            </button>

            <button
              type="button"
              onClick={stopRecording}
              disabled={!isRecording}
              style={{
                padding: '0.6rem 1.6rem',
                borderRadius: '999px',
                border: '1px solid #999',
                cursor: !isRecording ? 'not-allowed' : 'pointer',
                background: 'transparent',
                color: '#fff',
                fontWeight: 600,
              }}
            >
              ⏹ Stop
            </button>
          </div>

          <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', opacity: 0.8 }}>
            Al parar, se descarga automáticamente <strong>neon-raga-take.wav</strong>.
          </p>
        </div>
      </div>
    </section>
  );
};

export default RecordingPanel;
