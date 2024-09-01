
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

  knownHandModulo(hand, qty, playable, trash, apply=false) {
    let publicHand = hand.map(c=>c.public);
    let i = CoxAI.handFocusCox(publicHand, playable);
    let trueMask = this.gameState.cardMasks[hand[i].suitIndex][hand[i].rank];
    let submasks = CoxAI.submasksCox(publicHand[i], qty, playable, trash);
    let moduloIndex = submasks.indexOf(submasks.find(mask=>mask&trueMask));
    if (apply)
      hand[i].public &= submasks[moduloIndex];
    return moduloIndex;
  }

  identifyValidHints() {
    return this.gameState.playerNames.map((_,i)=>i===this.gameState.ourPlayerIndex?[]:[0, 1]); // color and rank
  }

  playerTurn(){
    // Give a half second grace for first turn for all clients to synchronize
    if (global.proxy) {
      const gameDur = Number(process.hrtime.bigint() + proxy.timer.gameTime)/1e6;
      if (gameDur < 500)
        return setTimeout(()=>this.playerTurn(), 500 - gameDur);
    }

    if (global.proxy) proxy.timer.myTurn -= process.hrtime.bigint();
    console.log("Took action with priorty",this.coxAction());
    if (global.proxy) proxy.timer.myTurn += process.hrtime.bigint();
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
      if (this.giveHatguessHint())
        return 3;
      else
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

    // // **** TESTING START ****
    // let untouched = myHand.filter(card=>!card.touched);
    // if (untouched.length && discardAllowed) {
    //   gameState.clientDiscard(untouched[0].order);
    //   return 4.1;
    // }
    // // **** TESTING END ****

    // Priority 5: Discard Duplicated Card
    // let duplicated = myHand.filter(card=> other hands contain exact copy of all possibile things this card could be)
    const allOtherGroundTruths = gameState.hands.flatMap((hand,i)=>i===ourPlayerIndex?[]:hand.map(card=>gameState.cardMasks[card.suitIndex][card.rank])).reduce((c,n)=>c|n,0n);
    let duplicated = myHand.filter(card => card.public === (card.public&allOtherGroundTruths));
    if (duplicated.length && discardAllowed) {
      gameState.clientDiscard(duplicated[0].order);
      return 5;
    }
    // Improvement can be made to discard furthest from playable known non-critical, or ones where the other copy is fully known.
    

    // Priority 6: Discard Non-Critical
    // Identify the card least likely to be critical
    let leastCritical = myHand.map(a=>a).sort((a,b)=>bits(a.public & gameState.critical)/bits(a.public)-bits(b.public & gameState.critical)/bits(b.public));
    if (leastCritical.length && discardAllowed) {
      gameState.clientDiscard(leastCritical[0].order);
      return 5;
    }

    // Priority 7: Discard Oldest
    // (Why not least critical? why not unclued?)
    if (discardAllowed) {
      gameState.clientDiscard(myHand[0].order);
      return 7;
    }

    // Priority infinite: Misplay
    if (true) {
      let mostPlayable = myHand.map(card=>[card.order, bits(card.public&gameState.playable)/bits(card.public)]).reduce((c,n)=>n[1]>c[1]?n:c,[myHand[0].order,0]);
      gameState.clientPlay(mostPlayable[0]);
      return 7.1;
    }

    return -1;
  }

  getHintCategories(givingPlayerIndex){
    let {hands, clueColors, clueRanks, clueMasksStr, ourPlayerIndex} = this.gameState;
    let ret = [];
    hands.forEach((hand,i)=>{
      if (i!==givingPlayerIndex) {
        // no variant (assume every hand can be clued some color and some rank, and that it doesnt matter which is given)
        ret.push(clueColors.map((c,colorIndex)=>{return {playerIndex:i,clue:c,colorIndex}}));
        ret.push(clueRanks.map(r=>{return {playerIndex:i,clue:r,rank:Number(r)}}));
      }
    });
    console.log(`hintCategories (ignore p=${givingPlayerIndex})\n[\n  ${ret.map((a,i)=>`${i}: "${a[0].playerIndex}~${a.map(c=>c.clue).join("")}"`).join(",\n  ")}\n]`);
    
    if (givingPlayerIndex === ourPlayerIndex){
      // Filter impossible categories when it is our turn
      ret = ret.map(cat=>
        cat.filter(({playerIndex,clue})=>{
          let clueMask = clueMasksStr[clue];
          return hands[playerIndex].find(({suitIndex,rank})=>
            clueMask & this.gameState.cardMasks[suitIndex][rank]
          )
        })
      );
      console.log(`hintCategories,filtered\n  [\n    ${ret.map((a,i)=>`${i}: "${a[0]?.playerIndex}~${a.map(c=>c.clue).join("")}"`).join(",\n    ")}\n  ]`);
    }

    return ret;
  }
  giveHatguessHint(){
    const {playable, trash, hands, ourPlayerIndex} = this.gameState;

    const hintCategories = this.getHintCategories(ourPlayerIndex);
    const qty = hintCategories.length;
    if (qty >= 4) {
      let modulo = 0;
      hands.forEach((hand,i)=>{
        if (i!==ourPlayerIndex)
          modulo += this.knownHandModulo(hand,qty,playable,trash, false);
      });
      modulo = modulo%qty;
      console.log("Selected modulo category",modulo);

      const selectedCategory = hintCategories[modulo];

      // Subdivide hint here, if applicable.
      // if (giveableHints of selectedCategory).canConveyAdditionalBits()
      //   determine subdivisionModulo, apply relevant conveyable bits

      // Maximize information/entropy conveyed with hint
      let selectedHint =
          // selectedCategory.findMin(hint => bits(card after hint) / bits(card before hint) )
          selectedCategory[0];

      this.gameState.clientClue(selectedHint);
      return true;
    }
    return false;
  }
  playerInterpretClue({clue,target,list}, givingPlayerIndex){
    const {playable, trash, hands, ourPlayerIndex} = this.gameState;
    let myHand = hands[ourPlayerIndex];

    const hintCategories = this.getHintCategories(givingPlayerIndex);
    const qty = hintCategories.length;
    if (qty < 4) {
      console.log("This hint isnt a hatguess, since there are not enough options available to convey useful information.");
      return;
    }
    const matchesClue = (
      (clue.type===0)
      ?
        (({playerIndex,colorIndex}) => target==playerIndex && colorIndex === clue.value)
      :
        (({playerIndex,rank}) => target==playerIndex && rank === clue.value)
    );
    const matchingCategories = hintCategories.filter(cat=>cat.find(matchesClue));
    if (matchingCategories.length!=1)
      throw new Error(`Hint matches ${matchingCategories.length} category(s) for hint modulo! This should only ever be 1!`);
    const actualModulo = hintCategories.indexOf(matchingCategories[0]);

    let visibleModulos = [];
    hands.forEach((hand,i)=>{
        if (i!==ourPlayerIndex && i!==givingPlayerIndex)
          visibleModulos.push(this.knownHandModulo(hand,qty,playable,trash, true));
        else
          visibleModulos.push(null);
      });
    let visibleModulo = visibleModulos.reduce((c,n)=>c+n,0)%qty;
    console.log("Understood modulo to be", {actualModulo, visibleModulo, visibleModulos});

    if (givingPlayerIndex === ourPlayerIndex) {
      console.log("This hint was sent by us.",{visibleModulo,actualModulo});
      return;
    }

    const myHandModulo = (actualModulo-visibleModulo+qty)%qty;
    console.log("Thus my hand's modulo was",myHandModulo);
    const myHandFocus = CoxAI.handFocusCox(myHand.map(c=>c.public), playable);
    const myHandMasks = CoxAI.submasksCox(myHand[myHandFocus].public, qty, playable, trash);
    const newMask = myHandMasks[myHandModulo];
    if (!(newMask > 0n) || myHandModulo<0 || myHandModulo>=qty)
      throw new Error(`Modulo calculated for me falls outside of expected bounds! ${JSON.stringify({myHandModulo,newMask:String(newMask)})}`)

    console.log(`My hand's focus (${myHandFocus}) possibilities reduced from ${bits(myHand[myHandFocus].public)} to ${bits(newMask&myHand[myHandFocus].public)}=${bits(newMask)}.`);
    myHand[myHandFocus].public &= newMask;
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















