
// Hat Guessing:
// Identify a focus for the hint (Cox: the most playable card in a hand);
// Break the possibilities into n submasks (Cox: trash, put 1 in as many options as possible, combining at most n for the last few (minimize addl hints to full information))
// Action priority (Cox: play oldest playable, discard oldest trash, give hint, discard known duplicate, discard oldest non-critical, discard oldest)


// Card Weight for focus
//   For Cox et al, this is the fraction of playable possibilities of the card.
cardWeightCox=(publicCardMask, playable)=>{
  // return bits(publicCardMask&playable) / bits(publicCardMask);
  return [bits(publicCardMask&playable), bits(publicCardMask)];
}

// Split a mask into submasks
submasksCox=(publicCardMask, qty, playable, trash) => {
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

handFocusCox=(publicHand, playable)=>{
  let weights = publicHand.map(mask=>cardWeightCox(mask,playable)).map((a,i)=>[i,a[0]/a[1]+(a[1]==1?-0.99:0)]);
  // sort by most playable, if identity isnt already known
  weights.sort((a,b)=>b[1]-a[1]);
  // return index of largest weight
  return weights[0][0];
}


actionsCox=(gameState)=>{
  // Priority 1: playable card
  if (gameState.hands.map(private).filter(playable))
    // play lowest rank

  // Priority 2: Early discard
  if (gameState.discardPile.length<5 && gameState.info.tokens<=7) {
    // discard trash
  }

  // Priority 3: Hint
  if (gameState.info.tokens>=1) {
    // give hatguess hint
  }

  // Priority 4: Discard trash
  // discard private hand.filter(trash) [0]

  // Below here we know:
  // cant play, cant hint, cant safe discard
  // So make the safest discard we can!

  // Priority 5: Discard Duplicated Card
  // QUESTION: is this publicly known duplicated? Or is this so long as anyone else has the same card?

  // Priority 6: Discard Non-Critical
  // if privatehand.filter(noncritical)
  // discard oldest

  // Priority 7: Discard Oldest
  // (Why not least critical?)
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





class CoxAI {
  constructor(gameState) {
    this.gameState = gameState;
  }
  playerTurn(){
    console.log("Looking to play...");
    let myHand = this.gameState.hands[this.gameState.ourPlayerIndex];
    let handPlayable = myHand.filter(card=>(card.public&this.gameState.playable) == card.public);
    if (handPlayable.length) {
      console.log("Playing known playable...");
      this.gameState.clientPlay(handPlayable[0].order);
      return;
    }
    if (this.gameState.tokens<=7) {
      console.log("Idk what to do, so discarding oldest card...");
      this.gameState.clientDiscard(myHand[0].order);
    } else {
      console.log("Idk what to do, so playing slot 1...");
      this.gameState.clientPlay(myHand[myHand.length-1].order);
    }
  }
  playerInterpretClue({clue,target,list}){
    console.log("Not implemented!");
  }
  playerInterpretDiscard(){}
  playerInterpretStrike(){}
  playerInterpretBlindplay(){}
}

CoxAI;















