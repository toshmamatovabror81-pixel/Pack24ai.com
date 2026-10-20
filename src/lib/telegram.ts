import 'server-only';

const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

/** Admin guruhga xabar (TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID). Xato bo'lsa jim o'tadi. */
export async function notifyAdmins(lines: (string | null | undefined)[]) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;
  const text = lines.filter(Boolean).map((l) => escape(String(l))).join('\n');
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('Telegram xabar yuborilmadi', err);
  }
}
