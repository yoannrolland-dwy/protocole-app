// Note dépliable d'un exercice (09/11/2026, demande de Yoann) : réglages des machines. Repliée,
// elle montre sa première ligne ; dépliée, une zone de texte enregistrée à chaque frappe
// (lib/exoNotes.js, clé `exoNotes`, attachée au nom de l'exercice).
import { useState } from "react";
import { NotebookPen, ChevronDown } from "lucide-react";
import { T } from "../../design/tokens.js";
import { notePreview } from "../../lib/exoNotes.js";

export function ExoNote({ nom, text = "", onChange }) {
  const [open, setOpen] = useState(false);
  const preview = notePreview(text);
  return (
    <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
      <button type="button" className="p-tap" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        aria-label={open ? `Replier la note · ${nom}` : `${preview ? "Voir la note" : "Ajouter une note"} · ${nom}`}
        style={{
          display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: 0, minWidth: 0,
          background: "none", border: "none", color: preview ? T.c.text : T.c.text2, fontSize: 14, fontFamily: "inherit", textAlign: "left",
        }}>
        <NotebookPen size={16} aria-hidden="true" style={{ flex: "none", color: preview ? T.c.accent : T.c.text2 }} />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {open ? "Note" : preview || "Note (réglages machine)"}
        </span>
        <ChevronDown size={16} aria-hidden="true" style={{ flex: "none", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <textarea rows={3} value={text} onChange={(e) => onChange(e.target.value)} aria-label={`Note · ${nom}`}
          placeholder="Siège 4, dossier 2, sécurités au trou 7…" className="p-field"
          style={{ height: "auto", minHeight: 0, padding: "10px 12px", fontSize: 15, lineHeight: 1.45, fontFamily: "inherit", resize: "vertical" }} />
      )}
    </div>
  );
}
