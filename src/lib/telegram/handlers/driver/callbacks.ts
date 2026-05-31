import { Telegraf } from 'telegraf';
import {
    registerTaskLifecycleCallbacks,
    registerCalculatorCallbacks,
    registerCompletionCallbacks,
} from './callbacks/index';

export function registerCallbackHandlers(bot: Telegraf) {
    registerTaskLifecycleCallbacks(bot);
    registerCalculatorCallbacks(bot);
    registerCompletionCallbacks(bot);
}
