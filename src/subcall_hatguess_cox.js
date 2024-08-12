
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

playerTurn(){
  console.log("Took action with priorty",this.coxAction());
}
coxAction(){
  let gameState = this.gameState;
  // playerTurn(){
  //   console.log("Looking to play...");
  let myHand = gameState.hands[gameState.ourPlayerIndex];
  //   let handPlayable = myHand.filter(card=>(card.public&this.gameState.playable) == card.public);
  //   if (handPlayable.length) {
  //     this.gameState.clientPlay(handPlayable[0].order);
  //     return;
  //   }
  //   if (this.gameState.tokens<=7) {
  //     console.log("Idk what to do, so discarding oldest card...");
  //     this.gameState.clientDiscard(myHand[0].order);
  //   } else {
  //     console.log("Idk what to do, so playing slot 1...");
  //     this.gameState.clientPlay(myHand[myHand.length-1].order);
  //   }
  // }
  const cardPlayable = card=>(card.public&gameState.playable) == card.public;
  const cardTrash = card=>(card.public&gameState.trash) == card.public;
  const discardAllowed = gameState.tokens<=7;

  // Priority 1: playable card
  let myHandPlayable = myHand.filter(cardPlayable);
  if (myHandPlayable.length) {
    // play lowest rank, or oldest card
    let toPlay = myHandPlayable.reduce((cont,card)=>card.rank<cont[0]?[card.rank,card]:cont,[Infinity,{order:-1}])[1];
    console.log("Playing known playable...");
    gameState.clientPlay(toPlay.order);
    return 1;
  }

  // Priority 2: Early discard
  let myHandTrash = myHand.filter(cardTrash);
  if (gameState.discardPile.length<5 && myHandTrash.length && discardAllowed) {
    // discard oldest trash
    gameState.clientDiscard(myHandTrash[0].order);
    return 2;
  }

  // Priority 3: Hint
  if (gameState.tokens>=1) {
    // give hatguess hint
    // return 3;

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

  let focuses = hInds.map(hi=>CoxAI.handFocusCox(hands[hi].map(c=>c.public), playable));
  let submasks = hInds.map((hi,i)=>CoxAI.submasksCox(hands[hi][focuses[i]], (this.gameState.numPlayers-1)*2, playable, trash));
  let modulos = hInds.map((hi,i)=>submasks[i]);
}

  playerInterpretClue({clue,target,list}){console.log("Not implemented!");}
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















