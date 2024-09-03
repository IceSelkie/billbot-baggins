sha256 = buff => require("crypto").createHash("sha256").update(buff).digest("hex");
fs = require("fs");null
eval("" + fs.readFileSync("variants_POC_generate.js"));
GameState = eval("" + fs.readFileSync("subcall_gamestate.js"));
RemoteProxy = eval("" + fs.readFileSync("poc_remote_proxy.js"));
CoxAI = eval("" + fs.readFileSync("subcall_hatguess_cox.js"));
eval("" + fs.readFileSync("hatguess_POC_display.js"));
multiplicitiesToMaskList = (m) => { m = m[0].map((_, i) => m.map(b => b[i])).flat(); let qtys = new Array(m.reduce((c, n) => Math.max(c, n), 0) + 1).fill(null).map((_, i) => i); return qtys.map(q => m.map(v => v === q).map((v, i) => v ? 1n << BigInt(i) : 0n).reduce((c, n) => c | n, 0n)) }
DEBUG = false;

turnActionComplete = false;
autoStep = false;

/* ################ GAME SPECIFICS ################ */
vari = variants.find(a=>a.id === 180);null
dvari = v.find(a=>a.id === 180);null
playerNames = ["local-2","local-1","local-4","local-3"];
handSize = 4;
server = new GameState(vari, dvari, playerNames, -1); server.isServer = true;

// seed 'p4v180s1'
cards = [{"suitIndex":3,"rank":5},{"suitIndex":0,"rank":3},{"suitIndex":0,"rank":3},{"suitIndex":0,"rank":4},{"suitIndex":2,"rank":1},{"suitIndex":0,"rank":2},{"suitIndex":5,"rank":2},{"suitIndex":2,"rank":3},{"suitIndex":2,"rank":1},{"suitIndex":3,"rank":3},{"suitIndex":3,"rank":4},{"suitIndex":4,"rank":3},{"suitIndex":5,"rank":3},{"suitIndex":2,"rank":4},{"suitIndex":5,"rank":2},{"suitIndex":0,"rank":5},{"suitIndex":2,"rank":5},{"suitIndex":1,"rank":1},{"suitIndex":1,"rank":1},{"suitIndex":4,"rank":3},{"suitIndex":2,"rank":2},{"suitIndex":5,"rank":4},{"suitIndex":1,"rank":3},{"suitIndex":3,"rank":4},{"suitIndex":0,"rank":4},{"suitIndex":3,"rank":3},{"suitIndex":5,"rank":4},{"suitIndex":5,"rank":1},{"suitIndex":1,"rank":1},{"suitIndex":5,"rank":1},{"suitIndex":5,"rank":3},{"suitIndex":0,"rank":2},{"suitIndex":4,"rank":1},{"suitIndex":4,"rank":4},{"suitIndex":2,"rank":3},{"suitIndex":5,"rank":1},{"suitIndex":2,"rank":2},{"suitIndex":4,"rank":2},{"suitIndex":4,"rank":1},{"suitIndex":1,"rank":3},{"suitIndex":4,"rank":2},{"suitIndex":1,"rank":4},{"suitIndex":5,"rank":5},{"suitIndex":4,"rank":1},{"suitIndex":3,"rank":1},{"suitIndex":1,"rank":2},{"suitIndex":1,"rank":2},{"suitIndex":3,"rank":2},{"suitIndex":1,"rank":5},{"suitIndex":4,"rank":4},{"suitIndex":3,"rank":2},{"suitIndex":3,"rank":1},{"suitIndex":1,"rank":4},{"suitIndex":4,"rank":5},{"suitIndex":0,"rank":1},{"suitIndex":2,"rank":1},{"suitIndex":3,"rank":1},{"suitIndex":2,"rank":4},{"suitIndex":0,"rank":1},{"suitIndex":0,"rank":1}];
order = 0;

/* ################ HELPERS ################ */
resolveOrder=(o)=>cards[o]?`c${o}=${server.suits[cards[o].suitIndex]}${cards[o].rank}`:`c${o}=UNKNOWN`;
resolvePlayer=(pi)=>`p${pi}~${playerNames[pi]}`;
resolveClue=({type,value})=>`${type?"rank":"color"}${value}~${type?String(value):server.clueColors[value]}`;

/* ################ SET UP PLAYERS ################ */
players = playerNames.map((_,pi)=>{
  let gameState = new GameState(vari, dvari, playerNames, pi);
  // Set AI to hat guessing
  gameState.ai = new CoxAI(gameState);
  // Add listeners for when the AI takes actions
  gameState.clientPlay=(order)=>{console.log("Play attempted by "+pi,{order}); clientPlay(pi,order)};
  gameState.clientDiscard=(order)=>{console.log("Discard attempted by "+pi,{order}); clientDiscard(pi,order)};
  gameState.clientClue=({playerIndex,colorIndex,rank})=>{console.log(`Clue ${rank?"Rank":"Color"} attempted by ${pi} ${JSON.stringify({playerIndex,colorIndex,rank})}`); clientClue(pi,playerIndex,colorIndex,rank)};
  gameState.clientClueColor=(playerIndex,colorIndex)=>{console.log("Clue Color attempted by "+pi,{playerIndex,colorIndex}); clientClue(pi,playerIndex,colorIndex,null)};
  gameState.clientClueRank=(playerIndex,rank)=>{console.log("Clue Rank attempted by "+pi,{playerIndex,rank}); clientClue(pi,playerIndex,null,rank)};
  return gameState;
});





/* ################ GENERAL TIMING AND ASSURANCE ################ */
function main() {
  // Deal starting cards (last card dealt triggers first player to try to play)
  playerNames.forEach((p,playerIndex)=>{
    for (let i=0; i<handSize; i++)
      playerDraw(playerIndex);
  });

  // Run game to completion
  while (step()) {};

  // Output Score:
  console.error("Players scored "+server.playPile.flat().length+"!");
  // Expect 28 points for this seed and AI.

  gameHash=(server,doHash=true)=>(doHash?sha256:a=>a)([
      JSON.stringify({turn:server.turn,tokens:server.tokens,strikes:server.strikes,gameOver:server.gameOver}),
      server.hands.map(a=>a.map(c=>c.order)).join("|"),
      server.playPile.map(a=>a.map(c=>c.order+"."+c.suitIndex+c.rank)).join(),
      server.discardPile.map(c=>c.order+"."+c.suitIndex+c.rank).join()
    ].join("\n"));

  console.log(gameHash(server).slice(0,6));
  players.forEach(p=>console.log(gameHash(p).slice(0,6)));
}

// Let stepping forward be its own function for easier debugging
function step() {
  console.log(`Queueing next step/turn.`);
  if (server.turnsLeft === 0) {
    announceAll("serverGameOver",null,{reason:"Ran out of turns"});
    return false;
  } else {
    announceAll("serverTurn",null,{num:server.turn,currentPlayerIndex:(server.currentPlayerIndex+1)%playerNames});
    // {"type":"turn","num":1,"currentPlayerIndex":1},
    return true;
  }
}

function assert(message, bool, object) {
  if (!bool)
    throw new Error(message+(object?" "+JSON.stringify(object):""));
}

// Do some simple validation checks on the hands to detect mistakes nearer to when they occur.
function verifyHandsValid() {
  const mismatchedIdentities = players.map((player,pi)=>
    player.hands.map((hand,hi)=>
      hand.map((card,ci)=>{
        const serverCard = server.hands[hi][ci];
        // player's knowledge disagrees with ground truth (or the order of cards in hand has changed)
        if (!(card.public & serverCard.public) || card.order!==serverCard.order) {
          return {pi, hi, ci, card, trueCard:resolveOrder(server.hands[hi][ci].order)};
        }
      })
    )
  ).flat(3).filter(a=>a);
  if (mismatchedIdentities.length > 0) {
    console.log(mismatchedIdentities.length, "mismatched identities.");
    mismatchedIdentities.forEach(o=>console.log(" ",o));
    throw new Error("Mismatched Identities!")
  }
}



/* ################ DISPATCHER ################ */
oldConsole = console.log;
outgoingQueue = [];
busyAnnoucing = false;
announceAll=(action, i, payload, payload2)=>{
  if (busyAnnoucing) {
    const index = outgoingQueue.push([action,i,payload,payload2]);
    oldConsole("[NONE]","Queued an announcement of:",{action,i},"Place in line:",index);
    return;
  }
  busyAnnoucing = true;

  let debugString = JSON.parse(JSON.stringify({action,payload}));
  if (debugString.payload.order!==undefined) debugString.payload.order = resolveOrder(debugString.payload.order);
  if (debugString.payload.list) debugString.payload.list = debugString.payload.list.map(resolveOrder);
  ["playerIndex","giver","target"].forEach(k=>{if(debugString.payload[k]!==undefined)debugString.payload[k]=resolvePlayer(debugString.payload[k])});
  if (debugString.payload.clue) debugString.payload.clue = resolveClue(debugString.payload.clue);
  debugString = JSON.stringify(debugString);
  console.error(debugString);
  oldConsole("#~#~#",debugString);

  if (action === "serverTurn") {
    if (!turnActionComplete)
      throw new Error("Turn is not complete! Cannot move on to next turn.");
    turnActionComplete = false;
  }

  // Server tracking
  console.log=(...dat)=>oldConsole("[SERVER]",...dat);
  server[action](payload);

  // Clients
  players.forEach((player,pi)=>{
    console.log=(...dat)=>oldConsole(`[P${pi}]`,...dat);
    if (pi!==i)
      player[action](payload);
    else
      player[action](payload2);
  })

  // Reset
  console.log=(...dat)=>oldConsole(`[NONE]`,...dat);
  verifyHandsValid();
  busyAnnoucing = false;
  if (outgoingQueue.length>0)
    announceAll(...outgoingQueue.splice(0,1)[0]);
}



/* ################ GAME ACTIONS ################ */

function playerDraw(playerIndex) {
  // No cards left; dont draw.
  if (order === cards.length) return;

  // Get card
  const {suitIndex, rank} = cards[order];
  const trueMask = server.cardMasks[suitIndex][rank];
  // Create payloads
  const payload = {order, playerIndex, suitIndex, rank};
  const payload2 = {order, playerIndex, suitIndex:-1, rank:-1};
  // Mark that this card has been dealt.
  order++;
  if (order === cards.length)
    server.turnsLeft = playerNames.length+1;
  // Send the updates
  announceAll("serverDraw", playerIndex, payload, payload2);

}

function clientClue(from,to,colorIndex,rank){
  if (turnActionComplete) throw new Error("Turn is already complete! Move to next turn before trying to clue!");
  const isColorClue = !rank;
  const type = isColorClue?0:1;
  assert("Must have clue tokens", server.tokens>=1, {tokens:server.tokens});
  assert("Clue must target a player", server.hands[to], {playerCt:playerNames.length,from,to,colorIndex,rank});
  clueMask = server.clueMasks[type][isColorClue?colorIndex:rank];
  oldConsole(`[server] Target Hand ${resolvePlayer(to)}: ${server.hands.map(c=>resolveOrder(c.order))}`);
  const touchedCards = server.hands[to].filter(card => card.public & clueMask).map(a=>a.order);
  console.log(`[server] Cards touched: ${touchedCards.map(resolveOrder)}`);
  assert("Clue must touch at least one card", touchedCards.length>0, {touchedCards});
  announceAll("serverClue", null, {clue:{type,value:isColorClue?colorIndex:rank},giver:from,target:to,list:touchedCards});
  // {"type":"clue","clue":{"type":1,"value":4},"giver":0,"list":[13],"target":3,"turn":0},

  turnActionComplete = true;
  if (autoStep) step();
}

function clientPlay(playerIndex,order) {
  if (turnActionComplete) throw new Error("Turn is already complete! Move to next turn before trying to play!");
  const card = cards[order];
  const {suitIndex, rank} = card;
  assert("Player must own the card they are trying to play", server.hands[playerIndex].find(c=>c.order===order), {playerIndex,order,hand:server.hands[playerIndex].map(c=>resolveOrder(c.order))});
  const success = server.playable & server.cardMasks[suitIndex][rank];
  if (success) {
    announceAll("serverPlay", null, {order, playerIndex, suitIndex, rank}); // TODO: fix for TIIAH
    if (server.playable === 0n)
      announceAll("serverGameOver",null,{reason:"Everything playable has been played."});
  } else {
    // announceAll("serverStrike");
    // announceAll("serverDiscard");
    console.log("Strike not implemented");
    throw new Error("Strike not implemented!");
  }

  playerDraw(playerIndex);
  turnActionComplete = true;
  if (autoStep) step();
}

function clientDiscard(playerIndex,order) {
  if (turnActionComplete) throw new Error("Turn is already complete! Move to next turn before trying to discard!");
  const card = cards[order];
  const {suitIndex, rank} = card;
  assert("Player must own the card they are trying to discard", server.hands[playerIndex].find(c=>c.order===order), {playerIndex,order,hand:server.hands[playerIndex].map(c=>resolveOrder(c.order))});
  announceAll("serverDiscard", null, {playerIndex, order, suitIndex, rank, failed:false});
  // {"type":"discard","playerIndex":2,"order":8,"suitIndex":2,"rank":1,"failed":false},

  playerDraw(playerIndex);
  turnActionComplete = true;
  if (autoStep) step();
}




























main();
























