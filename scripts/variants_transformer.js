data.map(v => {
  let comp = (v.stackSize == 4 ? '11223344' :
    v.sudoku ? '1122334455' :
      v.upOrDown ? '122334457' :
        v.criticalRank == 4 ? '111223345' :
          '1112233445');

  let { id, name } = v;
  let ranks = v.ranks.join("");
  let suits = v.suitAbbreviations.join("");
  let clueRanks = v.clueRanks.join("");
  let clueColors = v.clueColors.map(a => a.abbreviation).join("");
  let cards = v.suits.map((s, suitIndex) => {
    let comp2 = (s.oneOfEach ? (v.upOrDown ? '123457' : '12345') :
      s.reversed ? '1223344555' : comp);
    return [...comp2].map(r => v.suitAbbreviations[suitIndex] + r);
  });

  let allColors = v.clueColors.map(a => a.abbreviation);
  let allRanks = v.clueRanks;
  let loopingColors = v.clueColors.map(a => a.abbreviation); // TODO
  let loopingRanks = v.clueRanks.filter(a => a !== v.specialRank); // TODO
  let touches = v.suits.flatMap((s, suitIndex) => v.ranks.map(r => {
    // v s r
    let cc = s.clueColors.map(a => a.abbreviation);
    let cr = r !== '7' ? [r] : [];

    // suit takes precidence over rank if there is conflict (eg null1s+M)

    // Special
    //   v.specialRank[RankDeceptive]
    //   v.[synesthesia oddsAndEvens funnels chimneys]
    //   s.[prism] // only uses normal suits. Ignore special suits.

    // Deceptive
    if (v.specialRank == r && v.specialRankDeceptive)
      cr = [loopingRanks[suitIndex % loopingRanks.length]];
    // Synesthesia applies at the end.
    // if (v.synesthesia)
    //   cr = [loopingColors[(r-1) % loopingColors.length]];
    if (v.oddsAndEvens)
      cr = [((r - 1) % 2) + 1]
    // Funnels && Chimneys
    if (v.funnels)
      cr = v.ranks.slice(r - 1); // rank touched by *clues* higher than the card's
    if (v.chimneys)
      cr = v.ranks.slice(0, r); // rank touched by *clues* lower than the card's
    // Prims
    if (s.prism)
      cc = [loopingColors[(r - 1) % loopingColors.length]];
    if (s.prism && r == '7')
      cc = [loopingColors[loopingColors.length - 1]];

    // AllNone
    // v.specialRank[AllClueColors AllClueRanks NoClueColors NoClueRanks]
    // s.[ allClueRanks noClueRanks allClueColors (noClueColors) ]

    // Special Ranks
    if (v.specialRank == r && (v.specialRankAllClueColors))
      cc = allColors;
    if (v.specialRank == r && (v.specialRankNoClueColors))
      cc = []; // technically not needed
    if (v.specialRank == r && (v.specialRankAllClueRanks))
      cr = allRanks;
    if (v.specialRank == r && (v.specialRankNoClueRanks))
      cr = [];

    // special Suit overwrites variant's specialRank

    // special suits part 1
    if (s.allClueRanks)
      cr = allRanks;
    if (s.noClueRanks)
      cr = [];
    // Synesthesia goes after number modifies
    if (v.synesthesia) {
      cr = cr.map(r => loopingColors[((r == '7' ? loopingColors.length : r) - 1) % loopingColors.length]);
      cc = [...cc, ...cr];
      cr = [];
    }
    // special suits part 2
    if (s.allClueColors)
      cc = allColors;
    if (s.noClueColors)
      cc = [];

    // Weird
    //   v.[colorCluesTouchNothing rankCluesTouchNothing]
    if (v.colorCluesTouchNothing)
      cc = [];
    if (v.rankCluesTouchNothing)
      cr = [];

    let touchedString = cc.join("") + cr.join("");
    if (v.synesthesia)
      touchedString = v.clueColors.map(a => a.abbreviation).filter(c => touchedString.includes(c)).join("");
    return [v.suitAbbreviations[suitIndex] + r, touchedString];
  }));

  let cardMasks = new Map(touches.map((a,i)=>[a[0],(1n<<BigInt(i))]));
  let touchesInv = [...clueColors+clueRanks].map(c=>[c,touches.filter(t=>t[1].includes(c)).map(t=>t[0])]);
  let clueMasks = touchesInv.map(([clue,cards])=>[clue,cards.map(c=>cardMasks.get(c)).reduce((c,n)=>c|n,0n)]);

  // let clarifyClue=({type,value})=>(type==0?v.clueColors.map(a=>a.abbreviation)[value]:value+"");

  return {
    id, name,
    suits, ranks,
    clueColors, clueRanks,
    // "R1,R1,R1,R2,...,P4,P5"
    cards: cards.join(),
    // "R1:R1,R2:R2,...,M4:RYGB4,M5:RYGB5"
    touches: touches.map(([card, clues]) => card + ":" + clues).join(),
    touchesInv: touchesInv.map(([clue, cards]) => clue + ":" + cards.join(" ")).join(),
    cardMasks: [...cardMasks.entries()].map(a=>a.join(":")).join(),
    clueMasks: clueMasks.map(a=>a.join(":")).join()
  };
});
