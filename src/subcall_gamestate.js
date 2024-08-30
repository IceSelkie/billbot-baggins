emptyArrays = (n) => new Array(n).fill(null).map(_ => []);

// Currently works with:
//  - WS Games as history
// Currently does NOT work with:
//  - TIIAH
//  - Database JSONgame-s (adapter needed)
// Other known issues:
//  - Sudoku playable cards don't get updated correctly
//  - Discarding a critcal doesnt correctly update trash or playable
class GameState {
  constructor(vari, dvari, playerNames, ourPlayerIndex = -1) {
    if (vari instanceof String || typeof vari === 'string') {
      ourPlayerIndex = playerNames ?? -1; playerNames = dvari;
      dvari = v.find(a => a.name === vari || a.id == vari);
      vari = variants.find(a => a.name === vari || a.id == vari);
    }
    this.ai = null;
    this.variant = vari; // has flags and card information
    this.dvari = dvari; // has general mask info
    this.numPlayers = playerNames.length;
    this.playerNames = playerNames;

    this.currentPlayerIndex = -1; // start at -1 so first turn increments to 0
    this.ourPlayerIndex = ourPlayerIndex;
    this.isServer = false;
    this.shouldPlay = ourPlayerIndex !== -1;

    this.suits = [...dvari.suits];
    this.ranks = [...dvari.ranks];
    this.clueColors = [...dvari.clueColors];
    this.clueRanks = [...dvari.clueRanks];
    this.tokensPerDiscard = (vari.clueStarved ? 0.5 : 1);

    this.cardMasks = emptyArrays(this.suits.length);
    this.clueMasks = [[], []];
    this.clueMasksStr = {};
    this.cardMaskUnknown = BigInt(dvari.cardMaskUnknown);

    this.turn = 0;
    this.tokens = 8;
    this.strikes = 0;
    this.turnsLeft = null;
    this.gameOver = null;

    this.discardPile = [];
    this.playPile = emptyArrays(this.suits.length);
    this.hands = emptyArrays(this.numPlayers);

    this.playable = 0n; // could be a "nFromPlayable" as an array of masks
    this.trash = 0n;
    this.critical = 0n; // Will be updated in updateEmpathy before it is used
    this.publicMultiplicities = emptyArrays(this.suits.length);
    this.privateMultiplicities = emptyArrays(this.suits.length);
    this.unplayedMultiplicities = emptyArrays(this.suits.length);

    dvari.cardMasks.split(",").map(a => a.split(":")).map(([[s, r], mask]) => { this.cardMasks[this.suits.indexOf(s)][r] = BigInt(mask) });
    dvari.clueMasks.split(",").map(t => t.split(":")).map(([c, mask]) => {
      this.clueMasksStr[c] = BigInt(mask);
      if (this.suits.includes(c))
        this.clueMasks[0][this.suits.indexOf(c)] = BigInt(mask);
      else
        this.clueMasks[1][c] = BigInt(mask);
    });
    dvari.cards.split(",").map(([s, r]) => {
      let suitIndex = this.suits.indexOf(s);
      this.publicMultiplicities[suitIndex][r] = (this.publicMultiplicities[suitIndex][r] ?? 0) + 1;
      this.privateMultiplicities[suitIndex][r] = this.publicMultiplicities[suitIndex][r];
      this.unplayedMultiplicities[suitIndex][r] = this.publicMultiplicities[suitIndex][r];
    });
    // Update `this.critical` to initial state
    this.unplayedMultiplicities.forEach((suit,suitIndex)=>suit?.forEach((cardMultiplicity,rank)=>{
      if (cardMultiplicity === 1)
        this.critical |= this.cardMasks[suitIndex][rank];
    }));


    this.playable = this.variant.suits.map(suit =>
      this.variant.sudoku ?
        this.ranks :
        this.variant.upOrDown ?
          [1, 5, 7] :
          suit.reversed ?
            [5] :
            [1]
    ).flatMap((ranks, suitIndex) =>
      ranks.map(rank => this.cardMasks[suitIndex][rank])
    ).reduce((c, n) => c | n, 0n);
    this.trash = 0n;
  }

  serverTurn(action) {
    if (action?.currentPlayerIndex === -1) return;
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    if (this.isServer) this.displayPublicGrids("turnStart");

    this.turn++;
    if (this.turnsLeft !== null)
      this.turnsLeft--;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.numPlayers;
    console.log("Turn increments to turn", this.turn, 'which is now player', this.currentPlayerIndex, `(${this.playerNames[this.currentPlayerIndex]})'s turn.`,{shouldPlay:this.shouldPlay, isMe:this.ourPlayerIndex===this.currentPlayerIndex});
    if (this.currentPlayerIndex == this.ourPlayerIndex) {
      console.log('It is now my turn...');
      if (!this.shouldPlay)
        console.log("Skipping, since we are in replay/history.");
      else if (!this.ai)
        console.log("I'm missing my brain... I don't know how to play...");
      else {
        console.log("We are up-to-date and it is my turn!");
        this.ai.playerTurn();
      }
    }
  }
  updatePlayable(card) {
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    let cardMask = this.cardMasks[card.suitIndex][card.rank];
    let suitMask = this.cardMasks[card.suitIndex].filter(a => a).reduce((c, n) => c | n, 0n);
    let played = this.playPile[card.suitIndex].map(a => a.rank).join("");

    // What ranks can be played, and in what order(s), based on variant
    let sequences = (this.variant.upOrDown ? ["12345", "72345", "54321", "74321"] : this.variant.sudoku ? (this.ranks.length == 4 ? ["1234", "2341", "3412", "4123"] : ["12345", "23451", "34512", "45123", "51234"]) : this.variant.suits[card.suitIndex].reversed ? ["54321"] : ["12345"]);
    // Only keep the ones that match what has already been played in this suit.
    // (Eg "54321" isnt valid if "7" has already been played, and will return ["2345","4321"])
    sequences = sequences.filter(s => s.startsWith(played)).map(a => a.slice(played.length)).filter(a => a.length > 0);

    // Cards immediately playable of this rank
    let nextPlayable = sequences.map(a => a[0]).map(a => this.cardMasks[card.suitIndex][a]).reduce((c, n) => c | n, 0n);
    // Cards that can still be played in the game (eg 345 and not 127 if "12" has been played)
    let eventuallyPlayable = sequences.flatMap(a => a[0]).map(a => this.cardMasks[card.suitIndex][a]).reduce((c, n) => c | n, 0n);

    // Update this suit's playable mask.
    this.playable = this.playable - (this.playable & suitMask) + nextPlayable;

    // For sudoku, we must prevent other suits from starting with the same rank
    if (this.variant.sudoku && played.length === 1) {
      // identify suits that havent started yet
      let unstartedSuits = this.playPile.map((suitPlayPile,suitIndex)=>suitPlayPile.length===0?suitIndex:null).filter(a=>a!==null);
      // remove this rank
      unstartedSuits.forEach(suitIndex=>{
        this.playable -= this.playable & this.cardMasks[suitIndex][played];
      });
    }
  }

  serverDraw({ order, playerIndex, suitIndex, rank }) {
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    console.log(`Drawing ${order} into ${playerIndex}: [${this.hands[playerIndex].map(a=>a.order).join()}] -> [${[...this.hands[playerIndex].map(a=>a.order),order].join()}]`);

    // Spectating historical games from a point of view should still conceal the cards
    if (playerIndex === this.ourPlayerIndex) {
      suitIndex = -1; rank = -1;
    }

    const card = { order, suitIndex, rank, public: this.cardMaskUnknown, touched: false, publiclyKnown: this.isServer, privatelyKnown: this.isServer };
    this.hands[playerIndex].push(card);

    if (this.isServer)
      card.public = this.cardMasks[suitIndex][rank];

    // Update private multiplicities
    if (suitIndex !== -1) {
      this.privateMultiplicities[suitIndex][rank]--;
      card.privatelyKnown = true;
    }

    if (this.turn !== 0)
      this.updateEmpathy();

    // Last Player's hand is now full -> now its time for first player to play!
    // This might not be needed for live games... tbd
    const isStart=this.turn===0;
    const lastPlayerIsDrawing=playerIndex===this.numPlayers-1;
    const cardsPerHand=this.hands[0].length;
    const thisHandsNewSize=this.hands[playerIndex].length;
    const handIsNowFull=cardsPerHand===thisHandsNewSize;
    // console.log("Is last draw at start of game?",{isStart,lastPlayerIsDrawing,handIsNowFull,cardsPerHand,thisHandsNewSize});
    if (isStart && lastPlayerIsDrawing && handIsNowFull)
      this.serverTurn();
  }

  serverDiscard({ order, playerIndex, suitIndex, rank }) {
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    let hand = this.hands[playerIndex];
    let card = hand.find(c => c.order === order);
    let cardIndex = hand.indexOf(card);
    hand.splice(cardIndex, 1);
    this.discardPile.push(card);
    this.tokens += this.tokensPerDiscard;

    // If card identity is now known, update things:
    if (suitIndex !== -1) {

      // if we didnt know the card, update private multiplicities
      if (card.suitIndex === -1) {
        this.privateMultiplicities[suitIndex][rank]--;
        card.privatelyKnown = true;
      }

      // if everyone didnt know the card, update public multiplicities
      if (card.public !== this.cardMasks[suitIndex][rank]) {
        this.publicMultiplicities[suitIndex][rank]--;
        card.public = this.cardMasks[suitIndex][rank];
        card.publiclyKnown = true;
      }

      // Update played multiplicities regardless;
      this.updateCriticals(suitIndex, rank);

      // Update private knowledge with card identity
      card.suitIndex = suitIndex;
      card.rank = rank;
    }

    // update eventually playable (may update playable and trash)
  }

  updateEmpathy() {
    if (this.isServer) return;
    let newIdentities = 0;
    let eliminations = 0;

    this.cardMaskUnknown = this.publicMultiplicities.flatMap((sm, suitIndex) => sm.map((mult, rank) => mult ? this.cardMasks[suitIndex][rank] : 0n)).reduce((c, n) => c | n, 0n);
    // let multMaskPriv = this.privateMultiplicities.flatMap((sm,suitIndex)=>sm.map((mult,rank)=>mult?this.cardMasks[suitIndex][rank]:0n)).reduce((c,n)=>c|n,0n);

    this.displayPublicGrids("beforeEmpathy");

    this.hands.forEach((hand, hi) => {
      hand.forEach((card, ci) => {
        if (card.publiclyKnown) return;

        let newMask = card.public & this.cardMaskUnknown;
        // if (newMask != card.public) console.log(card.order,":",card.public,"->",newMask,"by subtracting",card.public-newMask);
        if (newMask === 0n) {
          console.log("####ERROR#### card & cardMaskUnknown result in no possibilities!!!",{ order: card.order, originalMask: card.public, publicMultMask: this.cardMaskUnknown, holder: `p${hi}~${this.playerNames[hi]}`, handIndex: [hi, ci], turn: this.turn });
          throw new Error("####ERROR#### card & cardMaskUnknown result in no possibilities!!!");
        }
        card.public = newMask;
        // let privateMask = card.public & multMaskPriv;

        if (bits(card.public) === 1) {
          // If its private identity is not known, update
          if (card.suitIndex === -1) {
            let suit = this.cardMasks.find(suit => suit.find(rankMask => rankMask === card.public));
            card.suitIndex = this.cardMasks.indexOf(suit);
            card.rank = suit.indexOf(card.public);
            this.privateMultiplicities[card.suitIndex][card.rank]--;
            card.privatelyKnown = true;
            if (this.privateMultiplicities[card.suitIndex][card.rank] === 0)
              eliminations++;
          }
          // Everyone now knows what this card is
          this.publicMultiplicities[card.suitIndex][card.rank]--;
          card.publiclyKnown = true;

          newIdentities++;
          if (this.publicMultiplicities[card.suitIndex][card.rank] === 0)
            eliminations++;

          if (this.privateMultiplicities[card.suitIndex][card.rank] < 0 || this.publicMultiplicities[card.suitIndex][card.rank] < 0) {
            console.log("####ERROR#### A multiplicity became negative!!! ",{ suitIndex: card.suitIndex, rank: card.rank, publicMultiplicities: this.publicMultiplicities[card.suitIndex][card.rank], privateMultiplicities: this.privateMultiplicities[card.suitIndex][card.rank], turn: this.turn });
            throw new Error("####ERROR#### A multiplicity became negative!!!");
          }
        }
      });
    });

    if (eliminations) {
      console.log(newIdentities, "new identities now known! Propogating empathy for", eliminations, "types...");
      this.updateEmpathy();
    } else {
      this.displayPublicGrids("afterEmpathy");
    }
  }

  updateCriticals(suitIndex, rank) {
    // Update stored multiplicities
    const newMultiplicity = --this.unplayedMultiplicities[suitIndex][rank];

    // If it becomes critical, update
    if (newMultiplicity === 1)
      this.critical |= this.cardMasks[suitIndex][rank];

    // Remove trash, as trash is never indispensable.
    this.critical -= this.critical & this.trash;
  }

  displayPublicGrids(when) {
    if (!global.DEBUG) return;

    console.log({publicUnknown:this.publicMultiplicities.flat().reduce((c,n)=>c+n,0),privateUnknown:this.privateMultiplicities.flat().reduce((c,n)=>c+n,0)});
    console.log("Below is [playable, trash, critical, publicMultis, privateUnrevealeds, privateMultis, publicUnknowns]\n"
        + displayRow([this.playable,this.trash,this.critical,multiplicitiesToMaskList(this.publicMultiplicities),0n,multiplicitiesToMaskList(this.privateMultiplicities),this.cardMaskUnknown],this.suits.length,this.ranks.length));

    this.hands.forEach((hand, hi) => {
      console.log(`p${hi} ${when?when+" ":""}\n`+displayRow(this.hands[hi].map(a=>a.public),this.suits.length,this.ranks.length)+(hi==this.hands.length?"\n":""));
    });
  }

  serverPlay({ order, playerIndex, suitIndex, rank }) {
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    let hand = this.hands[playerIndex];
    let card = hand.find(c => c.order === order);
    let cardIndex = hand.indexOf(card);
    hand.splice(cardIndex, 1);
    this.playPile[suitIndex].push(card);

    // If card identity is now known, update things:
    if (suitIndex !== -1) {

      // if we didnt know the card, update private multiplicities
      if (card.suitIndex === -1) {
        this.privateMultiplicities[suitIndex][rank]--;
        card.privatelyKnown = true;
      }

      // if everyone didnt know the card, update public multiplicities
      if (card.public !== this.cardMasks[suitIndex][rank]) {
        this.publicMultiplicities[suitIndex][rank]--;
        card.public = this.cardMasks[suitIndex][rank];
        card.publiclyKnown = true;
      }

      // Update played multiplicities regardless;
      this.updateCriticals(suitIndex, rank);

      // Update private knowledge with card identity
      card.suitIndex = suitIndex;
      card.rank = rank;

      // update tokens (tiiah excempt)
      if (this.playPile[suitIndex].length === (this.variant.sudoku ? this.ranks.length : 5))
        this.tokens += this.tokensPerDiscard;
      if (this.tokens > 8) {
        this.tokens = 8;
        // this.pace--;
      }
    }

    // update playable
    this.updatePlayable(card);
    // update trash (simple)
    if (suitIndex !== -1)
      this.trash |= this.cardMasks[suitIndex][rank];
  }

  // clue
  serverClue({ clue, giver, target, list }) {
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    this.tokens--;

    // Do Hatguessing Logic Here
    if (this.ai) {
      if (giver != this.currentPlayerIndex) {
        console.log(`Current state:`,JSON.stringify({turn:this.turn, ourPlayerIndex:this.ourPlayerIndex, currentPlayerIndex:this.currentPlayerIndex, tokens:this.tokens, strikes:this.strikes, playable:bits(this.playable), trash:bits(this.trash), playPile:this.playPile.map(a=>a?.length), discardPile:this.discardPile.length,hands:this.hands.map(hand=>hand.map(c=>bits(c.public)))}));
        throw new Error("Giving != Giver "+JSON.stringify({actionClueGiver:giver,currentPlayerIndex:this.currentPlayerIndex}));
      }
      this.displayPublicGrids("beforeHatguess");
      this.ai.playerInterpretClue({ clue, target, list }, giver);
      this.displayPublicGrids("afterHatguess");
    }

    // update card (cant update anything else)
    let hand = this.hands[target];
    let mask = this.clueMasks[clue.type][clue.value];
    // Apply positive information
    hand.filter(a => list.includes(a.order)).forEach(card => { card.public &= mask; card.touched = true; });
    // Apply negative information
    hand.filter(a => !list.includes(a.order)).forEach(card => card.public = card.public - (card.public & mask));

    // Update card identities and multiplicities
    this.updateEmpathy();
  }

  // end game
  serverGameOver(action) {
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    // lock the game
    this.gameOver = action;
    // display end message
    console.log("Game has ended!", action);
  }

  // strike
  serverStrike({ num }) {
    if (this.gameOver) throw new Error(`Game already ended. Cannot further update game!`);

    this.strikes++;
    if (this.strikes !== num)
      throw new Error(`Local strike count ${this.strikes} and server strike count (${num}) do not match!`);

    // The associated discard isn't real
    this.tokens -= this.tokensPerDiscard;
  }

  // ensure turn counter, strikes, clues, timing, etc. are still up to date
  serverOther() { };

  clientPlay({ order }) { throw new Error('Method "clientPlay" not implemented here. Please extend and implement.'); }
  clientDiscard({ order }) { throw new Error('Method "clientDiscard" not implemented here. Please extend and implement.'); }
  clientClue({ target, clue }) { throw new Error('Method "clientClue" not implemented here. Please extend and implement.'); }
}








bits = (int) => {
  int = BigInt(int);
  let ret = 0n;
  while (int) {
    ret += int % 2n;
    int >>= 1n;
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
//     console.log(`Current state:`,JSON.stringify({turn, tokens, strikes, playable:bits(playable), trash:bits(trash), playPile:playPile.map(a=>a?.length), discardPile:discardPile.length,hands:hands.map(hand=>hand.map(c=>bits(c.public)))}));
//   if (action.type==="gameOver")
//     gs.serverGameOver(action);
//   if (action.type==="turn")
//     gs.serverTurn(action);
// }


GameState;



































