#!/usr/bin/env bash
# Sun'iy intellekt (Anthropic Claude) kalitini .env ga yozish, saytni qayta ishga tushirish va haqiqiy so'rov bilan sinash.
# Nima yoqiladi: mijoz botida erkin yozilgan savollarga javob (mijoz faqat o'z buyurtma va balansini ko'radi) hamda
# har kuni soat 08:00 dagi tekshiruvga AI xulosasi (Admin > AI tekshiruv, boshqaruv boti).
# Serverda (savol-javob rejimida, shuning uchun ssh -t):
#   ssh -t -i ~/.ssh/KALIT root@SERVER /opt/pack24/deploy/ai-setup.sh
# Kalit: console.anthropic.com > API Keys > Create Key (hisobga oldindan mablag' kiritilgan bo'lishi kerak: Billing).
# Kalit faqat serverdagi .env ga yoziladi: ekranda ko'rinmaydi, logga tushmaydi, hech qayerga yuborilmaydi.
# Yangi kalit sinovdan o'tmasa avvalgi holat tiklanadi — ishlab turgan sozlama buzilmaydi.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "XATO: $(pwd)/.env yo'q — avval deploy/server-setup.sh"; exit 1; }
[ -t 0 ] || { echo "XATO: bu skript savol-javob rejimida ishlaydi — ssh -t bilan ishga tushiring"; exit 1; }

current() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '"' || true; }
# Qiymat buyruq satriga chiqmaydi (printf — bash'ning ichki buyrug'i), shuning uchun `ps` da ham ko'rinmaydi
set_var() {
  local key="$1" val="$2" tmp
  tmp="$(mktemp .env.XXXXXX)"
  chmod 600 "$tmp"
  grep -v "^$key=" .env > "$tmp" || true
  printf '%s="%s"\n' "$key" "$val" >> "$tmp"
  mv "$tmp" .env
}
# Sayt (web konteyneri) ni yangi .env bilan qayta ishga tushirish va javob berishini kutish
restart_web() {
  if ! docker compose up -d --force-recreate web >/dev/null; then
    echo "XATO: sayt qayta ishga tushmadi (docker xatosi yuqorida). Bir necha daqiqadan keyin skriptni qayta ishga tushiring."
    echo "      Hozirgi holat:"
    docker compose ps web || true
    return 1
  fi
  local i
  for i in $(seq 1 24); do
    if docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then return 0; fi
    sleep 5
  done
  echo "XATO: sayt javob bermadi. Oxirgi loglar:"
  docker compose logs --tail=30 web || true
  return 1
}

OLD_KEY="$(current ANTHROPIC_API_KEY)" # faqat sinov o'tmasa tiklash uchun; hech qayerga chiqarilmaydi
KEY_CHANGED=""
UNTESTED="" # yangi kalit .env ga yozilgan, lekin hali sinovdan o'tmagan
# Skript sinovgacha yetmay tugasa ham (qulf kutish muddati, Ctrl-C, SSH uzilishi, docker xatosi) sinalmagan kalit .env da qolmasin
RESTARTED="" # sayt yangi (sinalmagan) kalit bilan qayta ishga tushirilgan bo'lishi mumkin
restore_untested() {
  [ -n "$UNTESTED" ] || return 0
  UNTESTED=""
  set_var ANTHROPIC_API_KEY "$OLD_KEY"
  chmod 600 .env
  echo "== Yangi kalit sinalmadi — .env da avvalgi holat tiklandi. Skriptni qayta ishga tushirib, kalitni qaytadan qo'ying." || true
  # Sayt sinalmagan kalit bilan ishga tushib ulgurgan bo'lsa, avvalgi sozlama bilan qaytariladi (natijasi kutilmaydi)
  if [ -n "$RESTARTED" ]; then docker compose up -d --force-recreate web >/dev/null 2>&1 || true; fi
}
trap restore_untested EXIT

echo "== Sun'iy intellekt (Claude) sozlamalari"
echo
if [ -n "$OLD_KEY" ]; then
  echo "1/3 API kalit allaqachon kiritilgan. Yangisini qo'ying yoki shunchaki Enter (o'zgarmaydi)."
  echo "    AI'ni o'chirish uchun bitta chiziqcha (-) yozib Enter bosing."
else
  echo "1/3 Anthropic API kalitini qo'ying va Enter bosing (sk-ant-... bilan boshlanadi)."
fi
echo "    Kalit ekranda ko'rinmaydi — bu normal. Bir marta qo'yib, Enter bosing."
read -rs KEY || KEY=""
echo
KEY="${KEY//[[:space:]]/}"
if [ "$KEY" = "-" ]; then
  set_var ANTHROPIC_API_KEY ""
  KEY_CHANGED=1
  echo "    o'chirildi"
elif [ -n "$KEY" ]; then
  if [[ "$KEY" == *sk-ant-*sk-ant-* ]]; then
    unset KEY
    echo "    XATO: kalit ikki marta qo'yilganga o'xshaydi. Hech narsa o'zgartirilmadi — skriptni qayta ishga tushirib, bir marta qo'ying."
    exit 1
  fi
  if ! [[ "$KEY" =~ ^sk-ant-[A-Za-z0-9_-]{20,}$ ]]; then
    unset KEY
    echo "    XATO: kalit ko'rinishi noto'g'ri (sk-ant-... bo'lishi kerak). Hech narsa o'zgartirilmadi."
    exit 1
  fi
  if [ "$KEY" != "$OLD_KEY" ]; then
    UNTESTED=1
    set_var ANTHROPIC_API_KEY "$KEY"
    KEY_CHANGED=1
  fi
  echo "    saqlandi"
fi
unset KEY

if [ -n "$(current ANTHROPIC_API_KEY)" ]; then
  MODEL="$(current ANTHROPIC_MODEL)"
  echo
  echo "2/3 Model (raqamini yozib Enter; bo'sh qoldirilsa hozirgisi qoladi: ${MODEL:-claude-opus-5-5})"
  echo "    1) claude-opus-5-5    eng aqlli; bitta mijoz savoli taxminan 3-5 sent"
  echo "    2) claude-sonnet-5-5  muvozanatli; taxminan 2 sent"
  echo "    3) claude-haiku-5-5   eng tez va arzon; 1 sentdan ancha kam"
  read -r CHOICE || CHOICE=""
  case "${CHOICE//[[:space:]]/}" in
    1) set_var ANTHROPIC_MODEL "claude-opus-5-5"; echo "    saqlandi: claude-opus-5-5" ;;
    2) set_var ANTHROPIC_MODEL "claude-sonnet-5-5"; echo "    saqlandi: claude-sonnet-5-5" ;;
    3) set_var ANTHROPIC_MODEL "claude-haiku-5-5"; echo "    saqlandi: claude-haiku-5-5" ;;
    "") ;;
    *) echo "    noma'lum tanlov — o'zgartirilmadi" ;;
  esac

  LIMIT="$(current AI_DAILY_LIMIT)"
  echo
  echo "3/3 Kuniga eng ko'pi bilan nechta AI so'rovi (xarajat chegarasi)? Hozir: ${LIMIT:-300}. Yangi son yoki Enter:"
  read -r NEW_LIMIT || NEW_LIMIT=""
  NEW_LIMIT="${NEW_LIMIT//[[:space:]]/}"
  if [ -n "$NEW_LIMIT" ]; then
    if [[ "$NEW_LIMIT" =~ ^[1-9][0-9]{0,5}$ ]]; then
      set_var AI_DAILY_LIMIT "$NEW_LIMIT"
      echo "    saqlandi: $NEW_LIMIT"
    else
      echo "    kamida 1 bo'lgan son kerak — o'zgartirilmadi (AI'ni o'chirish uchun 1-savolda chiziqcha (-) kiriting)"
    fi
  fi
fi
chmod 600 .env

# Avtomatik yangilanish (deploy) bilan bir vaqtda ishlamaslik uchun o'sha qulf: yangilanish ketayotgan bo'lsa tugashi kutiladi,
# aks holda sayt eski versiyada qayta ishga tushib, sinov "404" bilan yiqilardi
exec 9>/var/lock/pack24-deploy.lock
if ! flock -n 9; then
  echo
  echo "== Saytda yangilanish ketyapti — tugashini kutyapman (10 daqiqagacha)"
  flock -w 600 9 || { echo "XATO: yangilanish hali tugamadi. 10 daqiqadan keyin skriptni qayta ishga tushiring."; exit 1; }
fi

echo
echo "== Sayt yangi sozlamalar bilan qayta ishga tushmoqda"
RESTARTED=1
restart_web || exit 1

if [ -z "$(current ANTHROPIC_API_KEY)" ]; then
  echo "== TAYYOR: AI o'chirilgan. Botlar va kunlik tekshiruv AI'siz ishlayveradi."
  exit 0
fi

echo "== Kalit haqiqiy so'rov bilan sinalmoqda"
# Maxfiy kalit (TELEGRAM_OPS_SECRET) konteynerning o'z muhitidan olinadi — buyruq satriga chiqmaydi.
# DIQQAT: quyidagi node skripti bash'da bitta tirnoq ichida — ichidagi matnlarda apostrof ISHLATILMAYDI
if docker compose exec -T web node -e '
const secret = process.env.TELEGRAM_OPS_SECRET || "";
if (!secret) { console.log("  XATO: .env da TELEGRAM_OPS_SECRET topilmadi"); process.exit(1); }
fetch("http://127.0.0.1:3000/api/ai/status", { method: "POST", headers: { authorization: "Bearer " + secret }, signal: AbortSignal.timeout(45000) })
  .then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (j.ok) { console.log("  ishlayapti, model: " + j.model); process.exit(0); }
    if (r.status === 404) console.log("  XATO: sayt hali yangi versiyaga yangilanmagan — bir necha daqiqadan keyin skriptni qayta ishga tushiring");
    else if (r.status === 401) console.log("  XATO: .env dagi TELEGRAM_OPS_SECRET qabul qilinmadi (16 belgidan qisqa yoki buzilgan)");
    else console.log("  XATO: " + (j.error || "javob kodi " + r.status));
    process.exit(1);
  })
  .catch((e) => { console.log("  XATO: " + e.message); process.exit(1); });
'; then
  echo "== TAYYOR: sun'iy intellekt ulandi."
  echo "   Mijoz boti: mijoz savolini oddiy matn bilan yozsa, AI javob beradi (faqat o'z buyurtmalari va balansi bo'yicha)."
  echo "   Tekshiruv: har kuni 08:00 dan keyin; natija Admin > AI tekshiruv sahifasida va boshqaruv botida."
  echo "   Xarajat: console.anthropic.com > Usage. Chegara va modelni shu skriptni qayta ishga tushirib o'zgartirasiz."
  UNTESTED=""
  exit 0
fi

# Sinov o'tmadi. Yangi kalit kiritilgan bo'lsa avvalgi holat tiklanadi: yaroqsiz kalit bilan mijoz botida har bir savolga
# "javob bera olmadim" chiqib turmasin va ishlab turgan avvalgi kalit yo'qolmasin.
if [ -n "$KEY_CHANGED" ]; then
  set_var ANTHROPIC_API_KEY "$OLD_KEY"
  UNTESTED=""
  chmod 600 .env
  echo "== Yangi kalit qabul qilinmadi (sababi yuqorida) — avvalgi holat tiklanmoqda"
  restart_web || exit 1
  if [ -n "$OLD_KEY" ]; then echo "== Avvalgi kalit qaytarildi. Sababni tuzatib, skriptni qayta ishga tushiring."; else echo "== AI o'chiq holda qoldi. Sababni tuzatib, skriptni qayta ishga tushiring."; fi
else
  echo "== Sinov o'tmadi (sababi yuqorida); kalit o'zgartirilmadi. AI'ni vaqtincha o'chirish: skriptni qayta ishga tushirib, 1-savolda chiziqcha (-) kiriting."
fi
exit 1
