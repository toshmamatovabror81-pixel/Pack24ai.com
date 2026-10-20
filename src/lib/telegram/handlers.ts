import 'server-only';
import type { TgUpdate } from './api';
import type { BotKind } from './bots';
import { bot as customerBot } from './bots/customer';
import { bot as staffBot } from './bots/staff';

/** Webhook -> tegishli bot. Har bir bot modul `export const bot = createBot(kind)` beradi. */
export function dispatchUpdate(kind: BotKind, update: TgUpdate): Promise<void> {
  switch (kind) {
    case 'customer': return customerBot.handle(update);
    case 'staff': return staffBot.handle(update);
  }
}
