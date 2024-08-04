
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























