#!/usr/bin/env bash
# Makulatura botlari (3 ta) tokenlarini .env ga yozish, saytni qayta ishga tushirish va webhook'larni o'rnatish.
# Serverda (savol-javob rejimida, shuning uchun ssh -t):
#   ssh -t -i ~/.ssh/KALIT root@SERVER /opt/pack24/deploy/bots-setup.sh
# Har bir savolga BotFather'dagi tokenni qo'yib Enter bosiladi; bo'sh qoldirilsa avvalgi qiymat qoladi.
# Tokenlar faqat serverdagi .env ga yoziladi, hech qayerga yuborilmaydi.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "XATO: $(pwd)/.env yo'q — avval deploy/server-setup.sh"; exit 1; }

current() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '"' || true; }
set_var() {
  local key="$1" val="$2"
  if grep -q "^$key=" .env; then
    sed -i "s|^$key=.*|$key=\"$val\"|" .env
  else
    printf '%s="%s"\n' "$key" "$val" >> .env
  fi
}
ask_token() {
  local key="$1" title="$2" cur val
  cur="$(current "$key")"
  echo
  if [ -n "$cur" ]; then
    echo "$title — token bor (${cur:0:8}...). Yangisini qo'ying yoki shunchaki Enter:"
  else
    echo "$title — BotFather'dagi tokenni qo'ying va Enter:"
  fi
  read -r val
  val="${val//[[:space:]]/}"
  if [ -z "$val" ]; then return 0; fi
  if ! [[ "$val" =~ ^[0-9]{6,}:[A-Za-z0-9_-]{30,}$ ]]; then
    echo "  DIQQAT: token ko'rinishi noto'g'ri (123456789:AAAA... bo'lishi kerak), o'zgartirilmadi"
    return 0
  fi
  set_var "$key" "$val"
  echo "  saqlandi"
}

echo "== Makulatura botlari tokenlari (BotFather > /mybots > bot > API Token)"
ask_token CUSTOMER_BOT_TOKEN   "1/3 Mijoz boti (@Pack24AI_bot)"
ask_token DRIVER_BOT_TOKEN     "2/3 Haydovchi boti (@pack24MX_bot)"
ask_token SUPERVISOR_BOT_TOKEN "3/3 Boshqaruv boti (@pack24AUP_bot): masul va rahbariyat bitta botda"
echo
echo "Shu ID'lar boshqaruv botida rahbariyat menyusini ko'radi."
echo "Rahbariyat Telegram ID'lari (vergul bilan, masalan 123456789,987654321; @userinfobot ko'rsatadi)."
cur="$(current HQ_ALLOWED_TELEGRAM_IDS)"
[ -n "$cur" ] && echo "Hozir: $cur"
echo "Yangisini yozing yoki Enter:"
read -r ids
ids="${ids//[[:space:]]/}"
if [ -n "$ids" ]; then
  if [[ "$ids" =~ ^[0-9]+(,[0-9]+)*$ ]]; then set_var HQ_ALLOWED_TELEGRAM_IDS "$ids"; echo "  saqlandi"; else echo "  DIQQAT: faqat raqamlar va vergul bo'lishi kerak, o'zgartirilmadi"; fi
fi
chmod 600 .env

echo
echo "== Sayt yangi sozlamalar bilan qayta ishga tushmoqda"
docker compose up -d --force-recreate web >/dev/null
ok=""
for i in $(seq 1 24); do
  if docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then ok=1; break; fi
  sleep 5
done
[ -n "$ok" ] || { echo "XATO: sayt javob bermadi. docker compose logs --tail=50 web"; exit 1; }

echo "== Webhook'lar o'rnatilmoqda"
OPS="$(current TELEGRAM_OPS_SECRET)"
[ -n "$OPS" ] || { echo "XATO: .env da TELEGRAM_OPS_SECRET yo'q"; exit 1; }
docker compose exec -T -e OPS="$OPS" web node -e '
const h = { authorization: "Bearer " + process.env.OPS, "content-type": "application/json" };
const base = "http://127.0.0.1:3000/api/telegram/setup";
(async () => {
  const r = await fetch(base, { method: "POST", headers: h, body: "{}" });
  const j = await r.json();
  if (!r.ok && j.error) { console.log("XATO:", j.error); process.exit(1); }
  const s = await (await fetch(base, { headers: h })).json();
  for (const b of s.bots || []) {
    const st = !b.configured ? "token yo'q" : b.error ? "XATO: " + b.error : b.webhookUrl ? "ishlayapti" : "webhook yo'q";
    console.log(`  ${b.title.padEnd(16)} ${b.username ? "@" + b.username : "-"}`.padEnd(42) + st);
  }
  if (!j.ok) process.exit(1);
})().catch((e) => { console.log("XATO:", e.message); process.exit(1); });
' && echo "== TAYYOR: botlar yangi saytga ulandi. Admin > Sozlamalar > Telegram botlar bo'limida ham ko'rinadi." \
  || echo "== Webhook o'rnatishda xato. Admin > Sozlamalar > Telegram botlar bo'limida qayta urinib ko'ring."
