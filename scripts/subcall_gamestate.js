
emptyArrays=(n)=>new Array(n).fill(null).map(_=>[]);

// Currently works with:
//  - WS Games as history
// Currently does NOT work with:
//  - TIIAH
//  - Database JSONgame-s (adapter needed)
// Other known issues:
//  - Sudoku playable cards don't get updated correctly
//  - Discarding a critcal doesnt correctly update trash or playable
class GameState {
  constructor(vari, dvari, playerNames, ourPlayerIndex=-1) {
    if (vari instanceof String || typeof vari === 'string') {
      console.log('input',{playerNames,ourPlayerIndex});
      ourPlayerIndex = playerNames??-1; playerNames = dvari;
      dvari =       v.find(a=>a.name===vari || a.id==vari);
      vari = variants.find(a=>a.name===vari || a.id==vari);
      console.log('saved',{playerNames,ourPlayerIndex});
    }
    this.ai = null;
    this.variant = vari; // has flags and card information
    this.dvari = dvari; // has general mask info
    this.numPlayers = playerNames.length;
    this.playerNames = playerNames;

    this.currentPlayerIndex = -1; // start at -1 so first turn increments to 0
    this.ourPlayerIndex = ourPlayerIndex;
    this.shouldPlay = ourPlayerIndex!==-1;

    this.suits = [...dvari.suits];
    this.ranks = [...dvari.ranks];
    this.clueColors = [...dvari.clueColors];
    this.clueRanks = [...dvari.clueRanks];
    this.tokensPerDiscard = (vari.clueStarved ? 0.5 : 1);

    this.cardMasks = emptyArrays(this.suits.length);
    this.clueMasks = [[],[]];
    this.cardMaskUnknown = BigInt(dvari.cardMaskUnknown);

    this.turn = 0;
    this.tokens= 8;
    this.strikes= 0;
    this.gameOver = null;

    this.discardPile = [];
    this.playPile = emptyArrays(this.suits.length);
    this.hands = emptyArrays(this.numPlayers);

    this.playable= 0n;
    this.trash= 0n;
    this.publicMultiplicities = emptyArrays(this.suits.length);
    this.privateMultiplicities = emptyArrays(this.suits.length);

    dvari.cardMasks.split(",").map(a=>a.split(":")).map(([[s,r],mask])=>{this.cardMasks[this.suits.indexOf(s)][r]=BigInt(mask)});
    dvari.clueMasks.split(",").map(t=>t.split(":")).map(([c,mask])=>{
      if (this.suits.includes(c))
        this.clueMasks[0][this.suits.indexOf(c)] = BigInt(mask);
      else
        this.clueMasks[1][c] = BigInt(mask);
    });
    dvari.cards.split(",").map(([s,r])=>{
      let suitIndex = this.suits.indexOf(s);
      this.privateMultiplicities[suitIndex][r] =
      this.publicMultiplicities[suitIndex][r] = (this.publicMultiplicities[suitIndex][r]??0)+1;
    });

    this.playable = this.variant.suits.map(suit=>
      this.variant.sudoku?
        this.ranks:
      this.variant.upOrDown?
        [1,5,7]:
      suit.reversed?
        [5]:
      [1]
    ).flatMap((ranks,suitIndex)=>
      ranks.map(rank=>this.cardMasks[suitIndex][rank])
    ).reduce((c,n)=>c|n,0n);
    this.trash = 0n;
  }

  serverTurn(action){
    if (action?.currentPlayerIndex === -1) return;
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    this.turn++;
    this.currentPlayerIndex = (this.currentPlayerIndex+1)%this.numPlayers;
    console.log("Turn increments to turn",this.turn,'which is now player',this.currentPlayerIndex, `(${this.playerNames[this.currentPlayerIndex]})'s turn.`);
    if (this.currentPlayerIndex == this.ourPlayerIndex) {
      console.log('It is now our turn...');
      if (!this.shouldPlay)
        console.log("Skipping, since we are in replay/history.");
      else if (!this.ai)
        console.log("I'm missing my brain... I don't know how to play...");
      else
        this.ai.playerTurn();
    }
  }
  updatePlayable(card){
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    let cardMask = this.cardMasks[card.suitIndex][card.rank];
    let suitMask = this.cardMasks[card.suitIndex].filter(a=>a).reduce((c,n)=>c|n,0n);
    let played = this.playPile[card.suitIndex].map(a=>a.rank).join("");

    let sequences = (this.variant.upOrDown?["12345","72345","54321","74321"]:this.sudoku?(this.ranks.length==4?["1234","2341","3412","4123"]:["12345","23451","34512","45123","51234"]):this.variant.suits[card.suitIndex].reversed?["54321"]:["12345"]);
    sequences = sequences.filter(s=>s.startsWith(played)).map(a=>a.slice(played.length)).filter(a=>a.length>0);

    let nextPlayable = sequences.map(a=>a[0]).map(a=>this.cardMasks[card.suitIndex][a]).reduce((c,n)=>c|n,0n);
    let eventuallyPlayable = sequences.flatMap(a=>a[0]).map(a=>this.cardMasks[card.suitIndex][a]).reduce((c,n)=>c|n,0n);

    this.playable = this.playable - (this.playable&suitMask) + nextPlayable;
  }

  serverDraw({order, playerIndex, suitIndex, rank}) {
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    const card = { order, suitIndex, rank , public:this.cardMaskUnknown };
    this.hands[playerIndex].push(card);

    // Update private multiplicities
    if (suitIndex !== -1)
      this.privateMultiplicities[suitIndex][rank]--;

    // Last Player's hand is now full -> now its time for first player to play!
    // This might not be needed for live games... tbd
    if (this.turn===0 && playerIndex === this.numPlayers-1)
      if (this.hands[playerIndex].length === this.hands[0].length)
        this.serverTurn();
  }

  serverDiscard({order, playerIndex, suitIndex, rank}) {
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    let hand = this.hands[playerIndex];
    let card = hand.find(c=>c.order === order);
    let cardIndex = hand.indexOf(card);
    hand.splice(cardIndex,1);
    this.discardPile.push(card);
    this.tokens += this.tokensPerDiscard;

    // If card identity is now known, update things:
    if (suitIndex !== -1) {

      // update private multiplicities
      if (card.suitIndex === -1)
        this.privateMultiplicities[suitIndex][rank]--;

      // update public multiplicities
      if (card.public !== this.cardMasks[suitIndex][rank]) {
        this.publicMultiplicities[suitIndex][rank]--;
        card.public = this.cardMasks[suitIndex][rank];
      }

      // Update private knowledge with card identity
      card.suitIndex = suitIndex;
      card.rank = rank;
    }

    // update eventually playable (may update playable and trash)
  }

  serverPlay({order, playerIndex, suitIndex, rank}) {
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    let hand = this.hands[playerIndex];
    let card = hand.find(c=>c.order === order);
    let cardIndex = hand.indexOf(card);
    hand.splice(cardIndex,1);
    this.playPile[suitIndex].push(card);

    // Update public knowledge with card identity
    if (suitIndex !== -1) {
      card.suitIndex = suitIndex;
      card.rank = rank;
      // update tokens if visible
      if (this.playPile[suitIndex].length === (this.variant.sudoku?this.ranks.length:5))
        this.tokens += this.tokensPerDiscard;
    }

    // update public multiplicities
    // update playable
    this.updatePlayable(card);
    // update trash (simple)
    if (suitIndex !== -1)
      this.trash |= this.cardMasks[suitIndex][rank];
  }

  // clue
  serverClue({clue, target, list}) {
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    this.tokens--;

    // Do Hatguessing Logic Here
    if (this.ai)
      this.ai.playerInterpretClue({clue,target,list});

    // update card (cant update anything else)
    let hand = this.hands[target];
    let mask = this.clueMasks[clue.type][clue.value];
    hand.filter(a=>list.includes(a.order)).forEach(card=>{card.public &= mask; card.touched=true;});
    hand.filter(a=>!list.includes(a.order)).forEach(card=>card.public = card.public-(card.public&mask));
    hand.filter(a=>bits(a.public)===1).forEach(card=>{
      let suit = this.cardMasks.find(suit=>suit.find(rankMask=>rankMask===card.public));
      card.suitIndex = this.cardMasks.indexOf(suit);
      card.rank = suit.indexOf(card.public);
    })
  }

  // end game
  serverGameOver(action) {
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    // lock the game
    this.gameOver = action;
    // display end message
    console.log("Game has ended!",action);
  }

  // strike
  serverStrike({num}){
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    this.strikes++;
    if (this.strikes!==num)
      throw new Error(`Local strike count ${this.strikes} and server strike count (${num}) do not match!`);
    
    // The associated discard isn't real
    this.tokens -= this.tokensPerDiscard;
  }

  // ensure turn counter, strikes, clues, timing, etc. are still up to date
  serverAction(action){
    console.log("Passed action with",action.type);
    if (action.type==="draw")
      this.serverDraw(action);
    if (action.type==="play")
      this.serverPlay(action);
    if (action.type==="clue")
      this.serverClue(action);
    if (action.type==="discard")
      this.serverDiscard(action);
    if (action.type==="strike")
      this.serverStrike(action);

    if (action.type==="status")
    //   this.serverStatus(action);
      console.log(`Current state:`,JSON.stringify({turn:this.turn, tokens:this.tokens, strikes:this.strikes, playable:bits(this.playable), trash:bits(this.trash), playPile:this.playPile.map(a=>a?.length), discardPile:this.discardPile.length,hands:this.hands.map(hand=>hand.map(c=>bits(c.public)))}));
    if (action.type==="gameOver")
      this.serverGameOver(action);
    if (action.type==="turn")
      this.serverTurn(action);
  }
  serverActionList(actionList) {
    const shouldPlay = this.shouldPlay;
    this.shouldPlay = false;
    actionList.forEach((action,i)=>{
      // reenable actions on last action
      if (i == actionList.length-1) this.shouldPlay = shouldPlay;
      this.serverAction(action);
    });
  }

  clientPlay({order}){throw new Error('Method "clientPlay" not implemented');}
  clientDiscard({order}){throw new Error('Method "clientDiscard" not implemented');}
  clientClue({target, clue}){throw new Error('Method "clientClue" not implemented');}
}








bits=(int)=>{
  int = BigInt(int);
  let ret=0n;
  while (int) {
    ret += int%2n;
    int>>=1n;
  }
  return Number(ret);
}

// fs=require("fs");
// eval(""+fs.readFileSync("variants_POC_generate.js"));
// let game = Object.fromEntries(JSON.parse(fs.readFileSync("wshistory/"+fs.readdirSync("wshistory").filter(a=>a.startsWith("c")&&a.endsWith("_11.json"))[0])).filter(a=>"init gameActionList cardIdentities noteList".split(" ").find(b=>a.startsWith(b))).map(a=>{let ind=a.indexOf(" ");return [a.slice(0,ind),JSON.parse(a.slice(ind))]}));

// // game.init.options.variantName;
// // game.init.playerNames;
// // game.gameActionList.list;
// // game.cardIdentities.cardIdentities;

// let gs = new GameState(
//   variants.find(a=>a.name===game.init.options.variantName),
//   v.find(a=>a.name===game.init.options.variantName),
//   game.init.playerNames
// );


// for (let i=0; i<game.gameActionList.list.length; i++) {
//   let action = game.gameActionList.list[i];

//   let {turn, tokens, strikes, playable, trash, playPile, discardPile, hands} = gs;

//   // turn tokens strikes bits(playable), bits(trash), playpile length, discardPile.length;

//   console.log(`Sending ${action.type}...`, JSON.stringify(action));

//   if (action.type==="draw")
//     gs.serverDraw(action);
//   if (action.type==="play")
//     gs.serverPlay(action);
//   if (action.type==="clue")
//     gs.serverClue(action);
//   if (action.type==="discard")
//     gs.serverDiscard(action);
//   if (action.type==="strike")
//     gs.serverStrike(action);

//   if (action.type==="status")
//   //   gs.serverStatus(action);
//     console.log(`Current state:`,JSON.stringify({turn, tokens, strikes, playable:bits(playable), trash:bits(playable), playPile:playPile.map(a=>a?.length), discardPile:discardPile.length,hands:hands.map(hand=>hand.map(c=>bits(c.public)))}));
//   if (action.type==="gameOver")
//     gs.serverGameOver(action);
//   if (action.type==="turn")
//     gs.serverTurn(action);
// }


GameState;



































