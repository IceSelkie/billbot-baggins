
// Hat Guessing:
// Identify a focus for the hint (Cox: the most playable card in a hand);
// Break the possibilities into n submasks (Cox: trash, put 1 in as many options as possible, combining at most n for the last few (minimize addl hints to full information))
// Action priority (Cox: play oldest playable, discard oldest trash, give hint, discard known duplicate, discard oldest non-critical, discard oldest)


class CoxAI {
  constructor(gameState) {
    this.gameState = gameState;
  }

  // Card Weight for focus
  //   For Cox et al, this is the fraction of playable possibilities of the card.
  static cardWeightCox(publicCardMask, playable){
    // return bits(publicCardMask&playable) / bits(publicCardMask);
    return [bits(publicCardMask&playable), bits(publicCardMask)];
  }

  // Split a mask into submasks
  static submasksCox(publicCardMask, qty, playable, trash){
    if (qty<2)
      return [publicCardMask];

    let ret = [];
    let trashMask = publicCardMask&trash;
    let remainder = publicCardMask - trashMask;
    if (trashMask)
      ret.push(trashMask);

    remainder = onehots(remainder).reverse();
    // Move playable to front so they are grouped last
    // remainder = [...remainder.filter(a=>a&playable), ...remainder.filter(a=>!(a&playable))];
    // console.log({ret,remainder});
    let combined = [];
    let leftToCombine = ret.length + remainder.length + combined.length - qty;
    while (leftToCombine>0) {
      if (leftToCombine != (ret.length + remainder.length + combined.length - qty))
        console.log(`LeftToCombine is not correct!`);
      // if (remainder.length<leftToCombine+1)
      //   remainder = [...combined,remainder];
      // group the last 2...qty terms together
      let cut = remainder.splice(remainder.length-Math.min(qty,leftToCombine+1));
      leftToCombine -= cut.length-1;
      combined.push(cut.reduce((c,n)=>c|n,0n));
    }
    return [...ret, ...remainder, ...combined];
  }

  static handFocusCox(publicHand, playable){
    let weights = publicHand.map(mask=>CoxAI.cardWeightCox(mask,playable)).map((a,i)=>[i,a[0]/a[1]+(a[1]==1?-0.99:0)]);
    // sort by most playable, if identity isnt already known
    weights.sort((a,b)=>b[1]-a[1]);
    // return index of largest weight
    return weights[0][0];
  }

  knownHandModulo(hand, qty, playable, trash) {
    let publicHand = hand.map(c=>c.public);
    let i = CoxAI.handFocusCox(publicHand, playable);
    let trueMask = this.gameState.cardMasks[hand[i].suitIndex][hand[i].rank];
    let submasks = CoxAI.submasksCox(publicHand, qty, playable, trash);
    return submasks.indexOf(submasks.find(mask=>mask&trueMask));
  }

  identifyValidHints() {
    return this.gameState.playerNames.map((_,i)=>i===this.gameState.ourPlayerIndex?[]:[0, 1]); // color and rank
  }

  playerTurn(){
    console.log("Took action with priorty",this.coxAction());
  }
  coxAction(){
    const gameState = this.gameState;
    const {playable, trash, ourPlayerIndex} = gameState;
    const myHand = gameState.hands[ourPlayerIndex];

    const cardPlayable = card=>(card.public&playable) == card.public;
    const cardTrash = card=>(card.public&trash) == card.public;

    let discardAllowed = gameState.tokens<=7;
    let myHandPlayable = myHand.filter(cardPlayable);
    let myHandTrash = myHand.filter(cardTrash);

    // Priority 1: playable card
    if (myHandPlayable.length) {
      // play lowest rank, or oldest card
      let toPlay = myHandPlayable.reduce((cont,card)=>card.rank<cont[0]?[card.rank,card]:cont,[Infinity,{order:-1}])[1];
      console.log("Playing known playable...");
      gameState.clientPlay(toPlay.order);
      return 1;
    }

    // Priority 2: Early discard
    if (gameState.discardPile.length<5 && myHandTrash.length && discardAllowed) {
      // discard oldest trash
      gameState.clientDiscard(myHandTrash[0].order);
      return 2;
    }

    // Priority 3: Hint
    if (gameState.tokens>=1) {
      let allowedHints = this.identifyValidHints().flatMap((hs,i)=>hs.map(h=>[i,h]));
      let qty = allowedHints.length;
      if (qty >= 4) {
        // give hatguess hint
        let modulo = this.gameState.hands.map((h,i)=>i===ourPlayerIndex?0:this.knownHandModulo(h,qty,playable,trash));
        modulo = modulo.reduce((c,n)=>(c+n)%qty,0);
        let [target, type] = allowedHints[modulo];

        let targetTrueMasks = gameState.hands[target].map(c=>gameState.cardMasks[c.suitIndex][c.rank]);
        let allowedClues = gameState.clueMasks[type].map((mask,value)=>[value,mask]).filter(([value,mask])=>targetTrueMasks.find(c=>c&mask)).map(([value,mask])=>value);

        if (type === 0)
          gameState.clientClueColor({target,type,value:allowedClues[0]});
        else if (type === 1)
          gameState.clientClueColor({target,type,value:0});
        else
          throw new Error("Not Implemented Yet: cox priority 3");

        return 3;
      }
      console.log("Failed to find suitable hatguess hint...");
    }

    // Priority 4: Discard trash
    if (myHandTrash.length && discardAllowed) {
      // discard private hand.filter(trash) [0]
      gameState.clientDiscard(myHandTrash[0].order);
      return 4;
    }

    // Below here we know:
    // cant play, cant hint, cant safe discard
    // So make the safest discard we can!

    // **** TESTING START ****
    let untouched = myHand.filter(card=>!card.touched);
    if (untouched.length && discardAllowed) {
      gameState.clientDiscard(untouched[0].order);
      return 1005
    }
    // **** TESTING END ****

    // Priority 5: Discard Duplicated Card
    // QUESTION: is this publicly known duplicated? Or is this so long as anyone else has the same card?

    // Priority 6: Discard Non-Critical
    // if privatehand.filter(!critical)
    // discard oldest

    // Priority 7: Discard Oldest
    // (Why not least critical? why not unclued?)
    if (discardAllowed) {
      gameState.clientDiscard(myHand[0].order);
      return 7;
    }

    // Priority infinite: Misplay
    if (true) {
      gameState.clientPlay(myHand[CoxAI.handFocusCox(myHand.map(c=>c.public),gameState.playable)].order);
      return 1008;
    }

    return -1;
  }

  getHatguessHint() {
    const {hands,playable,trash,currentPlayerIndex} = this.gameState;

    // Get non-player hands
    let hInds = hands.map((_,i)=>i);
    hInds.splice(currentPlayerIndex,1);

    let focuses = hInds.map((hi,_)=>CoxAI.handFocusCox(hands[hi].map(c=>c.public), playable));
    let submasks = hInds.map((hi,i)=>CoxAI.submasksCox(hands[hi][focuses[i]], (this.gameState.numPlayers-1)*2, playable, trash));
    let modulos = hInds.map((hi,i)=>submasks[i]);
  }

  playerInterpretClue({clue,target,list}){
    // let qty = ;
    // let actualModulo = ;
    // let visibleModulo = this.gameState.hands.map((h,i)=>
    //     i===ourPlayerIndex || i===target?
    //     0:
    //     this.knownHandModulo(h,qty,this.gameState.playable,this.gameState.trash)
    //   );

    // let myHandModulo = (actualModulo-visibleModulo+qty)%qty;

    console.log("Not implemented!");
  }
  playerInterpretDiscard(){}
  playerInterpretStrike(){}
  playerInterpretBlindplay(){}
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
onehots=(int)=>{
  let ret = [];
  while (int) {
    let temp = int%2n;
    ret.push(int%2n);
    int >>= 1n;
  }
  ret.map((a,i)=>a<<BigInt(i)).filter(a=>a);
}
onehots=(int)=> [...BigInt(int).toString(2)].reverse().map((a,i)=>BigInt(a)<<BigInt(i)).filter(a=>a);






CoxAI;















