// Texte à dire par la voix de Jeffrey (Pocket TTS sur Oracle, 29/10/2026). Le serveur lit le
// texte tel quel : il n'interprète ni chiffres, ni unités, ni SSML. Ici : découpage en phrases
// (une requête par phrase, pour que le premier son arrive vite), nettoyage de la mise en forme et
// écriture en toutes lettres des nombres, heures et unités. Fonctions pures, sans DOM.

const UNITS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize"];
const TENS = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante" };

function below100(n) {
  if (n < 17) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  if (n < 70) {
    const t = Math.floor(n / 10), u = n % 10;
    return TENS[t] + (u === 0 ? "" : u === 1 ? " et un" : `-${UNITS[u]}`);
  }
  if (n < 80) return n === 71 ? "soixante et onze" : `soixante-${below100(n - 60)}`;
  return n === 80 ? "quatre-vingts" : `quatre-vingt-${below100(n - 80)}`;
}

function below1000(n) {
  const h = Math.floor(n / 100), r = n % 100;
  if (h === 0) return below100(r);
  const head = h === 1 ? "cent" : `${UNITS[h]} cent${r === 0 ? "s" : ""}`;
  return r === 0 ? head : `${head} ${below100(r)}`;
}

/** Entier positif ou nul en toutes lettres (jusqu'à 999 999 999). */
export function numberToFrench(n) {
  if (!Number.isInteger(n) || n < 0 || n >= 1e9) return String(n);
  if (n === 0) return "zéro";
  const millions = Math.floor(n / 1e6), thousands = Math.floor((n % 1e6) / 1000), rest = n % 1000;
  const parts = [];
  if (millions) parts.push(millions === 1 ? "un million" : `${below1000(millions).replace(/(cent|vingt)s$/, "$1")} millions`);
  if (thousands) parts.push(thousands === 1 ? "mille" : `${below1000(thousands).replace(/(cent|vingt)s$/, "$1")} mille`);
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}

/** « 93,8 » ou « 93.8 » → « quatre-vingt-treize virgule huit » ; « 1,05 » → « un virgule zéro cinq ». */
export function decimalToFrench(s) {
  const [int, dec] = s.replace(".", ",").split(",");
  const head = numberToFrench(Number(int));
  if (!dec) return head;
  const zeros = dec.match(/^0*/)[0].length;
  const tail = dec.length > 3
    ? [...dec].map((d) => UNITS[Number(d)]).join(" ")
    : [...Array(zeros).fill("zéro"), ...(dec.slice(zeros) ? [numberToFrench(Number(dec.slice(zeros)))] : [])].join(" ");
  return `${head} virgule ${tail}`;
}

/** Féminin des nombres devant « heure(s) » / pour les minutes : « un » → « une ». */
const feminine = (words) => words.replace(/\bun$/, "une");

const ordinal = (n) => {
  if (n === 1) return "premier";
  let w = numberToFrench(n);
  if (w.endsWith("cinq")) w += "u";
  else if (w.endsWith("neuf")) w = `${w.slice(0, -1)}v`;
  else if (w.endsWith("e")) w = w.slice(0, -1);
  return `${w}ième`;
};

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Unités après un nombre : [abréviation, singulier, pluriel]. Les plus longues d'abord.
const UNIT_WORDS = [
  ["kcal", "kilocalorie", "kilocalories"],
  ["bpm", "battement par minute", "battements par minute"],
  ["mg", "milligramme", "milligrammes"],
  ["kg", "kilo", "kilos"],
  ["km", "kilomètre", "kilomètres"],
  ["cm", "centimètre", "centimètres"],
  ["mL", "millilitre", "millilitres"],
  ["ml", "millilitre", "millilitres"],
  ["min", "minute", "minutes"],
  ["sem", "semaine", "semaines"],
  ["g", "gramme", "grammes"],
  ["L", "litre", "litres"],
  ["l", "litre", "litres"],
  ["s", "seconde", "secondes"],
  ["j", "jour", "jours"],
  ["°C", "degré", "degrés"],
  ["°", "degré", "degrés"],
  ["€", "euro", "euros"],
  ["¢", "centime", "centimes"],
];
const NUM = "\\d+(?:[.,]\\d+)?";
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Une unité ne compte que si elle n'est pas suivie d'une lettre (« 10 secondes » n'est pas « s »).
const UNIT_RE = new RegExp(`(${NUM})\\s?(${UNIT_WORDS.map(([u]) => esc(u)).join("|")})(?![\\p{L}\\d])`, "gu");
const plural = (num) => parseFloat(num.replace(",", ".")) >= 2;

/** Nombres, heures, dates, pourcentages et unités en toutes lettres. */
export function normalizeFrench(text) {
  let t = text;
  // Milliers séparés par une espace (normale, insécable ou fine) : « 2 400 » → « 2400 ».
  t = t.replace(/(\d)[   ](?=\d{3}(?!\d))/g, "$1");
  // Heures : « 5h17 », « 05:17 », « 19 h », « 6h ».
  t = t.replace(/\b(\d{1,2})\s?[hH:](\d{2})\b/g, (m, h, mn) => {
    const hh = Number(h), mm = Number(mn);
    if (hh > 23 || mm > 59) return m;
    const hw = `${feminine(numberToFrench(hh))} heure${hh >= 2 ? "s" : ""}`;
    return mm === 0 ? hw : `${hw} ${feminine(numberToFrench(mm))}`;
  });
  t = t.replace(/\b(\d{1,2})\s?h\b/g, (_, h) => `${feminine(numberToFrench(Number(h)))} heure${Number(h) >= 2 ? "s" : ""}`);
  // Notes : « 3/10 » (douleur), « 3/4 » (qualité de sommeil) → « trois sur dix ».
  t = t.replace(/\b(\d{1,2})\s?\/\s?(10|4)\b(?!\/)/g, (m, a, b) => (Number(a) <= Number(b) ? `${a} sur ${b}` : m));
  // Dates : « 29/10 » → « 29 octobre ».
  t = t.replace(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/g, (m, d, mo) => {
    const dd = Number(d), mm = Number(mo);
    if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return m;
    return `${dd === 1 ? "premier" : dd} ${MONTHS[mm - 1]}`;
  });
  // Autres fractions entre nombres.
  t = t.replace(/(\d)\s?\/\s?(\d)/g, "$1 sur $2");
  // Fourchettes : « 8-12 » → « 8 à 12 ».
  t = t.replace(/(\d)\s?[-–]\s?(?=\d)/g, "$1 à ");
  // Signes devant un nombre.
  t = t.replace(/(^|[\s(])[−-](?=\d)/g, "$1moins ");
  t = t.replace(/(^|[\s(])\+(?=\d)/g, "$1plus ");
  t = t.replace(/(\d)\s?%/g, "$1 pour cent");
  t = t.replace(/(\d)\s?[×x]\s?(?=\d)/g, "$1 fois ");
  // Ordinaux : « 1re », « 1er », « 2e ».
  t = t.replace(/\b1(?:er|re|ère)\b/g, (m) => (m === "1er" ? "premier" : "première"));
  t = t.replace(/\b(\d+)(?:e|ème)\b/g, (_, n) => ordinal(Number(n)));
  // Unités.
  t = t.replace(UNIT_RE, (_, num, unit) => {
    const [, one, many] = UNIT_WORDS.find(([u]) => u === unit);
    return `${num} ${plural(num) ? many : one}`;
  });
  // « par » après une unité : « kilos/sem », « kilocalories/j ».
  t = t.replace(/\s?\/\s?(j|jour)\b/g, " par jour");
  t = t.replace(/\s?\/\s?(sem|semaine)\b/g, " par semaine");
  t = t.replace(/\s?\/\s?kg\b/g, " par kilo");
  t = t.replace(/\s?\/\s?h\b/g, " par heure");
  t = t.replace(/\s?\/\s?min\b/g, " par minute");
  // Nombres restants.
  t = t.replace(/\d+(?:[.,]\d+)?/g, (n) => decimalToFrench(n));
  // Symboles.
  t = t.replace(/[≈~]\s?/g, "environ ");
  t = t.replace(/\s?(?:→|⇒|->)\s?/g, ", ");
  t = t.replace(/\s?≤\s?/g, " au plus ");
  t = t.replace(/\s?≥\s?/g, " au moins ");
  t = t.replace(/\s×\s/g, " fois ");
  t = t.replace(/\s&\s/g, " et ");
  t = t.replace(/\s=\s/g, " égale ");
  t = t.replace(/\s\/\s/g, ", ");
  return t.replace(/[ \t]{2,}/g, " ").trim();
}

/** Mise en forme retirée : gras, titres, puces, numéros de liste, émojis, marqueurs. */
export function cleanForSpeech(text) {
  return text
    .split("\n")
    .map((line) => line
      .replace(/^\s*#{1,6}\s+/, "")
      .replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, "")
      .replace(/^\s*-{3,}.*$/, ""))
    .join("\n")
    .replace(/\*\*|__|`/g, "")
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$|[.,;:!?])/g, "$1$2")
    .replace(/\p{Extended_Pictographic}️?/gu, "")
    .replace(/[★☆]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const MIN_CHARS = 20; // une phrase plus courte attend la suivante (moins de requêtes, moins de coupures)
const MAX_CHARS = 240; // au-delà, coupure à la dernière virgule (le serveur accepte 6 000 car.)

/** Coupe un morceau trop long à la dernière ponctuation faible avant MAX_CHARS. */
function cutLong(s) {
  const out = [];
  let rest = s;
  while (rest.length > MAX_CHARS) {
    const head = rest.slice(0, MAX_CHARS);
    const at = Math.max(head.lastIndexOf(", "), head.lastIndexOf("; "), head.lastIndexOf(" : "), head.lastIndexOf(" — "));
    const space = head.lastIndexOf(" ");
    const cut = at > MAX_CHARS / 3 ? at + 1 : space > 0 ? space : MAX_CHARS;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/**
 * Découpage au fil de l'eau : `feed(texteComplet)` reçoit tout le texte reçu jusqu'ici (comme
 * l'affichage en direct) et appelle `onSentence` pour chaque phrase terminée. Un texte qui ne
 * prolonge pas le précédent (relance d'une réponse muette) repart de zéro. Rien n'est dit après
 * un marqueur `---` (carnet de bord). `flush()` envoie le reste à la fin de la réponse.
 */
export function createSentenceSplitter(onSentence) {
  let seen = "";
  let consumed = 0;
  let stopped = false;
  const take = (final) => {
    if (stopped) return;
    let rest = seen.slice(consumed);
    const marker = rest.indexOf("---");
    if (marker >= 0) { rest = rest.slice(0, marker); final = true; }
    // Fin de phrase : ponctuation forte suivie d'une espace, ou saut de ligne.
    const re = /[.!?…]+["»)]?(?=\s)|\n/g;
    let start = 0;
    let m;
    while ((m = re.exec(rest))) {
      const end = m.index + m[0].length;
      const piece = rest.slice(start, end).trim();
      if (piece.length >= MIN_CHARS || (m[0] === "\n" && /[.!?…:]$/.test(piece))) {
        cutLong(piece).forEach(onSentence);
        start = end;
      }
    }
    if (final) {
      const piece = rest.slice(start).trim();
      if (piece) cutLong(piece).forEach(onSentence);
      consumed = seen.length;
      stopped = true;
    } else consumed += start;
  };
  return {
    feed(all) {
      if (!all.startsWith(seen.slice(0, consumed))) { consumed = 0; stopped = false; }
      seen = all;
      take(false);
    },
    flush() { take(true); },
  };
}

/** Phrases d'un texte complet, prêtes à dire (nettoyées, en toutes lettres). */
export function speechChunks(text) {
  const out = [];
  const splitter = createSentenceSplitter((s) => out.push(s));
  splitter.feed(text || "");
  splitter.flush();
  return out.map((s) => normalizeFrench(cleanForSpeech(s))).filter((s) => /[\p{L}\d]/u.test(s));
}

// Version de la préparation du texte et de la voix : la changer invalide les fichiers en cache.
export const SPEECH_VERSION = "pocket-fr-jeffrey-1";

/** Clé de cache d'un texte préparé : texte normalisé + modèle + voix + version. */
export function speechKey(chunks, { model = "protocole/jeffrey", voice = "jeffrey" } = {}) {
  const s = `${SPEECH_VERSION}|${model}|${voice}|${chunks.join("\n")}`;
  // FNV-1a 32 bits, deux graines : 16 caractères hexadécimaux.
  const fnv = (seed) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, "0");
  };
  return fnv(0x811c9dc5) + fnv(0x1b873593);
}
