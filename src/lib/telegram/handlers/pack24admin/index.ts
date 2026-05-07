import { Telegraf } from 'telegraf';
import { registerStartHandler } from './start';
import { registerContactHandler } from './contact';
import { registerCallbackHandlers } from './callbacks';
import { registerStaffCommands, registerTextHandlers } from './text';

export function registerPack24AdminHandlers(bot: Telegraf) {
    registerStartHandler(bot);
    registerContactHandler(bot);
    registerStaffCommands(bot);  // /link, /tasks — xodimlar buyruqlari
    registerCallbackHandlers(bot);
    registerTextHandlers(bot);
}
