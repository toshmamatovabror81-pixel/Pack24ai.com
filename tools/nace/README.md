# nace.ai (Drex) orqali qadoqlash fayllarini saralash

Bu papka Pack24 uchun qadoqlashga oid hujjatlarni **nace.ai** xizmati orqali saralash vositalari:
Document Intelligence (NDI) hujjatni toifalaydi (classify) va matnini Markdown qilib beradi (parse),
**Drex** qaror modeli esa har bir hujjat haqida "skil uchun foydalimi, qaysi bo'lim, qaysi til" deb javob beradi.
Natija pack24.uz skilini yozish uchun xomashyo bo'ladi.

## Fayllar

| Fayl | Nima uchun |
|---|---|
| `nace-kalit-ulash.cmd` | Windows: API kalitni **faqat kompyuterda** saqlaydi (`%USERPROFILE%\.nace\config.toml` + `NACE_API_KEY`). Ikki marta bosiladi, kalit yashirin maydonga qo'yiladi. Chatga kalit yozilmaydi. |
| `saralash.mjs` | Node 18+ skripti (tashqi kutubxona kerak emas). Papkalardagi fayllarni va internet havolalarini nace.ai ga beradi, natijani papkaga yozadi. |
| `manbalar.txt` | Internetdagi inglizcha va ruscha qadoqlash manbalari (har qatorda URL va nom). Skript ularni yuklamasdan, to'g'ridan-to'g'ri havola orqali nace.ai ga beradi. |

## Qadamlar (egasi uchun)

1. https://console.nace.ai → **API Keys** → **Create key** → kalitni nusxalang (bir marta ko'rinadi).
2. `nace-kalit-ulash.cmd` ni ikki marta bosing, kalitni qo'ying, **Saqlash**. Dastur kalitni tekshiradi va saqlaydi.
3. Claude'ga shu gapni yozing: **«Drex bu nace.ai; kalit kompyuterda saqlandi; nace orqali saralashni boshla»**.
   Keyingi ishni Claude kompyuteringizda bajaradi: avval 5 ta fayl bilan sinov, so'ng barcha fayllar va internet manbalari.

## Skriptni ishga tushirish (Claude yoki texnik odam uchun)

```
node tools/nace/saralash.mjs --papka "E:\Qadoqlash" --sinov                      # faqat ro'yxat, bepul
node tools/nace/saralash.mjs --papka "E:\Qadoqlash" --limit 5 --chiqish "E:\PACK24.uz\nace-natija"
node tools/nace/saralash.mjs --papka "E:\Qadoqlash" --manbalar tools/nace/manbalar.txt --chiqish "E:\PACK24.uz\nace-natija"
```

Parametrlar: `--papka` (bir nechta bo'lishi mumkin), `--manbalar <fayl>`, `--chiqish <papka>` (odatda `./nace-natija`),
`--sinov`, `--limit N`, `--parallel N` (1-8, odatda 2), `--rejim low|medium|high` (parse sifati, `low` eng arzon),
`--parse yoq` (faqat toifalash), `--drex yoq` yoki `--drex <model>` (odatda `drex-latest`, qabul qilinmasa `drex-v1.0`),
`--qayta` (tugaganlarni ham qaytadan), `--base-url` (sinov serveri uchun).

Kalit: `NACE_API_KEY` muhit o'zgaruvchisi, bo'lmasa `~/.nace/config.toml` dagi `api_key`.

## Natija papkasi

- `saralash-natija.md` — toifalar bo'yicha jadval (fayl, ishonch, Drex bo'limi, foydalilik, til, sahifa), Drex bo'limlari bo'yicha ro'yxat, xatolar.
- `index.json` — har bir fayl uchun to'liq yozuv (toifa, muqobil toifalar va sabab, Drex javoblari, sahifa soni, birliklar).
- `matn/<fayl>.md` — hujjat matni (Markdown, jadvallar HTML). Internet manbalari `matn/internet/<sayt>/` ichida.
- `qollab-quvvatlanmagan.md` — nace.ai o'qimaydigan fayllar (CorelDRAW `.cdr`, `.ai`, `.eps`, bo'sh yoki juda katta). Nomlari skil uchun baribir foydali.
- `holat.json` — jarayon holati; skript qayta ishga tushsa tugagan fayllar o'tkazib yuboriladi.
- `log.txt` — jurnal (kalit hech qachon yozilmaydi).

## Toifalar

narx_taklif, texnik_spets, maket, shartnoma, hisob_hujjat, sertifikat, prezentatsiya, ishlab_chiqarish, yozishma.
Drex bo'limlari: katalog, narxlar, materiallar, ishlab_chiqarish, mijozlar, boshqa; til: uz/ru/en.

## Xarajat

nace.ai parse va classify har bir sahifa/birlik uchun kreditdan sarflaydi (yangi hisobga 25$ bepul kredit, 3 oy).
Avval `--limit 5` bilan sinab, console.nace.ai da sarfni ko'ring, keyin hammasini yuboring. `--rejim low` eng arzon.
Drex so'rovlari arzon (token bo'yicha); matn 6000 belgigacha qisqartirib yuboriladi.

## Chegaralar

- CorelDRAW (`.cdr`) va `.ai`/`.eps` o'qilmaydi — bunday maketlarni PDF yoki PNG qilib eksport qilsangiz, ular ham saralanadi.
- 256 MB dan katta fayllar o'tkazib yuboriladi (bo'laklab yuklash qilinmagan).
- Internet havolasi ochiq (login talab qilmaydigan) bo'lishi kerak; `file_name` kengaytmasi URL dan olinadi, bo'lmasa `.html`.
