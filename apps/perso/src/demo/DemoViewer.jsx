// Démonstration 3D d'un exercice (13/11/2026), ouverte depuis le carnet par « Voir le geste ».
// Par-dessus l'écran courant, fermée par la croix (comme la conversation de Jeffrey). Le dessin
// (scene.js et three.js) n'est chargé qu'ici, à l'ouverture.
import { useEffect, useRef, useState } from "react";
import { X, Play, Pause } from "lucide-react";
import { T } from "../design/tokens.js";
import { IconButton, Chip, Eyebrow } from "../design/primitives.jsx";
import { DEMOS } from "./demos.js";
import { mirrorDemo } from "./timeline.js";
import { sayStable } from "../lib/jeffrey.js";

const VIEW_LABELS = [["face", "Face"], ["profilG", "Profil gauche"], ["profilD", "Profil droit"], ["dos", "Dos"], ["dessus", "Dessus"]];
const SIDE_LABEL = { L: "Gauche", R: "Droit" };
const other = (s) => (s === "L" ? "R" : "L");

export function DemoViewer({ nom, consigne, alerte, onClose }) {
  const base = DEMOS[nom];
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [side, setSide] = useState(base?.side || "L");
  const [view, setView] = useState(base?.view || "profilG");
  const [tick, setTick] = useState({ t: 0, total: 1, cue: base?.frames[0].cue || "" });

  const demoFor = (s) => (base.sides && s !== (base.side || "L") ? mirrorDemo(base) : base);

  useEffect(() => {
    if (!base) return undefined;
    let dead = false, ro = null;
    import("./scene.js").then(({ createDemoScene }) => {
      if (dead || !canvasRef.current) return;
      const sc = createDemoScene(canvasRef.current, { onTick: (x) => setTick(x) });
      sceneRef.current = sc;
      sc.setDemo(demoFor(side));
      ro = new ResizeObserver(() => sc.resize());
      ro.observe(canvasRef.current);
      setState("ready");
    }).catch(() => { if (!dead) setState("error"); });
    return () => { dead = true; ro?.disconnect(); sceneRef.current?.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nom]);

  if (!base) return null;
  const sc = sceneRef.current;
  const togglePlay = () => { const on = !playing; setPlaying(on); sc?.setPlaying(on); };
  const pickSpeed = (x) => { setSpeed(x); sc?.setSpeed(x); };
  const pickSide = (s) => { setSide(s); sc?.setDemo(demoFor(s), { keepView: true }); sc?.setPlaying(playing); };
  const pickView = (v) => { setView(v); sc?.setView(v); };
  const seek = (v) => { if (playing) { setPlaying(false); sc?.setPlaying(false); } sc?.seek(v); };

  return (
    <div role="dialog" aria-modal="true" aria-label={`Démonstration : ${nom}`} style={{
      position: "fixed", inset: 0, zIndex: 70, background: T.c.bg, display: "flex", flexDirection: "column",
      paddingTop: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))",
      paddingBottom: "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px 8px 16px", borderBottom: `1px solid ${T.c.lineSoft}` }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: T.c.text, fontFamily: T.f.body, lineHeight: 1.25, minWidth: 0 }}>{nom}</span>
        <IconButton label="Fermer la démonstration" onClick={onClose}><X size={22} aria-hidden="true" /></IconButton>
      </div>

      <div style={{ position: "relative", flex: "0 0 auto", height: "min(100vw, 46vh)", minHeight: 240, borderBottom: `1px solid ${T.c.lineSoft}` }}>
        <canvas ref={canvasRef} aria-label={`Mannequin en 3D : ${nom}. Faire glisser pour tourner, pincer pour zoomer.`}
          style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
        {state !== "ready" && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, textAlign: "center", color: T.c.text2, fontSize: 15 }}>
            {state === "loading" ? sayStable("demoLoading") : sayStable("demoDown")}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px 24px", display: "grid", gap: 14, alignContent: "start", gridTemplateColumns: "minmax(0, 1fr)", gridAutoRows: "max-content" }}>
        <div aria-live="polite" style={{ fontSize: 16, fontWeight: 600, color: T.c.text, lineHeight: 1.35, minHeight: 44 }}>{tick.cue}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconButton label={playing ? "Mettre en pause" : "Lire"} tone="accent" size={52} onClick={togglePlay} disabled={state !== "ready"}>
            {playing ? <Pause size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" />}
          </IconButton>
          <input type="range" min={0} max={tick.total} step={0.02} value={Math.min(tick.t, tick.total)} disabled={state !== "ready"}
            aria-label="Position dans le geste" onChange={(e) => seek(parseFloat(e.target.value))}
            style={{ flex: 1, minWidth: 0, height: 44, accentColor: "var(--c-accent)" }} />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Chip on={speed === 0.5} onClick={() => pickSpeed(0.5)}>Ralenti</Chip>
          <Chip on={speed === 1} onClick={() => pickSpeed(1)}>Vitesse réelle</Chip>
          {base.sides && [base.side || "L", other(base.side || "L")].sort().map((s) => (
            <Chip key={s} on={side === s} onClick={() => pickSide(s)}>Côté {SIDE_LABEL[s].toLowerCase()}</Chip>
          ))}
        </div>

        <div>
          <Eyebrow style={{ marginBottom: 6 }}>Caméra · glisser pour tourner, pincer pour zoomer</Eyebrow>
          <div className="p-strip">
            {VIEW_LABELS.map(([k, label]) => (
              <Chip key={k} on={view === k} onClick={() => pickView(k)} style={{ flexShrink: 0 }}>{label}</Chip>
            ))}
            <span aria-hidden="true" style={{ flex: "0 0 24px" }} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: T.c.text2 }}>
          <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 999, background: T.c.accent, flexShrink: 0 }} />
          En jaune : la zone qui travaille.
        </div>

        {alerte && <div role="note" style={{ fontSize: 14, lineHeight: 1.4, color: T.c.warn, borderLeft: `3px solid ${T.c.warn}`, paddingLeft: 10 }}>{alerte}</div>}

        <div style={{ display: "grid", gap: 4 }}>
          <Eyebrow>À sentir</Eyebrow>
          <div style={{ fontSize: 15, color: T.c.text, lineHeight: 1.4 }}>{base.sentir}</div>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <Eyebrow>À éviter</Eyebrow>
          <div style={{ fontSize: 15, color: T.c.text, lineHeight: 1.4 }}>{base.eviter}</div>
        </div>
        {consigne && (
          <div style={{ display: "grid", gap: 4 }}>
            <Eyebrow>Consigne de la séance</Eyebrow>
            <div className="p-sec">{consigne}</div>
          </div>
        )}
        <div className="p-muted" style={{ fontSize: 13 }}>Mannequin simplifié : il montre la trajectoire, l'amplitude et le rythme, pas la prise ni les détails de placement.</div>
      </div>
    </div>
  );
}
