import { Client } from './client'
import { Server } from './server'
import { Remote } from './remote'
import { Card, Suit, Rank, CardMask } from './card';
import { Action } from './action'
import { Hint } from './hint'
import { Variant } from './variant'
import { Hand } from './hand'

export class HanabiProxy {
  private client: Client;
  private server: Server | null;
  private remote: Remote | null;

  constructor(client: Client, source: Server | Remote);
  clientToServer_addNote(card: Card, note: string): void;
  serverToClient_yourTurn(): Action;
  serverToClient_cardPlayed(played?: Card, drawn?: Card): void;
  serverToClient_strike(bombed: Card, drawn?: Card): void;
  serverToClient_discard(discarded: Card, drawn?: Card): void;
  serverToClient_hint(targetPlayer: number, hint: Hint, touched: boolean[]): void;
  serverToClient_gameOver(reason: string): void;
  serverToClient_startingHands(variant: Variant, hands: Hand[]): void;
}
