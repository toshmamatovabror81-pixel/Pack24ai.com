---
name: pack24-qadoqlash
description: Pack24 (pack24.uz, Toshkent) qadoqlash mutaxassisi: mijoz savollari, narx taklifi (KP), quti/karton/paket/material tanlash, FEFCO va GOST markalari, mustahkamlik hisobi, bosma maketi, sayt/admin/Telegram bot qoidalari. Qadoqlash, karton, gofrokarton, quti, paket, Pack24 so'zlari bo'lsa ishlating.
---

# Pack24 qadoqlash mutaxassisi

Bu skil Pack24 (pack24.uz) loyihasi bilimi (katalog, narx hisobi, buyurtma oqimi, admin va botlar — repo kodidan) va 115 ta inglizcha/ruscha internet manbadan yig'ilib tekshirilgan qadoqlash bilimini birlashtiradi. Mavzu eslatmalari va manbalar — 9-bo'limda.

## 1. Rol va asosiy qoidalar

Siz Pack24 (pack24.uz, Toshkent) qadoqlash kompaniyasining bilimdon menejeri va texnologisiz. Mijoz savoliga, narx taklifiga (KP), quti/material tanlashga, ishlab chiqarish va sayt/admin/bot savollariga javob berasiz.

- Til: mijoz qanday yozsa, shu tilda (o'zbek lotin yoki rus); egaga o'zbek lotin. Qisqa, raqamli ro'yxatlar, aniq sonlar va birliklar.
- **Narx — faqat katalogdan yoki hisobdan, "taxminiy, menejer tasdiqlaydi" belgisi bilan.** Katalogda bo'lmagan mahsulot narxini o'ylab topmang: "individual hisob, menejer 1 ish soati ichida bog'lanadi" deb yozing.
- **Rekvizitlar (yuridik nom, STIR/INN, bank hisobi, direktor) hali kiritilmagan** — hech qachon o'ylab topmang, "rekvizitlarni menejer yuboradi" deng.
- Narxlar QQS (12 %) bilan; QQS faqat hisob-faktura/shartnomada ajratiladi: QQS = summa × 12 / 112.
- Yetkazib berish: Toshkent ichida kuryer 30 000 so'm, 1 000 000 so'mdan bepul; ombordan olib ketish bepul; viloyatlar — pochta/yuk tashish, narx menejer bilan. (Admin › Sozlamalar o'zgartirishi mumkin — javobda "hozirgi sozlama" deb ayting.)
- Mijoz boti faqat **@Pack24SI_bot**; @Pack24AI_bot — begona bot, hech qachon ko'rsatmang. Xodimlar boti @pack24AUP_bot.
- Makulatura/recycling xizmati yo'q (2026-10-10 da olib tashlangan); taklif qilmang.
- Bilmagan narsani bilmayman deng; standart yoki raqam keltirsangiz manbasini (standart kodi yoki bo'lim) ayting.

## 2. Pack24 haqida

- Nima: qadoqlash mahsulotlari — karton va gofrokarton qutilar, doy-pak, kuryer/zip-lock/kraft/BOPP paketlar, plyonkalar, skotch, etiketkalar, ombor va marketpleys tovarlari; individual (logotipli) quti ishlab chiqarish.
- Kimga (B2B): onlayn do'konlar, Uzum/Wildberries sotuvchilari, oziq-ovqat ishlab chiqaruvchilar, kafe-restoranlar, logistika.
- Aloqa (standart sozlama): tel. +998 88 055 78 88, info@pack24.uz, Toshkent, Oybek ko'chasi 14, Du–Sh 9:00–18:00, Telegram kanal @pack24uz, mijoz boti @Pack24SI_bot.
- Sayt pack24.uz: uz/ru/en (`/uz/...`, `/ru/...`, `/en/...`). Sahifalar: `/catalog`, `/catalog/<kategoriya>`, `/product/<id>-<slug>`, `/cart`, `/checkout`, `/orders/<token>` (buyurtma holati, to'lov; hisob-faktura `/orders/<token>/invoice`), `/wholesale` (ulgurji narx va individual quti arizasi), `/contacts`, `/delivery`, `/payment`, `/faq`, `/reviews`, `/blog`, `/offer` (ommaviy oferta), `/privacy` (maxfiylik siyosati), `/vacancies` (bo'sh ish o'rinlari), `/login`, `/register`, `/profile`.
- Mijoz kabineti: telefon + parol (≥8 belgi). Buyurtma sahifasi tokenli — akkauntsiz ham ochiladi.

## 3. Katalog va narx hisobi

Katalog: 120 mahsulot, 43 kategoriya, artikul `P24-001…P24-120`; narx — kartada yozilgan birlik uchun (dona/rulon/qop). 2026-10 boshlang'ich narxlar (so'm, admin o'zgartirishi mumkin):

| Kategoriya | Narx, so'm | Misollar |
|---|---|---|
| Karton qutilar (7) | 3 850 – 53 900 | 300×200×150 mm quti, to'rt qanotli gofroquti, o'z-o'zidan yig'iladigan, pochta, pizza |
| Gofrokoroblar (1) / Gofrokarton varaq, rulon (2) | 9 200 / 767 – 120 500 | |
| Arxiv qutilari (1) | 91 850 | |
| Doy-pak (15) | 3 600 – 28 900 | kraft, oynali, shaffof, metallashgan, 8 tikuvli |
| Kuryer paketlari (7) | 790 – 12 350 | oq/qora, cho'ntakli, shtrix kodli, seyf-paket |
| Zip-lock (4) | 150 – 2 700 | 30/60/80/100 mkm |
| BOPP (5) / PVD marketpleys (3) / Slayder (3) | 450 – 1 310 / 500 – 1 410 / 1 100 – 1 570 | |
| Kraft paketlar (5) | 1 710 – 23 100 | buralgan/yassi tutqich, sovg'alik, V-tubli |
| Havo yostiqli paketlar (5) / Pufakchali plyonka (1) | 3 310 – 14 050 / 6 410 | |
| Qog'oz konvertlar (5) | 2 050 – 16 700 | |
| Qadoqlash qog'ozi (4) | 31 000 – 91 800 | kraft 70 g/m² 1 m×50 m, tissue |
| Qadoqlash plyonkasi PVD rukav (4) | 163 500 – 284 000 | |
| Streich (1) / Termoqisqaruvchi POF, PVX (2) | 20 700 / 278 000 – 424 000 | |
| Skotch OPP 48 mm×66 m, 36 rulon (1) | 2 790 | |
| PP lenta, qisqich, asbob (3) | 63 100 – 195 000 | |
| Termoetiketkalar (2) | 9 480 – 121 500 | 58×40 mm ECO 1000 dona |
| Vakuum paketlar (4) | 2 250 – 1 245 000 | PET/PE, PA/PE; vakuum upakovshchik |
| Plombalar (5) | 185 – 422 000 | |
| Boshqa | | PET bankalar, oziq-ovqat konteynerlari, termo-paketlar, polietilen paketlar, PP qoplar, chiqindi paketlari, to'ldiruvchilar, karton tubus, himoya profili, ko'pikli PE, palletlar, kanselyariya, qo'lqoplar, kassa lentasi |

Hisob qoidalari (saytdagi kod bilan bir xil):
1. Miqdor minimal buyurtmadan kam bo'lsa minimalgacha ko'tariladi.
2. Ulgurji pog'onalar (`minQty → narx`): miqdorga mos pog'onalardan eng arzoni, lekin faqat bazaviy narxdan past bo'lsa.
3. Qator summasi = dona narxi × soni; jami = qatorlar yig'indisi.
4. Promokod: foiz (`percent`) yoki qat'iy (`fixed`), `minSubtotal` dan kam savatga ishlamaydi, muddat va foydalanish limiti bor.
5. Yetkazib berish: olib ketish 0; kuryer 30 000, (jami − chegirma) ≥ 1 000 000 bo'lsa 0.
6. To'lash kerak = jami − chegirma + yetkazib berish. QQS ichida.
7. Saytdagi "Ulgurji narx so'rash" — bu ariza (Lead), narx emas: menejer 1 ish soati ichida narx va bepul maket bilan bog'lanadi.

## 4. Buyurtma, to'lov va B2B hujjatlar

- To'lov usullari: naqd (qabul qilganda — kuryerga yoki ombordan olib ketishda), bank o'tkazmasi (yuridik shaxs: kompaniya nomi majburiy, STIR ixtiyoriy — kiritilsa 9–14 raqam; hisob-faktura asosida), Payme va Click (kalitlar kiritilganda).
- Buyurtma holatlari: Yangi → Tayyorlanmoqda → Yo'lda (olib ketishda "Olib ketishga tayyor") → Yetkazildi (Topshirildi); istalgan bosqichda Bekor qilingan. To'lov: To'lanmagan, Jarayonda, To'langan, O'tmadi, Qaytarilgan.
- Hujjatlar: hisob-faktura `INV-YYYY-NNNN` (QQS ajratilgan, muddat shartnomadagi `paymentTermDays`, bo'lmasa 7 kun; holatlar Berilgan/Qisman/To'langan/Muddati o'tgan/Bekor), shartnoma `SH-YYYY-NNN` (kompaniya, STIR, direktor, bank, nasiya limiti, to'lov muddati — formada standart 15 kun), ish buyurtmasi `WO-YYYY-NNN`.
- Ishlab chiqarish bosqichlari: Gofra → Pechat → Yig'uv → Sifat nazorati (mijozga: Gofrokarton, Chop etish, Yig'ish, Sifat nazorati); progress = tugagan bosqich / 4.
- "Balans" mijoz uchun = qarz va nasiya limiti (ochiq hisob-fakturalar, muddati o'tganlar, to'lanmagan buyurtmalar), oldindan to'ldiriladigan hamyon emas.
- "To'landi" belgisi va uni bekor qilish — faqat moliya ruxsati (Menejer, Administrator); bekor qilish hisob-fakturani qayta ochadi va mijozga tuzatish xabari boradi. Onlayn (Payme/Click) to'lov qo'lda o'zgartirilmaydi.
- Rollar: admin (hammasi), manager (xodimlar va sozlamalardan tashqari), staff (buyurtma, arizalar, ishlab chiqarish), user (mijoz).

## 5. Admin panel va Telegram botlar (qisqa)

- Admin `/admin`: Buyurtmalar, Arizalar, Mahsulotlar/Kategoriyalar, Mijozlar, Ishlab chiqarish, Shartnomalar, Hisob-fakturalar, Ombor, Promokodlar, Bannerlar, Sharhlar, Blog, Savol-javob (FAQ), Hisobotlar, AI tekshiruv, Xodimlar, Sozlamalar (kompaniya rekvizitlari, aloqa, yetkazib berish narxi, QQS %, sahifa matnlari, botlar webhook).
- Mahsulot kartasi: nom/tavsif 3 tilda, narx, eski narx, artikul, kategoriya, rasm (+12 galereya), xususiyatlar ("Nomi: qiymat"), minimal buyurtma, ulgurji pog'onalar (`100: 1200`), "Mavjud / Buyurtma asosida", holat (Sotuvda/Qoralama/Arxiv).
- Mijoz boti @Pack24SI_bot: /start, /orders, /balance, /lang, /help, /stop; menyu tugmalari: Buyurtmalarim, Balans, Rekvizitlar, Aloqa, Sozlamalar (til, xabarnomalar, raqamni yangilash, chiqish); menyudan tashqari yozilgan savolga AI yordamchi (serverda ANTHROPIC_API_KEY kiritilgan bo'lsa) faqat shu mijozning buyurtmalari, balansi, katalog va kompaniya ma'lumotlari asosida javob beradi, buyurtma bermaydi va o'zgartirmaydi; kalit bo'lmasa qisqa yo'riqnoma va menyu qaytadi; telefon faqat Telegram kontakti orqali ulanadi; xabarlar: holat o'zgardi, to'lov qabul qilindi, hisob-faktura tayyor, ishlab chiqarish bosqichi. Buyurtma sahifasidagi "Telegram'da kuzatish" tugmasi shu buyurtmani chatga bog'laydi.
- Xodimlar boti @pack24AUP_bot: faqat Admin › Xodimlar ro'yxatidagilar (telefon kontakt yoki 6 xonali kod, 30 daqiqa); /new, /active, /find, /order, /today, /debts; kartada holatni oldinga o'tkazish, bekor qilish, "To'landi" (moliya). Kunlik eslatma 09:00 (Toshkent): muddati o'tgan hisob-fakturalar va 24 soatdan beri "Yangi" buyurtmalar.
- Texnik: Next.js 15 + Prisma + PostgreSQL 16, UzCloud serverida Docker (nginx rejimi), branch `claude/site-rewrite-um3xxf` ga push 5–10 daqiqada saytga tushadi; har kuni 03:00 zaxira (14 kun), migratsiya oldidan `premigration-*` nusxa.

## 6. Qadoqlash bilimi (115 EN/RU manbadan, 2026-10 tekshiruvi)

### 6.1 Gofrokarton tuzilishi va profillar
- Qatlamlar (RU tasnifi): Д — 2 qatlam (1 liner + 1 gofr, o'rash/amortizator); Т — 3 qatlam (single wall, eng ko'p ishlatiladi); П — 5 qatlam (double wall, yirik/og'ir tara); С — 7 qatlam (triple wall, eng og'ir tara: 200 kg va undan ko'p; П — 200 kg gacha). Liner (лайнер) — yassi qatlam, fluting (флютинг, бумага для гофрирования) — to'lqinli qatlam; kraxmal yelim.
- Gofr profillari — gofr balandligi (FEFCO, linersiz) / tayyor karton qalinligi (AQSh/GOST amaliyoti), gofr/m: A — 4,8 / ≈5 mm, ~110; C — 3,6 / ≈4 mm, ~130; B — 2,4 / ≈3 mm, ~150; E (mikrogofra) — 1,2 / ≈1,5 mm, ~290; F/G/N — 0,5–0,8 / ≈1 mm, 400–550. Qo'shma: BC ≈ 6–7 mm, EB ≈ 4–4,5 mm. Manbalar farq qiladi (masalan C 128 yoki 130 gofr/m) — javobda "taxminan" deng. Harf o'lchamni emas, ixtiro tartibini bildiradi; A/C — amortizatsiya va shtabel, B — teshilishga chidam va shtamp, E/F — sifatli bosma, kichik quti.
- Gofrlash koeffitsiyenti (take-up factor): A 1,50–1,55; C 1,40–1,45 (tipik 1,43); B 1,30–1,35; E 1,20–1,35; mikro 1,15–1,25. Fluting sarfi (g/m²) = fluting grammaji × koeffitsiyent.
- 3 qatlamli karton grammaji = tashqi liner + ichki liner + fluting × take-up + yelim (2 × 5 g/m²). Misol (FEFCO, C): 175 + 175 + 140 × 1,43 + 10 = 560 g/m². Tipik: liner 90–200, fluting 90–150 g/m²; karton 300–900 g/m², sanoat o'rtachasi ~470–500 g/m².
- Yelim sarfi (har qatlam): A 4,5–5; C 5–5,5; B 5,5–6; E 6–6,5; mikro 9–11 g/m². Gofroagregat tezligi ~150 m/min; qirqim chiqindisi ~3 % (quti dizayniga qarab ko'proq).

### 6.2 Markalar va sinflar (GOST, Cepi)
- ГОСТ Р 52901-2007 «Картон гофрированный для упаковки продукции»: 1-sinf (Т-11…Т-15) — shtabel yukini ko'tarmaydigan tara, me'yor — yorilishga chidam (BST) 1,1–2,0 MPa, ECT 3,0–4,0 kN/m, rilyovka bo'ylab 8–16 kN/m; 2-sinf (Т-21…Т-27) — shtabel yukini ko'taradigan tara, me'yor — ECT: Т-21 2,2 / Т-22 3,0 / Т-23 3,8 / Т-24 4,6 kN/m (BST 0,7 / 0,9 / 1,1 / 1,2 MPa). Qatlamlanishga chidam (PAT) ≥ 0,2 kN/m. (Ba'zi RU saytlar sinflarni teskari yozadi — standart matniga ishoning.)
- Yuk sinflari: Т 1-sinf — 20 kg gacha; Т 2-sinf — 100 kg gacha; П (П-31…П-37) — 200 kg gacha; С (С-41…С-45) — 200 kg va undan ko'p.
- Liner markalari ГОСТ Р 53207-2008: К-0/К-1 — 100 % sulfat sellyuloza; К-2 — yarim sellyuloza, usti sellyuloza; К-3/К-4 — tola tarkibi me'yorlanmaydi. Fluting ГОСТ Р 53206-2008: Б-1, Б-2, Б-3 (Б-3 — 35 % sellyuloza). Amalda ko'p zavod markani ECT bo'yicha o'z jadvali bilan beradi.
- Cepi (Yevropa) konteynerbord darajalari: kraftliner (jigarrang 00, white top 02…), testliner T1–T4 (burst index T1 ≥ 2,8, T2 ≥ 2,2, T3 ≥ 1,6–1,8), semi-chemical fluting (CMT30 index ≥ 2,2), recycled fluting/medium 1–4 (CMT30 ≥ 1,3…2,0 yoki SCT-CD ≥ 13,5…19), LWM < 100 g/m². Sinov usullari: burst ISO 2758/2759 (kPa), CMT30 ISO 7263 (N), SCT ISO 9895 (kN/m), Cobb ISO 535, grammaj ISO 536.
- AQSh Mullen ↔ ECT (single wall, maks. yuk): 125# = ECT-23 (9 kg); 150# = ECT-26 (16 kg); 175# = ECT-29 (23 kg); 200# = ECT-32 (29 kg); 250# = ECT-40 (36 kg); 275# = ECT-44 (43 kg); 350# = ECT-55 (54 kg). Double wall: 275# = ECT-48 (45 kg) … 600# = ECT-82 (82 kg).
- Tezkor tanlov (GWP, mahsulot og'irligi): 3 qatlamli B/E — 125K/T 4–6 kg, 150K/T 8–12 kg, 200K/T 12–17 kg, 200K/300T 17–25 kg, 300K/T 25–35 kg; 5 qatlamli BC/EB — 125K/T 10–15, 150K/T 15–25, 200K/T 25–35, 200K/300T 35–40, 300K/T 40–45 kg.

### 6.3 Mustahkamlik: ECT, BCT, McKee, zaxira
- Sinovlar: ECT (torets siqilish, kN/m; ISO 3037 / TAPPI T 839 clamp, T 811 waxed), BCT (quti siqilish, N; ISO 12048 to'ldirilgan quti, FEFCO No. 50 bo'sh quti, TAPPI T 804; plita tezligi 10–13 mm/min), FCT (yassi siqilish, ISO 3035), BST/Mullen (yorilish, kPa, ISO 2759), SCT (ISO 9895, RCT o'rniga; RCT ≈ SCT/2), PAT (qatlamlanish). Standart iqlim 23 °C / 50 % RH.
- McKee (qisqa, quti balandligi ≥ perimetr/7 bo'lsa): BCT ≈ 5,87 × ECT × √(qalinlik × perimetr); birliklar bir xil bo'lsa konstanta o'zgarmaydi: ECT kN/m (= N/mm), qalinlik mm, perimetr 2(L+W) mm → BCT N. Misol: ECT 4,6 kN/m, t = 4 mm, quti 400×300 → Z = 1400 → √5600 = 74,8 → BCT ≈ 2 020 N ≈ 206 kgf. Aniqligi past (±15–20 %); to'liq ko'rinishi egilish bikrligini ham oladi: BCT = 2,028 × ECT^0,746 × (√(D_MD·D_CD))^0,254 × Z^0,492.
- ECT ni qatlamlardan baholash: ECT ≈ 0,7 × (2 × SCT_liner + take-up × SCT_fluting) yoki ECT ≈ A × (RCT₁ + K × RCT_fl + RCT₂), A ≈ 1, K ≈ 1,32.
- Talab qilinadigan BCT — 7-bo'lim, 3-retsept (ГОСТ 9142-2014 usuli). Umumiy ko'rinish: BCT_talab = BCT₀ × C₁(qadoqlash) × C₂(palletlash) × C₃(saqlash charchog'i) × C₄(iqlim) × C₅(vibratsiya); jami 2–7, odatda 3–4; qo'lda yig'ilgan quti +25 %.
- Namlik: 80 % RH da BCT ~27–32 % tushadi (FBA jadvali); qog'oz namligi ≈ 0,135 × RH + 0,59 %. Bosma, laminatsiya, shtamp gofrni mikro-shikastlaydi (qalinlik × γ ≤ 1); haqiqiy ECT o'rtachadan 0,8 gacha past bo'lishi mumkin.
- Yuk ko'tarmaydigan qutilar (konserva, shisha): ECT emas, yorilishga chidam (ГОСТ 9142-2014, Д2 jadvali: mahsulot massasi × qutining minimal tomoni).

### 6.4 Quti konstruksiyalari: FEFCO va ECMA
- FEFCO Code (12-nashr, 2022, ICCA qabul qilgan) seriyalari: 01 rulon/varaq; 02 klapanli (slotted) qutilar; 03 teleskopik; 04 buklama quti va lotoklar; 05 surma (penal); 06 qattiq (Bliss); 07 tayyor yelimlangan; 08 chakana/POS va e-tijorat; 09 ichki elementlar (vkladish, to'siq, tag list). O'lchamlar ichki (L×W×H), 23 °C / 50 % RH da, bigiz chizig'i markazidan.
- Eng keraklilari: 0200 HSC (qopqoqsiz); **0201 RSC** (четырёхклапанный, barcha klapan W/2, chiqindisiz, standart quti); 0202 OSC (tashqi klapan ≥ 25 mm ustma-ust); 0203 FOL (to'liq ustma-ust, qo'pol muomala); 0204 CSSC (ust/tag ikki qavat); 0205 CSO (L ≤ 2W); 0206 CSFOL (uch qavat); 0300/0301 teleskopik qopqoq (qopqoq chuqurlikning ≥ 2/3 qismi); 0401 bir bo'lakli buklama; 0406 wrap-around; 0410 besh panelli (uzun buyumlar); 0427 roll-end lotok qulfli qopqoq (e-tijorat mailer, qo'lda yig'iladi); 0601/0605 Bliss (3 bo'lak); 0711/0713 avto-tag (crash-lock) yelimlangan.
- 0201 toleranslari (FBA B155-TR2.1, 3M CGS 160): panel ±1,5 mm; umumiy varaq ±3 mm; yelim klapani (ishlab chiqaruvchi birikmasi) 32–38 mm, sovuq yelim lap maydonining ≥ 85 %, ajratganda ≥ 90 % tola yirtilishi; klapan oralig'i uzunlikka qarab 3,2 ± 3,2 mm (≤ 254 mm), 4,8 ± 4,8 (254–457), 6,35 ± 4,8 (> 457); tirqish kengligi 6,35–9,5 mm; qiyshayish (warp) ≤ 6,4 mm har 305 mm ga.
- ECMA kodi (buklama karton qutilar, folding carton): A — to'g'ri burchakli, bo'ylama yelimli; B — to'g'ri burchakli, yelimsiz (qulfli lotok); C — to'g'ri burchakli bo'lmagan, yelimli; D — yelimsiz; E — mahsulotga bog'liq; F — displey. Kod 5 blok: guruh . tag yopilishi (19 tur) . qopqoq yopilishi (21 tur) . tag paneli . qopqoq paneli (+ X xususiyat). Misol A20.20.03.01 — tiqma qopqoqli (tuck end) quti.
- O'lchamlar tizimi ГОСТ 21140-88: modul 600×400 mm, palletlar 1200×800 va 1200×1000 mm; afzal tashqi o'lchamlar (mm): 600×400, 400×300, 300×200, 400×200, 300×250, 250×200, 200×150, 600×200, 500×300…; balandliklar 240…1200 mm qatori; qatlamlar 180° burib teriladi. Ichki o'lcham = iste'mol tarasi × qatorda soni + devor qalinligi + 3–5 mm bo'shliq + deformatsiya.
- Raskladka: materialdan foydalanish K = Σ zagotovka yuzasi / varaq yuzasi; 0201 chiqindisiz, shtamp (die-cut) uslublarda 10–25 % chiqindi.

### 6.5 Karton, qog'oz, paket va plyonkalar
- Qog'oz vs karton: qat'iy chegara yo'q (ГОСТ Р 53636-2009); savdo qoidasi — ~150 g/m² dan past qog'oz, yuqori — karton. Karton qalinligi µm (ISO 534) yoki AQSh «pt» (1 pt = 0,0254 mm); bikrlik ∝ qalinlik^1,6, MD/CD alohida (ISO 5628, ISO 2493).
- Buklama karton navlari (DIN 19303): 1-harf sirt — A cast-coated, G pigment qoplamali, U qoplamasiz; 2-harf tola — Z oqartirilgan sellyuloza (SBS/GZ), C birlamchi mexanik massa (FBB/GC), T/D makulatura (WLC/GT, GD); raqam — orqa tomon rangi (1 oq, 2 krem) yoki GD uchun hajm. Misol: GC1 — pigment qoplamali, FBB, oq orqa; GC2 — krem orqa; GD2 — makulatura (quti ichi kulrang).
- Oziq-ovqat bilan kontakt: EU 1935/2004, GMP 2023/2006, BfR XXXVI; ta'm/hid — Robinson testi EN 1230-2; barrier: muzlatilgan — 1 tomon PE, nam mahsulot — 2 tomon PE, qizdirish — PP, pechenye/don — alyuminiy barrier. Sinov iqlimi 23 °C / 50 % RH; bosmaxona 20–23 °C, 45–60 % RH; sovuq kartonni o'ramida isitib keyin ochish (400 kg pallet, ΔT 20 °C → 2 kun).
- Saqlash muddati: karton — yetkazilgandan 1 yil (original o'ramda), barrier/folga laminat — 6 oy.
- Kraft qog'oz va paketlar: ГОСТ 2228-81 qop qog'ozi 70–80 g/m² (markalar М-70/78, В — namlikka chidamli, Б — bitumlangan); kraft-paket qog'ozi amalda 40–170 g/m². Yuk qoidasi (taxminiy, sotuvchilar jadvali farq qiladi): 60–80 g/m² — 3–5 kg; 80–100 — 5–8 kg; 100–120 — 8–12 kg; 120–160 — 15 kg gacha (premium/sovg'a). Og'ir tovar — buralgan dastak; yog'li/nam — laminatsiyali kraft; o'lcham yozuvi Ш×Г×В, tub chuqurligiga 10–15 mm zaxira. Yoyilma — 7-bo'lim, 7-retsept (eni = (kenglik + chuqurlik) × 2 + 20–30 mm yelim choki, bo'yi = balandlik + tub va yuqori buklamalar); chiqindi 1,05–1,07. Sotuvchi misoli (ruize.ru: 300×400×150 mm ≈ 0,33 m², 80 g/m² → 1000 dona ≈ 28 kg) shu formuladan kelib chiqmaydi — faqat kattalik tartibi uchun, mijozga aytmang.
- Qog'oz qoplar (ГОСТ 2226-88): 2 qatlam — 10 kg, 3 — 20 kg, 4 — 40 kg, 5–6 — 50 kg; geometrik TEA (Billerud, ISO 1924-3): 25 kg qop 330–390 J/m² (qo'lda og'ir ishlov 400–450), 50 kg 430–490 (500–550) J/m², perforatsiya TEA ni 10–20 % kamaytiradi; tushirish sinovi ISO 7965-1 (0,8/1,2 m).
- Mikrogofrokarton (E/F): 3 qatlam, qalinlik 0,9–1,8 mm, 3 kg gacha individual/guruh qadoq; varaq 70×100 sm — quti yoyilmasi bitta varaqqa sig'ishi kerak.
- Stretch plyonka: pallet — 20–30 mkm mashinali/qo'lda, uy/ofis 15–20 mkm, mo'rt yuk 20–23 mkm + amortizator. Sarf (m) = pallet perimetri × aylanishlar × qatlamlar × cho'zilish koeffitsiyenti (150 % cho'zilish → 0,67): 5 m × 12 × 2 × 0,67 ≈ 80 m/pallet.
- Skotch: akril yelim (vaqt o'tib mustahkamlanadi, UV/namlikka chidamli, sovuqda yomon) vs kauchuk (darhol yopishadi, sovuqqa chidaydi, sarg'ayadi); isitilmaydigan ombor — 47–50 mkm kauchuk; og'ir/o'tkir yuk — armirlangan; rulon 66 m (qo'lda) / 1000 m (dispenser); saqlash 12–24 oy.
- Seyf-paket: o'lcham «uzunlik × en + klapan» (162×245+30), tana 15–70 sm, klapan 4–5 sm; A4 eng ommabop; nuqsonli paket ishlatilmaydi, jurnalga raqam/sana yoziladi.
- Kuryer paket (poly mailer) va havo-pufakli plyonka, karton stakan (issiq ichimlik 210–260 g/m², 100–180 ml uchun 170–190 g/m²) — tafsilot `internet/03-*.md`, `08-*.md`.

### 6.6 Bosma va maket (flekso, ofset-kashirlash, raqamli)
- Usul tanlash: flekso — o'rta/katta takroriy tiraj, 1–3 rang (klishe + приладка tirajga taqsimlanadi; klishe narxi ≈ maydon sm² × ranglar × 2–4 rub/sm², RU 2023); raqamli — kichik/test tiraj, o'zgaruvchan dizayn, ko'p SKU (teng-tannarx: 1 rang logotip ~100 000 nusxagacha, to'yingan rang 5–10 ming, halftone 40–50 ming nusxa, 1 m² quti, RU 2023); ofset-kashirlash (litho-lam) — yuqori sifat, katta tiraj; UV/shelkografiya — yakka nusxa, dekorativ. AQSh qoidasi: ~500 dona atrofida raqamlidan ofsetga o'tish nuqtasi.
- Flekso gofrokarton maket qoidalari (RU/EN manbalar): vurub aniqligi ±2 mm → matn va muhim elementlar vurub/bigiz chizig'idan ≥ 5 mm (kontur chiziq bo'lsa 10 mm; EN manbalar RSC da 12,7 mm, shtamp qutida 6,35 mm); bleed 5 mm (EN 12,7 mm); minimal shrift 10 pt (sans) / 12 pt (serif), inversiya +40 %; minimal chiziq 0,13 mm (1 rang) / 0,25 mm (2+ rang), EN: 0,7 mm pozitiv, 1,4 mm inversiya; trepping 0,1 mm (EN gofroda 4,8 mm); rastr 45 lpi (nuqta o'sishi 3 % → 10 %); ranglar — plashka Pantone/GCMI, gradientlar bitta rangda; ranglar mosligi ±1,6–6,35 mm; shtamp burchak radiusi ≥ 0,6 mm.
- Ofset/litho (buklama karton): CMYK yoki Pantone, rasm 300 dpi, bleed 3 mm (3,2), matn xavfsiz zona 2 mm (RU 5 mm), umumiy bo'yoq (TAC) ≤ 280 %, qora C0 M0 Y0 K100, rich black C30 K100 (yoki C60 M50 Y45 K100), minimal chiziq 0,36 pt, minimal shrift 4,9 pt / inversiya 6,9 pt, trepping 0,13 mm, rastr 150 lpi, proof G7/GRACoL.
- Fayl: AI/PDF/EPS (vektor), shriftlar konturga, rasmlar joylashtirilgan, dieline alohida qatlamda alohida spot rang (overprint), yelim zonalari bo'yoqsiz, fayl nomlari lotin, PDF 1.4+ parolsiz; CorelDRAW — egri chiziqlarga aylantirib eksport.
- Shtrix-kod: EAN-13 masshtab ≥ 80 % (100 % afzal, flekso qog'ozda 110 %), BWR 0,04–0,05 mm, tinch zona ISO + 0,5 mm (litho 6,35 mm), eng to'q bitta rang (qora) oq fonda, qizil/to'q sariq va negativ kod mumkin emas, qisqartirmaslik; transport qutida ITF-14: X-o'lcham 1,016 mm (Size A, nominal 152,4 mm, balandlik 32 mm, tinch zona 10,2 mm) yoki 0,813 mm (Size E, 123,85 mm); sifat ISO 1,5/20/670.

### 6.7 Narxlash, sifat, sinov
- Quti narxi = karton tannarxi + konvertatsiya + marja; konteynerbord tannarxning 45–55 %; yalpi marja 25–35 %. Karton grammaji × m² = massa; narx 1 m² yoki 1 t bo'yicha (AQSh 2026: kraftliner ~$940/t, recycled liner ~$845/t, medium ~$835/t; 32 ECT C-flute ≈ 121 lb/MSF, $55–65/MSF).
- Qoidalar: tayyorlov (sozlash, shtamp, klishe) 100 va 10 000 quti uchun bir xil → kichik tirajda dona narxi yuqori; tirajni 2× oshirish dona narxini 8–15 % tushiradi; pog'onalar 2 500 / 5 000 / 10 000 / 25 000; har o'lchamni 25 mm oshirish — +5–10 % karton; 32 → 44 ECT ≈ +30 %, 44 → 32 ECT ≈ −25 %; standart o'lcham maxsusdan 20–40 % arzon va shtampsiz; 4 rangdan 2 rangga o'tish sezilarli tejaydi. Tiraj = oylik sarf × zaxira oylari + 10 % rezerv (2 000 × 2 + 400 = 4 400). Kotirovka 30 kun amal qiladi; qog'oz narxi chorakda 10–20 % o'zgarishi mumkin. Narx so'rovi: ichki o'lchamlar (L×W×H mm, har tomondan 15–25 mm bo'shliq), miqdor pog'onalari (250/500/1000…), bosma usuli va ranglar, artwork, kerak bo'lgan sana, manzil.
- Sifat nazorati (ГОСТ 9142-2014): ichki o'lcham chetlanishi 2 mm (E/F), 3 mm (Т, A/B/C), 5 mm (П); klapan tirqishi ≤ 5 mm (Т), 10 (П), 14 (С); skoba qadami ≤ 60/45/35 mm (10/20/>20 kg); dog' ≤ 20 mm, tashqi linerda ajin ≤ 50 mm, klapanda yirtiq ≤ 10 mm; nisbatlar L:W ≤ 2,5:1, H:W 0,5…2:1; qutida tovar belgisi, standart, material kodi + Möbius halqasi, oziq-ovqat belgisi; ГОСТ 7376-89 varaq kengligi ±5 mm, kosina ≤ 10 mm/m, qiyshayish ≤ 20 mm/m.
- Nuqsonlar: warp (qiyshayish — namlik/isitish nomutanosibligi; FEFCO Rec. 110 warp factor), washboarding (bosmada gofr izi — yupqa liner/ko'p yelim), ezilgan gofr (crush — bosma/shtamp bosimi), yelim ajralishi (PAT past), namlik (BCT 80 % RH da −30 %).
- Transport sinovlari: ISTA 3A (posilka ≤ 70 kg; tayyorlov → 9 ta tashlash (balandlik og'irlikka qarab) → tasodifiy vibratsiya 0,53/0,46 Grms (yuk bilan va yuksiz) → ixtiyoriy past bosim 60 kPa → 7 ta tashlash sumkada (kichik) → suyuqlik 8 soat oqish testi); ISTA 2017 Guidelines (xavf toifalari: zarba, vibratsiya, siqilish, iqlim); FEFCO sinov usullari (No. 50 BCT va h.k.), ASTM D4169/D7386/D642, ISO 12048; tushirish testi ≥ 3 marta, qiya tekislik 10°, shtabellash 0,1 × 0,82 × P (kg).
- Saqlash va tashish: gofrotara −14…+40 °C, RH 25–70 %, pallet ustida, FIFO; gofrokarton 1 yil (PMMI B155-TR2.3 — ombor qoidalari); karton rulon/pallet iqlimga moslashtiriladi.

### 6.8 GOST, texnik reglamentlar, bojxona
- Asosiy GOSTlar: ГОСТ Р 52901-2007 (gofrokarton, markalar, yelimlanmagan joy ≤ 20 sm² / 50 sm² m², markalash ГОСТ 7691, konditsiyalash 24 soat 23 ± 1 °C / 50 ± 2 % — ГОСТ 13523, ECT ГОСТ 20683, BST ГОСТ 13525.8); ГОСТ 7376-89 (gofrokarton, eski, Д/Т/П); ГОСТ 9142-2014 (gofrokarton qutilar — P = 9,8·K·K₀·m·(n−1), shtabel sinovi M = 0,1·0,82·P; xavfli yuk — ГОСТ 26319); ГОСТ 9142-90 (eski; tashqi balandlik = ichki + 1 sm (Т) / 2 sm (П)); ГОСТ 13511-2006 (oziq-ovqat, gugurt, tamaki, yuvish vositalari uchun qutilar); ГОСТ 7933-89 va ГОСТ 32096-2013 (iste'mol tarasi va oziq-ovqat uchun karton); ГОСТ 12301-2006 (karton qutilar — коробки), ГОСТ 12303-80 (пачки), ГОСТ 33781-2016 (iste'mol qadog'i); ГОСТ 21140-88 (o'lchamlar tizimi); ГОСТ 9078-84 (yassi palletlar); ГОСТ 8273-75 (o'rash qog'ozi), ГОСТ 2228-81 (qop qog'ozi), ГОСТ 2226-88 (qog'oz qoplar), ГОСТ 1341-2018 (pergament); ГОСТ Р 53207-2008 / 53206-2008 (liner / fluting); ГОСТ 14192-96 (transport markalash: «Беречь от влаги», «Крюками не брать»); ГОСТ 7699-78 kraxmal yelim (oziq-ovqatga yaroqli; natriy silikat yaroqsiz).
- Reglamentlar: ТР ТС 005/2011 «О безопасности упаковки» (EAEU; markalash — material kodi va qayta ishlash halqasi, oziq-ovqat belgisi, sanitariya talablari); O'zbekiston — VM qarori № 109 (24.02.2025, UzTR.109-021:2025) «Qadoqlash va yopish vositalari xavfsizligi» — amaldagi asosiy reglament; eski VM qarori № 476 (07.07.2017, UzTR.476-021:2017, oziq-ovqat bilan kontaktdagi qadoqlash) 2025-yil avgust oxiridan bekor, amaldagi holatni lex.uz da tekshiring; makulatura karton faqat namligi ≤ 15 % oziq-ovqat uchun, migratsiya chegaralari Pb 0,030 mg/l, formaldegid 0,100 mg/l (ТР ТС 005 va № 476 da bir xil); bojxona TN VED 4819 — qog'oz/karton/gofrokartondan qutilar, korobkalar, paketlar (4819 10 — gofrokarton qutilar, 4819 20 — gofrlanmagan karton, 4819 30/40 — paket va xaltalar).
- Bozor (RU/UZ manbalar, 2025–2026): O'zbekiston qog'oz sanoati 2017–2025 o'sdi, lekin xomashyo (makulatura, sellyuloza) importga bog'liq (nuz.uz); Rossiyada gofro-qadoq bozori o'sishda, 2025-da talab xomashyodan oshdi (Коммерсантъ); tarnoy karton bozori tahlili — НИУ ВШЭ 2020. Raqamlarni keltirganda manba va yilini ayting.

## 7. Hisob retseptlari

1. **FEFCO 0201 zagotovka va m²** (ichki L×W×H, mm, 3 qatlamli): uzunlik = 2·(L + W) + 59 mm (yelim klapani ~35–40 + qalinlik pripusklari); kenglik = W + H + 8 mm; S (m²) = uzunlik × kenglik / 1 000 000. Misol 400×300×300: (1400 + 59) × (608) = 1459 × 608 = 0,887 m². 5 qatlamli: uzunlik = 2·(L + W) + 69, kenglik = W + H + 16. Misol Т-23 600×400×400 (3 qatlam): 2059 × 808 ≈ 1,66 m², 350 g/m² → ≈ 0,6 kg. Karton massasi = S × grammaj: 400×300×300 → 0,887 × 560 g/m² ≈ 497 g; 600×400×400 → 1,66 × 350 ≈ 582 g; qirqim 3 % + raskladka chiqindisi (0201 ≈ 0, shtamp 10–25 %).
2. **Tashqi o'lcham**: ichki + 2 × karton qalinligi (Т: +1 sm balandlikka, П: +2 sm — ГОСТ 9142-90); ichki bo'shliq tovar atrofida 3–5 mm (qattiq tovar), 15–25 mm (amortizator bilan).
3. **Marka tanlash**: brutto m (kg), shtabelda n qator → BCT_talab (N) = 9,8 × K × K₀ × m × (n − 1), K = 3,0 (amalda 4,0; kesilgan elementli 0,6), K₀ = 1,86 nam omborda (aks holda 1) → ECT_talab (kN/m) = BCT / (5,87 × √(t × Z)), t — qalinlik mm (C ≈ 4, B ≈ 3, BC ≈ 7), Z = 2·(L + W) mm → marka: Т-21 2,2 / Т-22 3,0 / Т-23 3,8 / Т-24 4,6 kN/m (П-3x — ko'proq, zavod jadvali). Misol: 10 kg, 6 qator, 400×300×300 C, K = 3: BCT = 9,8 × 3 × 10 × 5 = 1 470 N → ECT = 1470 / (5,87 × √(4 × 1400)) = 1470 / 439 ≈ 3,35 kN/m → Т-23. Tezkor (GWP jadvali, 6.2): 3 qatlam B/E 125–200 K/T — 4–17 kg, 5 qatlam BC/EB — 10–35 kg.
4. **Pallet joylashuvi**: 1200×800 (EUR) yoki 1200×1000; qatorga soni = ⌊1200/L⌋ × ⌊800/W⌋ (burish bilan taqqoslang), qatlamlar = ⌊(pallet balandligi − 150) / H⌋; 600×400 modulga karrali o'lcham 100 % yuzani oladi; qatlamlar 180° burib teriladi; yukning umumiy balandligi odatda ≤ 1,8 m, massa ≤ 1 t (tashuvchi bilan kelishing).
5. **Narx taklifi (KP)**: (a) material: S × grammaj × karton narxi (so'm/kg yoki so'm/m²); (b) konvertatsiya: bosma (ranglar × klishe + краскопрогон), shtamp (bir martalik, tirajga taqsimlanadi), yig'ish/yelim; (c) qo'shimchalar: laminatsiya, oynacha, tutqich; (d) marja; (e) yetkazib berish (Toshkent 30 000 so'm, ≥ 1 mln bepul); jami QQS bilan, QQS = jami × 12/112. Pack24 ichki tariflari (karton narxi, klishe/shtamp, marja) skilda yo'q. Ega yoki menejer tariflarni bergan bo'lsa — hisoblab, «taxminiy, menejer tasdiqlaydi» deb bering va 2–3 tiraj pog'onasi uchun so'rashni tavsiya qiling. Tariflar berilmagan bo'lsa — mijozga so'mda raqam ham, diapazon ham aytmang: narx nimadan tashkil topishini tushuntiring, kerakli ma'lumotni (o'lcham, tiraj, bosma) yig'ing va «menejer hisoblaydi, 1 ish soati ichida bog'lanadi» deng (1-bo'lim va 8.2 bilan bir xil).
6. **Stretch/skotch sarfi**: stretch = perimetr × aylanish × qatlam × 0,67 (150 % cho'zilish); skotch 0201 (48 mm lenta, har chok uchiga ≈ 50 mm qo'shimcha): faqat markaziy chok, ust va tag — ≈ 2·(L + 100) mm har qutiga (400×300 → ≈ 1,0 m, 66 m rulon ≈ 65 quti); H-shakl, ust va tag (har tomonda markaziy + 2 chet chok) — ≈ 2·(L + 100) + 4·(W + 100) mm (400×300 → ≈ 2,6 m, 66 m rulon ≈ 25 quti); «taxminan» deng.
7. **Paket qog'ozi** (yoyilma ikki o'lchamli): eni = (kenglik + chuqurlik) × 2 + 20–30 mm yelim choki; bo'yi ≈ balandlik + tub buklamasi (≈ chuqurlik/2 + 10–20 mm) + yuqori buklama (bo'lsa); S (m²) = eni × bo'yi / 1 000 000; kg = S × g/m² × 1,05–1,07 / 1000 × soni. Misol 300×150×400 (kenglik × chuqurlik × balandlik): eni = (300 + 150) × 2 + 25 = 925 mm, bo'yi ≈ 400 + 90 = 490 mm → S ≈ 0,45 m², 80 g/m² → 1000 dona ≈ 38 kg. Aniq sarf — yoyilma chizmasi bo'yicha.

## 8. Javob berishdan oldin tekshiruv

1. Mijoz nimani qadoqlaydi (mahsulot, og'irligi, mo'rtligi, oziq-ovqatmi), qancha (tiraj), ichki o'lcham (U×E×B, mm), tashish usuli (kuryer/pochta/pallet), bosma kerakmi (ranglar soni, logotip) — yetishmaganini **bitta** xabarda so'rang.
2. Katalogdagi tayyor mahsulot bo'lsa — artikul va saytdagi narx (so'm, QQS bilan) + minimal buyurtma + ulgurji pog'ona; individual quti bo'lsa — konstruksiya (FEFCO kodi), material (qatlam, profil, marka) va bosma usulini aytasiz; tariflar berilmagan bo'lsa narx bo'yicha taxminiy diapazon ham bermaysiz — "menejer hisoblaydi" deysiz (7.5-retsept).
3. Narx taklifida (KP) alohida satrlar: mahsulot, soni, dona narxi, summa; chegirma; yetkazib berish; **jami (QQS 12 % bilan)**; QQS summasi = jami × 12/112 (hisob-faktura uchun); to'lov usuli va muddati (shartnoma bo'lsa `paymentTermDays`, bo'lmasa 7 kun); ishlab chiqarish muddati — menejer tasdiqlaydi.
4. Raqam yoki standart keltirdingizmi — qaysi standart/manbadan ekanini ayting; manbalar bir-biriga zid bo'lsa ikkalasini ham ayting.
5. Sayt/admin/bot bo'yicha yo'riqnoma — raqamlangan qisqa qadamlar; parol, token, kalitni chatda so'ramang.
6. Javob mijoz tilida (uz/ru), 10 satrdan uzun bo'lsa — bo'limlarga ajrating.

## 9. Manbalar va bilim fayllari

- Loyiha: repo `toshmamatovabror81-pixel/pack24ai.com` (branch `claude/site-rewrite-um3xxf`), `docs/DEPLOY-UZCLOUD.md`, `prisma/seed/catalog.sql`, `src/lib/{quote,pricing,orderFlow,documents}.ts`.
- Loyiha eslatmalari: `/mnt/project-files/skill/pack24-qadoqlash-bilim/note-{katalog,sayt,biznes,muhandislik}.md`, `loyiha-bilimi.json`.
- Internet manbalari (115 URL, 9 mavzu, EN/RU): `tools/nace/manbalar.txt`; mavzu eslatmalari va tekshiruv natijalari: repoda `docs/bilim/internet/01…09-*.md` (`README.md` — jadval), nusxasi `/mnt/project-files/skill/pack24-qadoqlash-bilim/internet/` (u yerda `faktlar.json` — 1002 fakt manba URL bilan). Skil nusxasi repoda: `.claude/skills/pack24-qadoqlash/SKILL.md`.
- Bu fayllar chatda ochilmasa — faqat shu skildagi raqamlar bilan javob bering, «tafsilot loyiha eslatmasida» deng; mijozdan yoki egadan fayl so'ramang.
- Drex (nace.ai) orqali kompyuterdagi fayllarni saralash: `tools/nace/saralash.mjs` (natija `saralash-natija.md`, `index.json`) — kalit saqlangach ishga tushadi; natijasi bu skilga qo'shiladi.
- Standartlar: FEFCO Code 12-nashr (2022), ECMA Code, GOST (R 52901-2007, 7376-89, 9142-2014, 13511-2006, 7933-89, 32096-2013, 12303-80, 33781-2016, 12301-2006, 21140-88, 9078-84, 8273-75, 2228-81, 1341-2018), ISTA (3A, 2017 Guidelines), TAPPI/ISO/EN sinov usullari, TR TS 005/2011, O'zR VM qarori № 109 (24.02.2025; eski № 476 (2017) bekor), TN VED 4819.
