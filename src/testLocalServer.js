LocalServer = require("./poc_local_server.js");

function testGame(vid=0, playerCt=4, seed=1) {
  let vari = variants.find(a=>a.id==vid);
  let dvari = v.find(a=>a.id==vid);
  let playerNames = [..."ABCDEF".slice(0,playerCt)];
  let game = new LocalServer(vari, dvari, seed, playerNames);
  game.main();
  return game;
}

// Expect 8189e7
testGame(180, 4, 906);