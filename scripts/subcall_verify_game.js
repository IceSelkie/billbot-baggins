// varbyname = new Map(Object.values(JSON.parse(fs.readFileSync("variants_combined.json"))).map(v=>[v.name,v])) ; varname.size

function verifyGame([vname,g],shouldClarify=true,vari,dvari){
  if (!vari) vari = varbyname.get(vname);
  let clarify=(order)=>{let c=g.cards[order]; return vari.suitAbbreviations[c.suitIndex]+c.rank;};
  let clarifyClue=({type,value})=>(type==0?vari.clueColors.map(a=>a.abbreviation)[value]:value+"");
  let info = {variant:vari.name,v:vari.id,numPlayers:g.actions.map(a=>a.playerIndex).reduce((c,n)=>n>c?n:c,0)+1,strikes:0,tokens:8};
  let hands=new Array(info.numPlayers).fill(null).map(a=>[]);
  let public = {hands:new Array(info.numPlayers).fill(null).map(a=>[])};
  let discardPile = [];
  let playPile = [];
  // let playPile = vari.suits.map(_=>[]);
  let clues = [];
  let ret={info,hands,discardPile,playPile,clues,public};
  let startCycle = true;
  let maskMap = [];
  let clueMasks = [[],[]];
  dvari?.cardMasks.split(",").map(t=>t.split(":")).map(([[s,r],v])=>{
    let suitIndex = vari.suitAbbreviations.indexOf(s);
    if (!maskMap[suitIndex]) maskMap[suitIndex] = [];
    maskMap[suitIndex][Number(r)] = BigInt(v);
  });
  dvari?.clueMasks.split(",").map(t=>t.split(":")).map(([c,v])=>{
    if (vari.suitAbbreviations.includes(c))
      clueMasks[0][vari.suitAbbreviations.indexOf(c)] = BigInt(v);
    else
      clueMasks[1][c] = BigInt(v);
  })

  // Determine the set of cards that can be played without causing a strike
  let directPlayable=()=>{
    let ret = null;
    if (vari.throwItInAHole) {
      // tiiah // requires addl knowledge
      // TODO: currently just returns all ones
      return (1<<vari.suits.length)-1;
    } else if (vari.sudoku) {
      // sudoku
      ret = vari.suits.map((s,suitIndex)=>playPile.filter(a=>a.suitIndex===suitIndex));
      let unusedStartingValues = vari.ranks.filter(r=>!ret.find(played=>played[0]?.rank===r));
      ret = ret.map((played,suitIndex)=>played.length==0?unusedStartingValues:played.length==vari.ranks.length?[]:[(played[played.length-1].rank%vari.ranks.length)+1]);
    } else {
      // remaining variants (upOrDown, reversed, and default)
      ret = vari.suits.map((s,suitIndex)=>{
        let played = playPile.filter(a=>a.suitIndex==suitIndex);

        // up or down -> S
        if (vari.upOrDown) {
          // 12345 72345 54321 74321
          if (played.length == 0) return [1,5,7];
          if (played.length == 1 && played[0].rank == 7) return [2,4];
          if (played.length == 1) return (played[0].rank == 1)?[2]:[4];
          if (played.length == 2) return [3];
          if (played.length == 4) return (played[3].rank == 2)?[1]:[5];
          return [];
        } if (s.reversed) {
          // reversed suit
          return [(played[played.length-1]?.rank??6) - 1];
        } else {
          // default
          return [(played[played.length-1]?.rank??0) + 1];
        }
      });
    }
    return ret.flatMap((ranks,suitIndex)=>ranks.map(rank=>maskMap[suitIndex]?.[rank])).filter(a=>a).reduce((c,n)=>c|n,0n);
  };

  // Determine the cards that will never be played
  // TODO
  let directTrash=()=>{
    // played
    let played = playPile.map(a=>maskMap[a.suitIndex]?.[a.rank]).filter(a=>a).reduce((c,n)=>c|n,0n);
    // Never playable
    let beyond = 0n;
    return played | beyond;
  }

  g.actions.forEach(a=>{
    if (a.type == "draw") {
      //console.log(a.playerIndex,hands[a.playerIndex])
      hands[a.playerIndex].push(a.order);
      public.hands[a.playerIndex].push(BigInt(dvari?.cardMaskUnknown ?? 0));
    } else if (startCycle) {
      startCycle = false;
      info.handSize = hands.map(a=>a.length);
    }
    if (a.type == "discard") {
      discardPile.push(a.order);
      public.hands[a.playerIndex].splice(hands[a.playerIndex].indexOf(a.order),1);
      hands[a.playerIndex] = hands[a.playerIndex].filter(c=>c!==a.order);
      info.tokens++;
      ret.trash = directTrash();
    }
    if (a.type == "play") {
      // playPile.push(a.order);
      // playPile[a.suitIndex].push(a.order);
      playPile.push({order:a.order,suitIndex:a.suitIndex,rank:a.rank});
      ret.public.playable = directPlayable();
      playPile[playPile.length-1].playable = ret.public.playable;
      public.hands[a.playerIndex].splice(hands[a.playerIndex].indexOf(a.order),1);
      hands[a.playerIndex] = hands[a.playerIndex].filter(c=>c!==a.order);
      ret.trash = directTrash();
    }
    if (a.type == "clue") {
      let hand = hands[a.target];
      let phand = public.hands[a.target];
      clues.push({clueTarget:a.clue, touched:a.list, untouched:hand.filter(b=>!a.list.includes(b))});

      let hintMask = clueMasks[a.clue.type][a.clue.value];
      if (hintMask!==undefined) {
        public.hands[a.target] = phand.map((cardMask,index)=>{
          // console.log({index,cardMask,hintMask});
          if (a.list.includes(hand[index]))
            return cardMask&hintMask;
          else
            return cardMask-(cardMask&hintMask);
        });
        // console.log(`Hint-${clarifyClue(a.clue)} to player ${a.target}:`);
        // let humanReadable = phand.map(a=>display(a).split("\n"));
        // humanReadable[0].forEach((_,i)=>console.log(humanReadable.map(a=>a[i]).join("  |  ")));
        // console.log('Becomes:');
        // humanReadable = public.hands[a.target].map(a=>display(a).split("\n"));
        // humanReadable[0].forEach((_,i)=>console.log(humanReadable.map(a=>a[i]).join("  |  ")));
        // console.log();
      }
    }
    if (a.type == "strike") {
      info.strikes++;
      info.tokens--; // A bombed card also calls discard which increments tokens.
      if (info.strikes!==a.num) throw new Error(`Strikes mismatch. action says ${a.num}, but after incrementing we have ${info.strikes}!`);
    }
  })
  if (shouldClarify) {
    ret.hands = ret.hands.map(h=>h.map(clarify));
    ret.discardPile = ret.discardPile.map(clarify);
    ret.playPile = ret.playPile.map(({order,suitIndex,rank})=>clarify(order));
    // ret.playPile = ret.playPile.map(a=>a.map(clarify));
    ret.clues = ret.clues.map(({clueTarget,touched,untouched})=>{return{clueTarget:clarifyClue(clueTarget),touched:touched.map(clarify).join(),untouched:untouched.map(clarify).join()}});
  } else {
    ret.clues = ret.clues.map(({clueTarget,touched,untouched})=>{return{clueTarget,touched:touched.join(),untouched:untouched.join()}});
  }

  return ret;
  //g.actions.map(a=>a.type=="draw"?hands[a.playerIndex]=hands[a.playerIndex]??[]:0)
};
// verifyGame(gamesbyname[0]);
