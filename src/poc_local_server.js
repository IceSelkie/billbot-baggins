sha256 = buff => require("crypto").createHash("sha256").update(buff).digest("hex");
fs = require("fs");null
eval("" + fs.readFileSync("variants_POC_generate.js"));
GameState = eval("" + fs.readFileSync("subcall_gamestate.js"));
RemoteProxy = eval("" + fs.readFileSync("poc_remote_proxy.js"));
CoxAI = eval("" + fs.readFileSync("subcall_hatguess_cox.js"));
eval("" + fs.readFileSync("hatguess_POC_display.js"));
multiplicitiesToMaskList = (m) => { m = m[0].map((_, i) => m.map(b => b[i])).flat(); let qtys = new Array(m.reduce((c, n) => Math.max(c, n), 0) + 1).fill(null).map((_, i) => i); return qtys.map(q => m.map(v => v === q).map((v, i) => v ? 1n << BigInt(i) : 0n).reduce((c, n) => c | n, 0n)) }
DEBUG = false;
oldConsole = console.log;

function assert(message, bool, object) {
  if (!bool)
    throw new Error(message+(object?" "+JSON.stringify(object):""));
}


// Expect 8189e7
class LocalServer {
constructor() {
this.turnActionComplete = false;
this.autoStep = false;

/* ################ GAME SPECIFICS ################ */
this.vari = variants.find(a=>a.id === 180);null
this.dvari = v.find(a=>a.id === 180);null
this.playerNames = ["local-2","local-1","local-4","local-3"];
this.handSize = 4;
this.server = new GameState(this.vari, this.dvari, this.playerNames, -1); this.server.isServer = true;

// seed 'p4v180s1'
this.cards = [{"suitIndex":3,"rank":5},{"suitIndex":0,"rank":3},{"suitIndex":0,"rank":3},{"suitIndex":0,"rank":4},{"suitIndex":2,"rank":1},{"suitIndex":0,"rank":2},{"suitIndex":5,"rank":2},{"suitIndex":2,"rank":3},{"suitIndex":2,"rank":1},{"suitIndex":3,"rank":3},{"suitIndex":3,"rank":4},{"suitIndex":4,"rank":3},{"suitIndex":5,"rank":3},{"suitIndex":2,"rank":4},{"suitIndex":5,"rank":2},{"suitIndex":0,"rank":5},{"suitIndex":2,"rank":5},{"suitIndex":1,"rank":1},{"suitIndex":1,"rank":1},{"suitIndex":4,"rank":3},{"suitIndex":2,"rank":2},{"suitIndex":5,"rank":4},{"suitIndex":1,"rank":3},{"suitIndex":3,"rank":4},{"suitIndex":0,"rank":4},{"suitIndex":3,"rank":3},{"suitIndex":5,"rank":4},{"suitIndex":5,"rank":1},{"suitIndex":1,"rank":1},{"suitIndex":5,"rank":1},{"suitIndex":5,"rank":3},{"suitIndex":0,"rank":2},{"suitIndex":4,"rank":1},{"suitIndex":4,"rank":4},{"suitIndex":2,"rank":3},{"suitIndex":5,"rank":1},{"suitIndex":2,"rank":2},{"suitIndex":4,"rank":2},{"suitIndex":4,"rank":1},{"suitIndex":1,"rank":3},{"suitIndex":4,"rank":2},{"suitIndex":1,"rank":4},{"suitIndex":5,"rank":5},{"suitIndex":4,"rank":1},{"suitIndex":3,"rank":1},{"suitIndex":1,"rank":2},{"suitIndex":1,"rank":2},{"suitIndex":3,"rank":2},{"suitIndex":1,"rank":5},{"suitIndex":4,"rank":4},{"suitIndex":3,"rank":2},{"suitIndex":3,"rank":1},{"suitIndex":1,"rank":4},{"suitIndex":4,"rank":5},{"suitIndex":0,"rank":1},{"suitIndex":2,"rank":1},{"suitIndex":3,"rank":1},{"suitIndex":2,"rank":4},{"suitIndex":0,"rank":1},{"suitIndex":0,"rank":1}];
this.order = 0;

/* ################ SET UP PLAYERS ################ */
this.players = this.playerNames.map((_,pi)=>{
  let gameState = new GameState(this.vari, this.dvari, this.playerNames, pi);
  // Set AI to hat guessing
  gameState.ai = new CoxAI(gameState);
  // Add listeners for when the AI takes actions
  gameState.clientPlay=(order)=>{console.log("Play attempted by "+pi,{order}); this.clientPlay(pi,order)};
  gameState.clientDiscard=(order)=>{console.log("Discard attempted by "+pi,{order}); this.clientDiscard(pi,order)};
  gameState.clientClue=({playerIndex,colorIndex,rank})=>{console.log(`Clue ${rank?"Rank":"Color"} attempted by ${pi} ${JSON.stringify({playerIndex,colorIndex,rank})}`); this.clientClue(pi,playerIndex,colorIndex,rank)};
  gameState.clientClueColor=(playerIndex,colorIndex)=>{console.log("Clue Color attempted by "+pi,{playerIndex,colorIndex}); this.clientClue(pi,playerIndex,colorIndex,null)};
  gameState.clientClueRank=(playerIndex,rank)=>{console.log("Clue Rank attempted by "+pi,{playerIndex,rank}); this.clientClue(pi,playerIndex,null,rank)};
  return gameState;
});

this.outgoingQueue = [];
this.busyAnnoucing = false;
}

/* ################ HELPERS ################ */
resolveOrder(o) { return this.cards[o]?`c${o}=${this.server.suits[this.cards[o].suitIndex]}${this.cards[o].rank}`:`c${o}=UNKNOWN` }
resolvePlayer(pi) { return `p${pi}~${this.playerNames[pi]}` }
resolveClue({type,value}) { return `${type?"rank":"color"}${value}~${type?String(value):this.server.clueColors[value]}` }




/* ################ GENERAL TIMING AND ASSURANCE ################ */
main() {
  // Deal starting cards (last card dealt triggers first player to try to play)
  this.playerNames.forEach((_,playerIndex)=>{
    for (let i=0; i<this.handSize; i++)
      this.playerDraw(playerIndex);
  });

  // Run game to completion
  while (this.step()) {};

  // Output Score:
  console.error("Players scored "+this.server.playPile.flat().length+"!");
  // Expect 28 points for this seed and AI.

  let gameHash=(server,doHash=true)=>(doHash?sha256:a=>a)([
      JSON.stringify({turn:server.turn,tokens:server.tokens,strikes:server.strikes,gameOver:server.gameOver}),
      server.hands.map(a=>a.map(c=>c.order)).join("|"),
      server.playPile.map(a=>a.map(c=>c.order+"."+c.suitIndex+c.rank)).join(),
      server.discardPile.map(c=>c.order+"."+c.suitIndex+c.rank).join()
    ].join("\n"));

  console.log(gameHash(this.server).slice(0,6));
  this.players.forEach(p=>console.log(gameHash(p).slice(0,6)));
}

// Let stepping forward be its own function for easier debugging
step() {
  console.log(`Queueing next step/turn.`);
  if (this.server.turnsLeft === 0) {
    this.announceAll("serverGameOver",null,{reason:"Ran out of turns"});
    return false;
  } else {
    this.announceAll("serverTurn",null,{num:this.server.turn,currentPlayerIndex:(this.server.currentPlayerIndex+1)%this.playerNames.length});
    // {"type":"turn","num":1,"currentPlayerIndex":1},
    return true;
  }
}

// Do some simple validation checks on the hands to detect mistakes nearer to when they occur.
verifyHandsValid() {
  const mismatchedIdentities = this.players.map((player,pi)=>
    player.hands.map((hand,hi)=>
      hand.map((card,ci)=>{
        const serverCard = this.server.hands[hi][ci];
        // player's knowledge disagrees with ground truth (or the order of cards in hand has changed)
        if (!(card.public & serverCard.public) || card.order!==serverCard.order) {
          return {pi, hi, ci, card, trueCard:this.resolveOrder(this.server.hands[hi][ci].order)};
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
announceAll=(action, i, payload, payload2)=>{
  if (this.busyAnnoucing) {
    const index = this.outgoingQueue.push([action,i,payload,payload2]);
    oldConsole("[NONE]","Queued an announcement of:",{action,i},"Place in line:",index);
    return;
  }
  this.busyAnnoucing = true;

  let debugString = JSON.parse(JSON.stringify({action,payload}));
  if (debugString.payload.order!==undefined) debugString.payload.order = this.resolveOrder(debugString.payload.order);
  if (debugString.payload.list) debugString.payload.list = debugString.payload.list.map(c=>this.resolveOrder(c));
  ["playerIndex","giver","target"].forEach(k=>{if(debugString.payload[k]!==undefined)debugString.payload[k]=this.resolvePlayer(debugString.payload[k])});
  if (debugString.payload.clue) debugString.payload.clue = this.resolveClue(debugString.payload.clue);
  debugString = JSON.stringify(debugString);
  console.error(debugString);
  oldConsole("#~#~#",debugString);

  if (action === "serverTurn") {
    if (!this.turnActionComplete)
      throw new Error("Turn is not complete! Cannot move on to next turn.");
    this.turnActionComplete = false;
  }

  // Server tracking
  console.log=(...dat)=>oldConsole("[SERVER]",...dat);
  this.server[action](payload);

  // Clients
  this.players.forEach((player,pi)=>{
    console.log=(...dat)=>oldConsole(`[P${pi}]`,...dat);
    if (pi!==i)
      player[action](payload);
    else
      player[action](payload2);
  })

  // Reset
  console.log=(...dat)=>oldConsole(`[NONE]`,...dat);
  this.verifyHandsValid();
  this.busyAnnoucing = false;
  if (this.outgoingQueue.length>0)
    this.announceAll(...this.outgoingQueue.splice(0,1)[0]);
}



/* ################ GAME ACTIONS ################ */

playerDraw(playerIndex) {
  const {order, cards} = this;
  // No cards left; dont draw.
  if (order === cards.length) return;

  // Get card
  const {suitIndex, rank} = cards[order];
  const trueMask = this.server.cardMasks[suitIndex][rank];

  // Create payloads
  const payload = {order, playerIndex, suitIndex, rank};
  const payload2 = {order, playerIndex, suitIndex:-1, rank:-1};

  // Mark that this card has been dealt.
  this.order++;
  if (this.order === cards.length)
    this.server.turnsLeft = this.playerNames.length+1;

  // Send the updates
  this.announceAll("serverDraw", playerIndex, payload, payload2);
}

clientClue(from,to,colorIndex,rank){
  if (this.turnActionComplete) throw new Error("Turn is already complete! Move to next turn before trying to clue!");
  const isColorClue = !rank;
  const type = isColorClue?0:1;
  assert("Must have clue tokens", this.server.tokens>=1, {tokens:this.server.tokens});
  assert("Clue must target a player", this.server.hands[to], {playerCt:this.playerNames.length,from,to,colorIndex,rank});
  const clueMask = this.server.clueMasks[type][isColorClue?colorIndex:rank];
  oldConsole(`[server] Target Hand ${this.resolvePlayer(to)}: ${this.server.hands.map(c=>this.resolveOrder(c.order))}`);
  const touchedCards = this.server.hands[to].filter(card => card.public & clueMask).map(a=>a.order);
  console.log(`[server] Cards touched: ${touchedCards.map(c=>this.resolveOrder(c))}`);
  assert("Clue must touch at least one card", touchedCards.length>0, {touchedCards});
  this.announceAll("serverClue", null, {clue:{type,value:isColorClue?colorIndex:rank},giver:from,target:to,list:touchedCards});
  // {"type":"clue","clue":{"type":1,"value":4},"giver":0,"list":[13],"target":3,"turn":0},

  this.turnActionComplete = true;
}

clientPlay(playerIndex,order) {
  if (this.turnActionComplete) throw new Error("Turn is already complete! Move to next turn before trying to play!");
  const card = this.cards[order];
  const {suitIndex, rank} = card;
  assert("Player must own the card they are trying to play", this.server.hands[playerIndex].find(c=>c.order===order), {playerIndex,order,hand:this.server.hands[playerIndex].map(c=>this.resolveOrder(c.order))});
  const success = this.server.playable & this.server.cardMasks[suitIndex][rank];
  if (success) {
    this.announceAll("serverPlay", null, {order, playerIndex, suitIndex, rank}); // TODO: fix for TIIAH
    if (this.server.playable === 0n)
      this.announceAll("serverGameOver",null,{reason:"Everything playable has been played."});
  } else {
    // this.announceAll("serverStrike");
    // this.announceAll("serverDiscard");
    console.log("Strike not implemented");
    throw new Error("Strike not implemented!");
  }

  this.playerDraw(playerIndex);
  this.turnActionComplete = true;
}

clientDiscard(playerIndex,order) {
  if (this.turnActionComplete) throw new Error("Turn is already complete! Move to next turn before trying to discard!");
  const card = this.cards[order];
  const {suitIndex, rank} = card;
  assert("Player must own the card they are trying to discard", this.server.hands[playerIndex].find(c=>c.order===order), {playerIndex,order,hand:this.server.hands[playerIndex].map(c=>this.resolveOrder(c.order))});
  this.announceAll("serverDiscard", null, {playerIndex, order, suitIndex, rank, failed:false});
  // {"type":"discard","playerIndex":2,"order":8,"suitIndex":2,"rank":1,"failed":false},

  this.playerDraw(playerIndex);
  this.turnActionComplete = true;
}

}



























new LocalServer().main();
























