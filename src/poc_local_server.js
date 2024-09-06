sha256 = buff => require("crypto").createHash("sha256").update(buff).digest("hex");
fs = require("fs");null
eval("" + fs.readFileSync("variants_POC_generate.js"));
GameState = eval("" + fs.readFileSync("subcall_gamestate.js"));
RemoteProxy = eval("" + fs.readFileSync("poc_remote_proxy.js"));
CoxAI = eval("" + fs.readFileSync("subcall_hatguess_cox.js"));
eval("" + fs.readFileSync("hatguess_POC_display.js"));
multiplicitiesToMaskList = (m) => { m = m[0].map((_, i) => m.map(b => b[i])).flat(); let qtys = new Array(m.reduce((c, n) => Math.max(c, n), 0) + 1).fill(null).map((_, i) => i); return qtys.map(q => m.map(v => v === q).map((v, i) => v ? 1n << BigInt(i) : 0n).reduce((c, n) => c | n, 0n)) }
crc64 = require("crc64-ecma").crc64;
GoLangPRNG = require("./golang/rand.js");
DEBUG = false;

function assert(message, bool, object) {
  if (!bool)
    throw new Error(message+(object?" "+JSON.stringify(object):""));
}

oldConsole = console.log;

class LocalServer {
  constructor(vari, dvari, seed = '1', playerNames = ["local-2","local-1","local-4","local-3"]) {
    this.vari = vari;
    this.dvari = dvari;

    this.playerNames = playerNames;
    let numP = playerNames.length;
    this.handSize = [null,null,5,5,4,4,3][numP];
    this.seed = `p${playerNames.length}v${this.vari.id}s${seed}`;
    this.cards = LocalServer.shuffleDeckFromSeed(this.dvari, this.seed).map(([s,r])=>{return {suitIndex:dvari.suits.indexOf(s), rank:Number(r)}});

    this.server = new GameState(this.vari, this.dvari, this.playerNames, -1); this.server.isServer = true;

    this.order = 0;
    this.turnActionComplete = false;

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

  static shuffleDeckFromSeed(dvari, seed) {
    const cards = dvari.cards.split(",");
    const rand = new GoLangPRNG();
    rand.Seed(crc64(seed));

    for (let i=0; i<cards.length; i++) {
      let j = rand.Intn(i+1);
      [cards[i],cards[j]] = [cards[j],cards[i]];
    }

    return cards;
  }



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
    this.strikes = this.server.strikes;
    this.score = this.strikes===3?0:this.server.playPile.flat().length;
    // console.error("Players scored "+this.score+"!");

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
    } else if (this.server.strikes === 3) {
      this.announceAll("serverGameOver",null,{reason:"Bombed"});
      return false;
    } else if (this.server.playable === 0n) {
      this.announceAll("serverGameOver",null,{reason:"No more cards are playable"});
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

module.exports = LocalServer;



















function testGame(vid=0, playerCt=4, seed=1) {
  let vari = variants.find(a=>a.id==vid);
  let dvari = v.find(a=>a.id==vid);
  let playerNames = [..."ABCDEF".slice(0,playerCt)];
  let game = new LocalServer(vari, dvari, seed, playerNames);
  game.main();
  return game;
}

function testThousand(vid = 180, playerCt=4, qty=1000, offset=0) {
  let playerNames = [..."ABCDEF".slice(0,playerCt)];
  let vari = variants.find(a=>a.id==vid);
  let dvari = v.find(a=>a.id==vid);
  let ret = {variant:vari.name,averageScore:null, scores:[], crashed:[], zero:[], lowestScore:1e6, lowest:[], highestScore:-1, highest:[]};
  let nextAnnounce = +new Date()+1000;

  for (let i=0; i<qty; i++) {
    let game = new LocalServer(vari, dvari, i+offset, playerNames);
    try {
      game.main();
      ret.scores[game.score] = (ret.scores[game.score]??0) + 1;

      let earliestWinOrdering = (game.score*1000 + (game.cards.length-game.order))*1000 + (game.server.turnsLeft+1)
      console.error({score:game.score, cardsUndealt:game.cards.length-game.order, turnsLeft:game.server.turnsLeft});
      // console.error(earliestWinOrdering);
      if (game.score < ret.lowestScore) { ret.lowestScore = game.score; ret.lowest = []; }
      if (game.score == ret.lowestScore) ret.lowest.push(game.seed);
      if (earliestWinOrdering > ret.highestScore) { ret.highestScore = earliestWinOrdering; ret.highest = game.seed; }
    } catch (e) {
      if (ret.crashed!==undefined) ret.crashed = [];
      ret.crashed.push(game.seed);
    }
    if (nextAnnounce < +new Date()) {
      nextAnnounce = +new Date() + 1000;
      console.error(`Just finished game ${i+1} of ${qty} (${game.seed})`);
    }
  }
  ret.scores = Object.entries(ret.scores);
  console.error(ret.scores); // [ ["0", 1], ["25", 3] ]
  ret.averageScore = ret.scores.reduce((c,[k,v])=>c+(Number(k)*v),0) / qty;
  ret.scores = Object.fromEntries(ret.scores);
  ret.highestScore = {score:Math.round(ret.highestScore/1e6), cardsLeft:-Math.round(ret.highestScore/1e3)%1000, endGameTurnsLeft:ret.highestScore%1000};
  return ret;
}



console.error(JSON.stringify(testThousand(0, 4, 1000),null,2));




















