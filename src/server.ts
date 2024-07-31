import { Variant } from './variant';
import { Card, Suit, Rank, CardMask } from './card';
import { Hand } from './hand';
import { HanabiProxy } from './proxy';

export class Server {
  private variant: Variant;
  private deck: Card[];
  private where: CardLocation[]; // deck|played|discarded|hand1|hand*;
  private info: Object; // {seed, name, etc}

  private playHistory: Card[];
  private discardHistory: Card[];

  private clues: number;
  private strikes: number;
  private hands: Hand[]; // playerCt

  // Derived Info
  private played: CardMask;
  private playable: CardMask;

  private players: HanabiProxy[]; // playerCt
}

