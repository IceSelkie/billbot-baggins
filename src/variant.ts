import * as fs from 'fs';
// import { Card, Suit, Rank, CardMask } from './card';
type Card = number;
type CardMask = number;
type Suit = number;
type Rank = number;
type Clue = number;
type Hand = Card[];

export class Variant {
  static variants_array: VariantData[] = Object.values(JSON.parse(fs.readFileSync("variants_combined.json", 'utf-8')));
  static variants_by_name: Map<string, VariantData> = new Map(Variant.variants_array.map(variant => [variant.name, variant]));
  static variants_by_id: Map<number, VariantData> = new Map(Variant.variants_array.map(variant => [variant.id, variant]));

  variant: VariantData | undefined;
  deck: Card[];       // len: total cards  eg:[0x1,0x1,0x1, 0x2,0x2, ... 1<<23,1<<23, 1<<24] len50
  cardStrs: string[]; // len: num unique cards  eg:[R1 R2 ... P4 P5] len25

  suitMasks: CardMask[];
  rankMasks: CardMask[];

  cardTouches: Map<Card, Clue[]>;
  clueTouches: Map<Clue, Card[]>;

  constructor(input: number | string) {
    // Parse input to variant
    if (typeof input === "number")
      this.variant = Variant.variants_by_id.get(input);
    else if (Variant.variants_by_name.has(input))
      this.variant = Variant.variants_by_name.get(input);
    // And error if not found (ensure not undefined)
    if (!this.variant) throw new Error(`No variant found by identifier ${input}`);

    // Bit Masks
    {
      this.suitMasks = new Array(this.variant.suits.length);
      this.rankMasks = new Array(this.variant.ranks.length);
      let rankStep: number = 1 << this.variant.ranks.length;
      let baseSuit: number = rankStep - 1;
      let baseRank: number = 0;
      for (let _ in this.variant.suits) {
        this.suitMasks.push(baseSuit);
        baseSuit *= rankStep;
        baseRank *= rankStep; baseRank++;
      }
      for (let _ in this.variant.ranks) {
        this.rankMasks.push(baseRank);
        baseRank <<= 1;
      }
    }

    let defaultRankComposition: number[] = [...'1112233445'].map(c => Number(c) - 1);
    if (this.variant.stackSize === 4) // sudoku 4-suit
      defaultRankComposition = [...'11223344'].map(c => Number(c) - 1);
    else if (this.variant.sudoku) // sudoku 5-suit
      defaultRankComposition = [...'1122334455'].map(c => Number(c) - 1);
    else if (this.variant.upOrDown)
      // in the variant "upOrDown", the "S" rank is internally represented by a "7", which is the sixth rank coming after "5" at index 4, and thus "S" or "7" falls at index 5.
      defaultRankComposition = [...'122334457'].map(c => c === '7' ? 5 : Number(c) - 1);
    else if (this.variant.criticalRank === 4)
      defaultRankComposition = [...'111223345'].map(c => Number(c) - 1);

    this.deck = [];
    this.cardStrs = [];
    let i: number = -1;
    for (let suit of this.variant.suits) {
      let suitComposition: number[] = defaultRankComposition;
      if (suit.oneOfEach) // black-ish
        suitComposition = [...'12345'].map(c => Number(c) - 1);
      else if (suit.reversed) // There is no crit 4s. But there is black-reversed, which uses above
        suitComposition = [...'1223344555'].map(c => Number(c) - 1);

      for (let rank of this.variant.ranks) {
        let cardStr: string = suit.abbreviation + rank;
        if (this.cardStrs[i] !== cardStr)
          this.cardStrs[++i] = cardStr;
      }
    }
  }

  cardApplyClue(card: CardMask, clue: Clue): CardMask {
    return card & clue;
  }

  playableMask(played: CardMask): CardMask {
    // upOrDown, throwItInAHole, sudoku;

  }
  playable(played: CardMask, card: Card): boolean;

  touchesCard(card: Card, clue: Clue): boolean;
  touchesHand(hand: Hand, clue: Clue): boolean[];

  isClueValid(hand: Hand, clue: Clue): boolean {
  }

  createDeck(): Card[] {
    return []; // Add the correct implementation
  }

  private createSuitCards(suit: Suit) {

    if (oneOfEach)
      rankMultiplicities['oneOfEach'];
    new Card()
  }
}



interface VariantData {
  name: string; // "No Variant"
  id: number; // 0
  newID: string; // "R+Y+G+B+P+Bk,NM,Sy"

  maxScore: number; // 25
  stackSize: number; // 5

  suits: SuitDefinition[]; // eg Orange = 'O' touched [RY] 10 cards
  ranks: number[];
  clueColors: ClueColor[]; // eg R
  clueRanks: number[];
  suitAbbreviations: string[];

  criticalRank: number | undefined;
  specialRank: number | undefined;
  specialRankAllClueColors: boolean;
  specialRankAllClueRanks: boolean;
  specialRankNoClueColors: boolean;
  specialRankNoClueRanks: boolean;
  specialRankDeceptive: boolean;

  // Clue modifiers
  clueStarved: boolean; // discarding only regains half a clue
  colorCluesTouchNothing: boolean;
  rankCluesTouchNothing: boolean;
  alternatingClues: boolean; // clues must alternate between rank and suit after the first clue
  oddsAndEvens: boolean; // rank clues are modulo 2
  synesthesia: boolean; // rank clues are the respective suit
  funnels: boolean; // rank clues touch everything below
  chimneys: boolean; // rank clues touch everything above
  cowAndPig: boolean; // Can only see if clues are rank or suit, not which one
  duck: boolean; // Can only see what cards are touched, not rank or suit

  // Game logic changes
  upOrDown: boolean;
  throwItInAHole: boolean;
  sudoku: boolean;

  // Visual and not applicable
  offsetCornerElements: boolean; // some cards have multicolor indicator in the corner
  showSuitNames: boolean;
  identityNotePattern: string;
}
interface ClueColor {
  name: string;
  abbreviation: string;
  fill: string;
  fillColorblind: string;
}
interface SuitDefinition {
  abbreviation: string;
  displayName: string;

  name: string;
  id: string;

  // Rank modifiers
  oneOfEach: boolean;
  reversed: boolean;

  // Clue modifiers
  clueColors: ClueColor[];
  prism: boolean;
  allClueColors: boolean;
  noClueColors: boolean;
  allClueRanks: boolean;
  noClueRanks: boolean;

  // Visual and not applicable
  pip: string;
  fill: string;
  fillColorblind: string;
  fillColors: string[];
  createVariants: boolean;
}
