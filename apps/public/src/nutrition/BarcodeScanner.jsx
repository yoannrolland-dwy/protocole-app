// Scan de code-barres web (Lot C, chantier "parité apps/public", 06/08/2026).
//
// apps/perso scanne via @capacitor-mlkit/barcode-scanning, natif seulement — inutilisable
// ici (site web pur, pas de pont Capacitor). Approche retenue : le paquet `barcode-detector`
// (ponyfill Sec-ant, entrée `/pure`) plutôt que l'API BarcodeDetector native seule — celle-ci
// est Chromium-only (Chrome/Edge/Android), jamais implémentée par Safari/WebKit, sans date
// annoncée. `/pure` utilise systématiquement une implémentation WASM (zxing-cpp), identique
// sur tous les navigateurs y compris Safari/iOS : un seul chemin de code, pas de branche
// "si Chrome alors natif sinon rien". Le binaire .wasm est chargé à la demande depuis le CDN
// jsDelivr par la librairie elle-même (pas de fichier à héberger ici), mis en cache par le
// navigateur après le premier scan.
//
// Formats restreints à EAN-13/EAN-8/UPC-A/UPC-E — mêmes codes-barres produits que le scan
// natif (packages/core/src/nutrition/scan.js), jamais QR/Code128 qu'on ne croise pas sur un
// emballage alimentaire.
//
// Ne throw jamais un état inexploitable par l'UI : permission refusée, caméra absente,
// détection en échec → un message clair plutôt qu'un écran figé, même exigence que le scan
// natif ("ne throw jamais").

import { useEffect, useRef, useState } from "react";
import { X, ScanBarcode } from "lucide-react";
import { BarcodeDetector } from "barcode-detector/pure";
import { C, Body } from "../ui.jsx";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

export default function BarcodeScanner({ onDetect, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const doneRef = useRef(false);
  // idle (démarrage caméra) | scanning | denied | unsupported | error
  const [state, setState] = useState("idle");

  useEffect(() => {
    let cancelled = false;
    const detector = new BarcodeDetector({ formats: FORMATS });

    const loop = async () => {
      if (cancelled || doneRef.current || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0) {
          doneRef.current = true;
          onDetect(codes[0].rawValue);
          return;
        }
      } catch {
        // une frame illisible n'est pas une erreur fatale — on retente à la suivante.
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setState("unsupported"); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setState("scanning");
        rafRef.current = requestAnimationFrame(loop);
      } catch (e) {
        setState(e?.name === "NotAllowedError" ? "denied" : "error");
      }
    };
    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ERROR_MSG = {
    denied: "Permission caméra refusée — autorise l'accès à la caméra dans les réglages du navigateur pour scanner un produit.",
    unsupported: "Caméra indisponible sur cet appareil/navigateur — cherche le produit à la main.",
    error: "Impossible d'ouvrir la caméra — réessaie, ou cherche le produit à la main.",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000", zIndex: 70,
      display: "flex", flexDirection: "column",
      paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.text }}>
          <ScanBarcode size={16} />
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 800 }}>
            Scanner un code-barres
          </span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.text, cursor: "pointer", padding: 4 }}>
          <X size={22} />
        </button>
      </div>

      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {state === "scanning" && (
          <div style={{
            position: "absolute", width: "70%", maxWidth: 320, aspectRatio: "1.6", borderRadius: 12,
            border: `2px solid ${C.accent}`, boxShadow: "0 0 0 2000px rgba(0,0,0,0.45)",
          }} />
        )}
        {ERROR_MSG[state] && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <Body style={{ color: C.text2, textAlign: "center", fontSize: 13 }}>{ERROR_MSG[state]}</Body>
          </div>
        )}
      </div>

      {state === "scanning" && (
        <Body style={{ color: C.text2, textAlign: "center", padding: "10px 24px 16px", fontSize: 11 }}>
          Cadre le code-barres dans le rectangle.
        </Body>
      )}
    </div>
  );
}
