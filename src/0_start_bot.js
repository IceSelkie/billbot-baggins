fs = require("fs");
// const{createHash}=require("crypto");sha256 = buff => createHash("sha256").update(buff).digest("hex");
eval("" + fs.readFileSync("variants_POC_generate.js"));
GameState = eval("" + fs.readFileSync("subcall_gamestate.js"));
RemoteProxy = eval("" + fs.readFileSync("poc_remote_proxy.js"));
CoxAI = eval("" + fs.readFileSync("subcall_hatguess_cox.js"));
eval("" + fs.readFileSync("hatguess_POC_display.js"));
proxy = new RemoteProxy(JSON.parse(fs.readFileSync("../../bill-bot2/token_v2.json"))?.["bill-bot1"]?.token);

// console.log(displayRow([proxy.gameState.playable,proxy.gameState.trash])+"\n");console.log(displayRow(proxy.gameState.hands[0].map(a=>a.public)));

multiplicitiesToMaskList = (m) => { m = m[0].map((_, i) => m.map(b => b[i])).flat(); let qtys = new Array(m.reduce((c, n) => Math.max(c, n), 0) + 1).fill(null).map((_, i) => i); return qtys.map(q => m.map(v => v === q).map((v, i) => v ? 1n << BigInt(i) : 0n).reduce((c, n) => c | n, 0n)) }
// console.log(displayRow([proxy.gameState.playable,proxy.gameState.trash,multiplicitiesToMaskList(proxy.gameState.publicMultiplicities),0n,multiplicitiesToMaskList(proxy.gameState.privateMultiplicities)],proxy.gameState.suits.length,proxy.ranks.suits.length)+"\n");console.log(displayRow(proxy.gameState.hands[0].map(a=>a.public),proxy.gameState.suits.length,proxy.ranks.suits.length));
