// varbyname = new Map(Object.values(JSON.parse(fs.readFileSync("variants_combined.json"))).map(v=>[v.name,v])) ; varname.size

function verifyGame([vname,g],shouldClarify=true){
  let v = varbyname.get(vname);
  let clarify=(order)=>{let c=g.cards[order]; return v.suitAbbreviations[c.suitIndex]+c.rank;};
  let clarifyClue=({type,value})=>(type==0?v.clueColors.map(a=>a.abbreviation)[value]:value+"");
  let info = {variant:v.name,v:v.id,numPlayers:g.actions.map(a=>a.playerIndex).reduce((c,n)=>n>c?n:c,0)+1,strikes:0};
  let hands=new Array(info.numPlayers).fill(null).map(a=>[]);
  let discardPile = [];
  let playPile = [];
  let clues = [];
  let ret={info,hands,discardPile,playPile,clues};
  let startCycle = true;
  g.actions.forEach(a=>{
    if (a.type == "draw") {
      //console.log(a.playerIndex,hands[a.playerIndex])
      hands[a.playerIndex].push(a.order);
    } else if (startCycle) {
      startCycle = false;
      info.handSize = hands.map(a=>a.length);
    }
    if (a.type == "discard") {
      discardPile.push(a.order);
      hands[a.playerIndex] = hands[a.playerIndex].filter(c=>c!==a.order);
    }
    if (a.type == "play") {
      playPile.push(a.order);
      hands[a.playerIndex] = hands[a.playerIndex].filter(c=>c!==a.order);
    }
    if (a.type == "clue") {
      clues.push({clueTarget:a.clue, touched:a.list, untouched:hands[a.target].filter(b=>!a.list.includes(b))});
      hands[a.target]
    }
    if (a.type == "strike") {
      info.strikes++;
      if (info.strikes!==a.num) throw new Error(`Strikes mismatch. action says ${a.num}, but after incrementing we have ${info.strikes}!`);
    }
  })
  if (shouldClarify) {
    ret.hands = ret.hands.map(h=>h.map(clarify));
    ret.discardPile = ret.discardPile.map(clarify);
    ret.playPile = ret.playPile.map(clarify);
    ret.clues = ret.clues.map(({clueTarget,touched,untouched})=>{return{clueTarget:clarifyClue(clueTarget),touched:touched.map(clarify).join(),untouched:untouched.map(clarify).join()}});
  } else {
    ret.clues = ret.clues.map(({clueTarget,touched,untouched})=>{return{clueTarget,touched:touched.join(),untouched:untouched.join()}});
  }

  return ret;
  //g.actions.map(a=>a.type=="draw"?hands[a.playerIndex]=hands[a.playerIndex]??[]:0)
};
verifyGame(gamesbyname[0]);
