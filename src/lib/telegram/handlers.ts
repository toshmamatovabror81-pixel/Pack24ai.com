import 'server-only';
import type { TgUpdate } from './api';
import type { BotKind } from './bots';
import { bot as customerBot } from './bots/customer';
import { bot as driverBot } from './bots/driver';
import { bot as supervisorBot } from './bots/supervisor';
import { bot as hqBot } from './bots/hq';

/** Webhook -> tegishli bot. Har bir bot modul `export const bot = createBot(kind)` beradi. */
export function dispatchUpdate(kind: BotKind, update: TgUpdate): Promise<void> {
  switch (kind) {
    case 'customer': return customerBot.handle(update);
    case 'driver': return driverBot.handle(update);
    case 'supervisor': return supervisorBot.handle(update);
    case 'hq': return hqBot.handle(update);
  }
}
