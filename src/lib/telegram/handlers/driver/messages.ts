import { Telegraf } from 'telegraf';
import {
    registerRegistrationHandlers,
    registerCalculatorMessageHandlers,
    registerMenuButtonHandlers,
} from './messages/index';

export function registerMessageHandlers(bot: Telegraf) {
    registerRegistrationHandlers(bot);
    registerCalculatorMessageHandlers(bot);
    registerMenuButtonHandlers(bot);
}
