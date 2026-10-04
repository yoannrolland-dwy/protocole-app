const expr = process.argv[2];
const targets = await (await fetch("http://localhost:9222/json")).json();
const page = targets.find(t => t.type === "page" && !/devtools/.test(t.url));
if (!page) { console.error("aucune page:", targets.map(t => t.url)); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: expr, returnByValue: true } }));
const msg = await new Promise(r => ws.onmessage = e => r(JSON.parse(e.data)));
ws.close();
console.log(JSON.stringify(msg.result?.result?.value));
