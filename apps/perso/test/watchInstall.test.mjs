// Installation sur la montre (17/11/2026) : avec la montre en débogage sans fil, adb voit deux
// appareils ; chaque commande doit viser le bon (-s), sinon adb refuse ou installe au mauvais endroit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pickDevice, readySerials } from "../scripts/releaseCheck.mjs";

const PHONE = { serial: "R5CY123ABC", characteristics: "phone" };
const WATCH = { serial: "192.168.1.42:41235", characteristics: "nosdcard,watch" };

test("adb devices : seuls les appareils prêts sont gardés", () => {
  const out = "List of devices attached\nR5CY123ABC\tdevice\n192.168.1.42:41235\tdevice\nXYZ\tunauthorized\n";
  assert.deepEqual(readySerials(out), ["R5CY123ABC", "192.168.1.42:41235"]);
});

test("téléphone et montre connectés : chacun est trouvé par sa caractéristique", () => {
  assert.deepEqual(pickDevice([PHONE, WATCH], "phone"), { serial: PHONE.serial, problems: [] });
  assert.deepEqual(pickDevice([PHONE, WATCH], "watch"), { serial: WATCH.serial, problems: [] });
});

test("appareil absent ou en double : arrêt avec un message clair", () => {
  assert.match(pickDevice([PHONE], "watch").problems[0], /montre non connectée/);
  assert.match(pickDevice([WATCH], "phone").problems[0], /téléphone non branché/);
  assert.match(pickDevice([PHONE, { ...PHONE, serial: "B" }], "phone").problems[0], /plusieurs/);
});

test("release.mjs : chaque commande adb de l'installation vise un appareil précis", () => {
  const s = readFileSync(new URL("../scripts/release.mjs", import.meta.url), "utf8");
  const i = s.slice(s.indexOf("function install("));
  for (const m of i.matchAll(/run\("adb", \[([^\]]*)\]/g)) assert.match(m[1], /^"-s", s,/, m[0]);
  assert.match(s, /"install-montre"\) install\("watch"\)/);
  assert.match(s, /wearApkSha256/);
});
