fs = require("fs");
eval("" + fs.readFileSync("variants_POC_generate.js"));
GameState = eval("" + fs.readFileSync("subcall_gamestate.js"));
RemoteProxy = eval("" + fs.readFileSync("poc_remote_proxy.js"));
CoxAI = eval("" + fs.readFileSync("subcall_hatguess_cox.js"));
eval("" + fs.readFileSync("hatguess_POC_display.js"));
proxy = new RemoteProxy(JSON.parse(fs.readFileSync("../../bill-bot2/token_v2.json"))?.["bill-bot1"]?.token);

// console.log(displayRow([proxy.gameState.playable,proxy.gameState.trash])+"\n");console.log(displayRow(proxy.gameState.hands[0].map(a=>a.public)));
