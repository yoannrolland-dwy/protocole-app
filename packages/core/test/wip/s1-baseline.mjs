// Sorties de recommendSessions sur des scénarios fixes, SANS asOf/planning — capture avant/après
// S1 pour prouver la non-régression. Les dates sont relatives à today() (la capture avant et
// après est faite le même jour).
const P = "/Users/yrolland/Documents/GitHub/protocole-app/packages/core/src";
const { recommendSessions } = await import(`${P}/recommender.js`);
const { SCHEMES } = await import(`${P}/climbing.js`);
const { today, shiftDateKey } = await import(`${P}/dateUtils.js`);
const t0 = today(), d = (n) => shiftDateKey(t0, -n);
const S = SCHEMES.gym, T = { cut: { enabled: false } };
const sc = {
  vide: {},
  genouRouge: { knee: [{ date: t0, pain: 7, baseline: false }] },
  genouAmbre: { knee: [{ date: d(1), pain: 4, baseline: true }] },
  lowerAujourdhui: { training: [{ date: t0, type: "Lower C", exercices: [] }], knee: [{ date: t0, pain: 2, baseline: true }] },
  upperHierEscalade: { training: [{ date: d(1), type: "Upper A", exercices: [] }, { date: d(2), type: "Escalade", blocs: Array(20).fill({ cotation: "rouge-2", issue: "essais" }) }], knee: [{ date: t0, pain: 2, baseline: true }] },
  sommeilCourt: { sleep: [{ date: t0, hours: 5, quality: 1 }, { date: d(1), hours: 5, quality: 2 }], knee: [{ date: t0, pain: 2, baseline: true }] },
  charge: { training: [0, 0, 1, 1, 2, 2, 2].map((n, i) => ({ date: d(n), type: ["Upper A", "Lower A", "Basket", "Upper B", "Escalade", "Lower B", "Basket"][i], exercices: [] })), knee: [{ date: t0, pain: 2, baseline: true }] },
  planUpper: { weeklyPlan: ["Upper"], knee: [{ date: t0, pain: 2, baseline: true }] },
  planLowerMatch: { weeklyPlan: ["Lower"], matchWeek: true, knee: [{ date: t0, pain: 2, baseline: true }] },
  postMatch: { postMatch: true, weeklyPlan: ["Full Body"], knee: [{ date: t0, pain: 2, baseline: true }] },
  basketPrevu: { basketSchedule: { weekly: [0, 1, 2, 3, 4, 5, 6], matchDates: [] }, knee: [{ date: t0, pain: 2, baseline: true }] },
};
const out = {};
for (const [k, v] of Object.entries(sc)) out[k] = recommendSessions({ training: [], knee: [], sleep: [], targets: T, scheme: S, ...v });
console.log(JSON.stringify(out));
