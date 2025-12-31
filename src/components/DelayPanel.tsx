import React from "react";
import { useAudioEngine } from "../audio/AudioEngineProvider";

const subdivisions = [
  { label: "1/1", mult: 1 },
  { label: "1/2", mult: 1 / 2 },
  { label: "1/4", mult: 1 / 4 },
  { label: "1/8", mult: 1 / 8 },
  { label: "1/8 •", mult: 3 / 16 }, // dotted 1/8
  { label: "1/8T", mult: 1 / 12 },  // triplet 1/8
  { label: "1/16", mult: 1 / 16 },
  { label: "1/16 •", mult: 3 / 32 },
  { label: "1/16T", mult: 1 / 24 },
];

function msFromBpm(bpm: number, mult: number) {
  const safeBpm = Math.max(1, bpm);
  const beatMs = (60_000 / safeBpm); // negra
  return Math.round(beatMs / mult);  // ojo: mult es fracción de compás; ajustamos abajo
}

const DelayPanel: React.FC = () => {
  const {
    // existentes
    delayTimeMs,
    setDelayTimeMs,
    feedbackAmount,
    setFeedbackAmount,
    mixAmount,
    setMixAmount,
    delayEnabled,
    setDelayEnabled,

    // NUEVOS (agregalos al context)
    bpm,
    delaySync,
    setDelaySync,
    delaySubdivision,
    setDelaySubdivision,

    delayHPHz,
    setDelayHPHz,
    delayLPHz,
    setDelayLPHz,

    delayDuckEnabled,
    setDelayDuckEnabled,
    delayDuckAmount,
    setDelayDuckAmount,
    delayDuckThreshold,
    setDelayDuckThreshold,
  } = useAudioEngine() as any;

  const onChangeSubdivision = (val: string) => {
    setDelaySubdivision(val);

    // si está en sync, recalculamos el delayTimeMs
    if (delaySync) {
      const sub = subdivisions.find(s => s.label === val) ?? subdivisions[3];
      // negra = 1/4. Para que sea intuitivo:
      // 1/4 => 60000/bpm
      // 1/8 => 30000/bpm, etc.
      const quarterMs = 60_000 / Math.max(1, bpm);
      const factor =
        val === "1/1" ? 4 :
        val === "1/2" ? 2 :
        val === "1/4" ? 1 :
        val === "1/8" ? 0.5 :
        val === "1/16" ? 0.25 :
        val === "1/8 •" ? 0.75 :
        val === "1/16 •" ? 0.375 :
        val === "1/8T" ? 1/3 :
        val === "1/16T" ? 1/6 :
        1;

      setDelayTimeMs(Math.round(quarterMs * factor));
    }
  };

  const disabledStyle = delayEnabled ? {} : { opacity: 0.6 };

  return (
    <section
      style={{
        border: "1px solid #333",
        borderRadius: "12px",
        padding: "1rem 1.5rem",
        maxWidth: "600px",
        width: "100%",
        background: "#0b1020",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>3. Delay</h2>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.9rem" }}>
          <input
            type="checkbox"
            checked={!!delayEnabled}
            onChange={(e) => setDelayEnabled(e.target.checked)}
          />
          Enabled
        </label>
      </div>

      {/* Sync row */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, ...disabledStyle }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.9rem" }}>
          <input
            type="checkbox"
            checked={!!delaySync}
            onChange={(e) => setDelaySync(e.target.checked)}
            disabled={!delayEnabled}
          />
          Sync to BPM
        </label>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>Subdivision</span>
          <select
            value={delaySubdivision ?? "1/8"}
            onChange={(e) => onChangeSubdivision(e.target.value)}
            disabled={!delayEnabled || !delaySync}
            style={{
              background: "#0f1730",
              color: "white",
              border: "1px solid #333",
              borderRadius: 8,
              padding: "6px 8px",
            }}
          >
            {subdivisions.map((s) => (
              <option key={s.label} value={s.label}>{s.label}</option>
            ))}
          </select>

          <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>
            {delayTimeMs} ms
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", ...disabledStyle }}>
        {/* TIME */}
        <label style={{ fontSize: "0.9rem" }}>
          Delay time: {delayTimeMs} ms
          <input
            type="range"
            min={50}
            max={1000}
            value={delayTimeMs}
            onChange={(e) => setDelayTimeMs(Number(e.target.value))}
            style={{ width: "100%" }}
            disabled={!delayEnabled || !!delaySync}
          />
          <div style={{ fontSize: "0.78rem", opacity: 0.8 }}>
            {delaySync ? "Time locked by Sync" : "Free time"}
          </div>
        </label>

        {/* FEEDBACK */}
        <label style={{ fontSize: "0.9rem" }}>
          Feedback: {Number(feedbackAmount).toFixed(2)}
          <input
            type="range"
            min={0}
            max={0.9}
            step={0.01}
            value={feedbackAmount}
            onChange={(e) => setFeedbackAmount(Number(e.target.value))}
            style={{ width: "100%" }}
            disabled={!delayEnabled}
          />
        </label>

        {/* MIX */}
        <label style={{ fontSize: "0.9rem" }}>
          Mix (wet): {Number(mixAmount).toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={mixAmount}
            onChange={(e) => setMixAmount(Number(e.target.value))}
            style={{ width: "100%" }}
            disabled={!delayEnabled}
          />
        </label>

        {/* TONE (filters in feedback loop or wet path) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ fontSize: "0.9rem" }}>
            High-pass (cuts low): {Math.round(delayHPHz)} Hz
            <input
              type="range"
              min={20}
              max={600}
              step={5}
              value={delayHPHz ?? 120}
              onChange={(e) => setDelayHPHz(Number(e.target.value))}
              style={{ width: "100%" }}
              disabled={!delayEnabled}
            />
          </label>

          <label style={{ fontSize: "0.9rem" }}>
            Low-pass (cuts high): {Math.round(delayLPHz)} Hz
            <input
              type="range"
              min={800}
              max={12000}
              step={50}
              value={delayLPHz ?? 6000}
              onChange={(e) => setDelayLPHz(Number(e.target.value))}
              style={{ width: "100%" }}
              disabled={!delayEnabled}
            />
          </label>
        </div>

        {/* DUCK */}
        <div style={{ borderTop: "1px solid #222", paddingTop: 12 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={!!delayDuckEnabled}
              onChange={(e) => setDelayDuckEnabled(e.target.checked)}
              disabled={!delayEnabled}
            />
            Ducking (reduce delay while playing)
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10, opacity: delayDuckEnabled ? 1 : 0.6 }}>
            <label style={{ fontSize: "0.9rem" }}>
              Duck amount: {Number(delayDuckAmount ?? 0.6).toFixed(2)}
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={delayDuckAmount ?? 0.6}
                onChange={(e) => setDelayDuckAmount(Number(e.target.value))}
                style={{ width: "100%" }}
                disabled={!delayEnabled || !delayDuckEnabled}
              />
            </label>

            <label style={{ fontSize: "0.9rem" }}>
              Threshold: {Math.round(delayDuckThreshold ?? -28)} dB
              <input
                type="range"
                min={-60}
                max={-10}
                step={1}
                value={delayDuckThreshold ?? -28}
                onChange={(e) => setDelayDuckThreshold(Number(e.target.value))}
                style={{ width: "100%" }}
                disabled={!delayEnabled || !delayDuckEnabled}
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DelayPanel;
