// Carte Jeffrey du tableau de bord (chantier J, J1.3, 29/10/2026). Tranché par Yoann : tout en
// haut jusqu'à midi, repliée en une ligne sous les tuiles l'après-midi. En attendant le brief du
// matin (J4), elle montre le dernier message de Jeffrey du jour, ou propose « Faites-moi le
// point » s'il n'a encore rien dit. Un tap ouvre la conversation par-dessus l'écran.
import { ChevronRight, ConciergeBell } from "lucide-react";
import { T } from "../../design/tokens.js";
import { Panel, Eyebrow, Button } from "../../design/primitives.jsx";
import { sayStable } from "../../lib/jeffrey.js";

const lastWords = (entries) => [...(entries || [])].reverse().find((e) => e.role === "assistant" && !e.hidden && e.text)?.text || null;

// Brief du matin (J4.1) : tant qu'il attend la nuit, la pesée ou le genou, `waiting` porte la
// phrase « J'ai votre nuit ; il me manque… » ; `onBriefNow` le lance sans attendre (absent pendant
// qu'il s'écrit).
export function JeffreyCard({ entries, morning, onOpen, waiting, onBriefNow }) {
  const last = lastWords(entries);

  if (!morning) {
    return (
      <button type="button" className="p-tap p-card" onClick={() => onOpen()} aria-label="Ouvrir la conversation avec Jeffrey"
        style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 56, padding: "0 14px", textAlign: "left", fontFamily: "inherit", color: T.c.text }}>
        <ConciergeBell size={18} color={T.c.accent} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: T.c.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {last || sayStable("cardTalk")}
        </span>
        <ChevronRight size={18} color={T.c.text2} aria-hidden="true" style={{ flexShrink: 0 }} />
      </button>
    );
  }

  return (
    <Panel tone="key" aria-label="Jeffrey">
      <Eyebrow style={{ color: T.c.accent }}>Jeffrey</Eyebrow>
      {last ? (
        <>
          <div style={{ fontSize: 15, color: T.c.text, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap" }}>{last}</div>
          <Button variant="outline" block onClick={() => onOpen()}>Continuer la conversation</Button>
        </>
      ) : waiting ? (
        <>
          <div style={{ fontSize: 15, color: T.c.text2, lineHeight: 1.5 }}>{waiting}</div>
          {onBriefNow && <Button variant="outline" block onClick={onBriefNow}>Le brief tout de suite</Button>}
        </>
      ) : (
        <>
          <div style={{ fontSize: 15, color: T.c.text2 }}>{sayStable("cardHello")}</div>
          <Button variant="primary" block onClick={() => onOpen("point")}>Faites-moi le point</Button>
        </>
      )}
    </Panel>
  );
}
