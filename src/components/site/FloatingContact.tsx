import { Phone, Send } from 'lucide-react';
import { TrackedLink } from './TrackedLink';

/** Har sahifada: Telegram botga havola + qo'ng'iroq (mobilda pastda, kompyuterda o'ng burchakda) */
export function FloatingContact({ bot, phone, telegramLabel, callLabel }: { bot: string; phone: string; telegramLabel: string; callLabel: string }) {
  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2">
      {bot && (
        <TrackedLink
          href={`https://t.me/${bot}`}
          target="_blank"
          rel="noopener"
          event="telegram_click"
          className="inline-flex items-center gap-2 rounded-full bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white shadow-lg hover:brightness-110"
        >
          <Send className="h-5 w-5" />
          <span className="hidden sm:inline">{telegramLabel}</span>
        </TrackedLink>
      )}
      <TrackedLink
        href={`tel:+${phone}`}
        event="phone_click"
        aria-label={callLabel}
        className="inline-flex items-center justify-center gap-2 self-end rounded-full bg-accent-500 p-3 text-white shadow-lg hover:bg-accent-600 sm:hidden"
      >
        <Phone className="h-5 w-5" />
      </TrackedLink>
    </div>
  );
}
