# Bosma va maket tayyorlash (EN)

Manba: 12 URL (`tools/nace/manbalar.txt`), 99 fakt. Faktlar 2026-10-15, eslatma 2026-10-16. Har bandda qavs ichida manba domeni.

# Bosma va maket tayyorlash (print & artwork prep)

## 1. Fayl topshirish
- Litho buklama karton (folding carton): AI native, Esko Normalized PDF yoki press-ready PDF; shriftlar birga yoki konturga (outline); 1-bit TIFF rad [onepaperworks.com]
- Flekso gofrokarton: AI/EPS (Illustrator 8.0) + PDF nusxa; CorelDRAW → curves; JPG/TIFF/DOC/GIF/BMP va mustaqil PDF rad [glbc.com]
- Flekso qog'oz qadoq: AI, not flattened, + PDF/JPEG; halftone 300 dpi, bitmap 600 dpi @100%, linked (embed emas) [detpak.com]
- OPM: AI afzal; Esko PDF, qatlamli PSD/TIFF (linked), siqilmagan EPS; outlined + embedded-font PDF + live text [opmgroup.co.uk]
- Raqamli gofro: faqat vektor AI/EPS/PDF (konvertatsiya pullik); grafika 100% masshtabda; dieline yassilanmaydi, o'lchami o'zgarmaydi; foil/emboss/spot UV alohida qatlam [pakfactory.com]
- Dieline: alohida qatlam, overprint spot rang; "cut"/"crease" SPOT COLOR (CMYK dieline bosilib ketadi); glue area bo'yoq/laksiz; varnish-free zona dieline'da [onepaperworks.com; pakfactory.com]
- CMYK rejim, RGB va ishlatilmagan svotch o'chiriladi; spot faqat kutubxona nomi ("Pantone 485 C"); oq obyektga overprint yo'q; Flatten Transparency yo'q; Raster Effects 300 ppi CMYK [opmgroup.co.uk; onepaperworks.com]

## 2. Maket me'yorlari jarayon bo'yicha
| Parametr | Litho FC [onepaperworks.com] | Flekso gofro [glbc.com] | Flekso qog'oz [detpak.com] | OPM flekso [opmgroup.co.uk] | Raqamli gofro [pakfactory.com] |
|---|---|---|---|---|---|
| Bleed | 3.2 mm; glue flap 6.35 mm | 12.7 mm (1/2") | — | 3 mm; print margin 0.5 mm | 3.2 mm (0.125") |
| Safe zone | 2 mm | RSC 12.7 mm; die-cut/hand hole/window 6.35 mm | — | 2 mm | 3.2 mm |
| Min shrift + / reverse | 4.875 pt / 6.85 pt | 8 pt (≥10) / 10 pt (≥12) | — | 4 pt / 6 pt (+0.05 mm oq stroke); ko'p rang 6 pt | 10 pt / bir pog'ona qalin |
| Min chiziq + / reverse | 0.36 pt; stroke ≥0.102 mm | 2 pt ≈0.7 mm / 4 pt ≈1.4 mm | 0.15 / 0.6 mm | 0.15 (ko'p rang 0.3) / 0.3 mm | — |
| Trapping | 0.13 mm; metallic 0.065 mm | ≥4.8 mm (3/16") | 0.5–1 mm | 0.2 mm; backing white 0.2/0.3 mm, maks 2 | — |
| Rastr | 150 lpi AM; ECG +3 bo'yoq | 45 lpi (3% nuqta → 10%) | kelishiladi | 133 std, 175 maks lpi; dot 2–96% | — |
| TAC | 280% | — | — | 320% | — |
| Registr | — | ±1.6–6.35 mm | fold 4 mm; square bottom 10 mm | — | — |
| Rasm | linked CMYK 300 dpi | — | linked 300/600 dpi | 300 ppi; line art 600 dpi | embedded CMYK 300 DPI |
| Rich black | 30C+100K; katta maydon 40C 35M 20Y 100K | — | — | — | C30 M30 Y30 K100 |

- Rollover allowance: caliper ≤600 µm → 0.6 mm, >600 µm → 0.8 mm [onepaperworks.com]
- OPM: burchaklar C 7.5°, M 67.5°, Y 82.5°, K 37.5°, spot 7°; plastina 67 thou; maks 14 rang/13 seksiya; kenglik 560 mm [opmgroup.co.uk]
- Dot gain nishonlari 25/50/75/100% 5×5 mm; gray balance C/M/Y 25/19/19, 50/40/40, 75/66/66; proof G7 GRACoL 2006/2013 ICC inkjet [onepaperworks.com]
- Flekso gofroda och rang to'q ichida reverse → bleed-through [glbc.com]

## 3. Rang tizimlari
- CMYK = 4 plastina; RGB/HEX faqat ekran [ecoenclose.com]
- Pantone (PMS) pre-mixed spot, har rang alohida plastina (PANTONE 286 + Red 032 + Black = 3); C coated, U uncoated [ecoenclose.com]
- CMYK→Pantone taxminiy; raqamli bosma Pantone'ni qo'llamaydi, faqat ~30% PMS CMYK ga yaxshi o'giriladi; CMYK plastinalari Pantone'dan qimmat bo'lishi mumkin [ecoenclose.com; pakfactory.com]
- Kraftda bo'yoq shaffof → to'qroq/jigarrangroq; orange/brown qiyin; drawdown (jismoniy namuna) yagona aniq yo'l, pullik [ecoenclose.com]
- Flekso gofro rang standarti GCMI; PMS → draw-down tasdiq [glbc.com]; fluorescent/ba'zi metallic yo'q [detpak.com]

## 4. Shtrix-kodlar (barcode / штрих-код)
- GTIN-8/12/13/14; indikator (1–8 guruh, 9 o'zgaruvchan, 0) faqat GTIN-14; Company Prefix 4–12 raqam; 14 xonaga GTIN-8 +6, -12 +2, -13 +1 nol; EAN-8 faqat yuza <80 cm², yorliq <40 cm², Ø<30 mm [gs1india.org]
- SSCC 18 raqam, GS1-128 (AI 00), logistik yorliqda yagona majburiy, eng pastda; A6 105×148, A5 148×210 mm; Non-HRI ≥7 mm, erkin ≥3 mm [gs1india.org; gs1ca.org]

| X-o'lcham min/target/maks, mm [gs1india.org] | |
|---|---|
| EAN/UPC/DataBar (POS) | 0.264 / 0.330 / 0.660 |
| ITF-14 | 0.495 / 0.660 / 1.016 |
| GS1-128 | 0.495 / 0.495 / 0.940 |
| DataMatrix/QR | 0.396 / 0.495 / 0.743 |
| Tashqi qutiga EAN/UPC | ≥0.495 (150%) |

| ITF-14 3M RD158 [3m.com] | A | E | D |
|---|---|---|---|
| X, mm (tolerans) | 1.016 (+0.305) | 0.813 (+0.254) | 0.635 (+0.13) |
| Keng shtrix / balandlik | 2.540 / 32 | 2.032 / 32 | 1.588 / 32 |
| Tinch zona / nominal kenglik | 10.2 / 152.4 | 8.1 / 123.85 | 6.4 / 92.13 |
| Qo'llanish | gofro bevosita, afzal | gofro, joy tor | qog'oz yorliq |
- ITF-14: nisbat 2.5:1, bearer bar 2X; X<0.635 mm gofroga bosilmaydi; tinch zona 11X; HRI 5.72 mm; sifat ISO/IEC 15416 ≥C (1.5), ISO 1.5/20/670; kraftda kontrast ≥D (0.5); 10 skan o'rtachasi [3m.com]
- Magnification: 100% afzal, min 80% (EAN-13 ≈29.8 mm) [onepaperworks.com; opmgroup.co.uk]; EAN min 110%, TUN 100% [detpak.com]; UPC-A ≥150% (≈56 mm), balandlik ≥12.7 mm [pakfactory.com]
- BWR 0.042 mm [onepaperworks.com]; −40/−50 µm [opmgroup.co.uk]; tinch zona 6.35 mm [onepaperworks.com], ISO +0.5 mm [opmgroup.co.uk]
- Joylashuv: qirradan 8–100 mm (5 mm yetarli emas); orqa pastki o'ng chorak; quti: tubdan 32 mm, vertikal qirradan ≥19 mm; <32 mm balandlik → qopqoqda; >1 m/pallet: 400–800 mm, qirradan ≥50 mm; egri yuza 30° → ladder; Ø≤30 mm ladder; X 0.264 → EAN-13 min Ø48 mm, X 0.660 → 120 mm [gs1ca.org; gs1india.org; 3m.com]
- Perforatsiya, die-cut, chok, fold, flap ustiga emas; katta/og'ir (≥450 mm, >13 kg) 2 kod [gs1ca.org]
- Rang: shtrix to'q (qora/ko'k/yashil), bo'shliq oq (qizil/to'q sariq ham); EAN/GS1-128 jigarrang kartonga bevosita emas; flekso — shtrixlar bosish yo'nalishida [gs1india.org]; qizil/to'q sariq pigment, metall fon, negativ kod rad [opmgroup.co.uk]

## 5. Bosma texnologiyalari
- Flekso: egiluvchan relyef forma (rezina/fotopolimer); 800 m/min gacha; yuqori dot gain; formalar gravyuradan arzon; aniloks + rakel, gofro odatda open single-blade; bo'yoq: solvent, suvli, EB, UV, 2 komponentli [wikipedia.org]
- Montaj: double-sided tape, carrier sheet; microdot gofroda ≈1 mm, yorliqda ≈0.25 mm; avtomatik 10× tez, 5 µm [wikipedia.org]
- Litho-laminat (кашировка): ofset varaq gofroga laminatsiya → die cut, score, yelim; raqamli — lak/aqueous/gloss laminat bilan sheen [catalpha.com]
- Tiraj: raqamli — bir necha yuz dona, prototip/meyler; litho-laminat ~1000 dan, sweet spot ~5000; bir martalik: dieline, cutting die, plates (reprintda yo'q) [catalpha.com]
- Shtanplash: steel-rule die (faner dieboard, cut+crease bir o'tishda) arzon, qisqa seriya; solid engraved aniq; flatbed arzon/sekin, rotary (RDC) inline [wikipedia.org]

## 6. Ziddiyatlar
- Bleed 3–3.2 mm [opm, onepaperworks, pakfactory] vs 12.7 mm flekso gofro [glbc]; safe zone 2 mm [onepaperworks, opm] vs 3.2 mm [pakfactory] vs 6.35–12.7 mm [glbc] — jarayonga bog'liq
- TAC 280% [onepaperworks] vs 320% [opm]; rich black 30C+100K [onepaperworks] vs 30/30/30/100 [pakfactory]
- Min shrift 4/6 pt [opm], 4.875/6.85 pt [onepaperworks], 8/10 pt [glbc], 10 pt [pakfactory]
- Rasm linked [onepaperworks, detpak, opm] vs embedded [pakfactory]
- Truncation: dizayner ixtiyorida [onepaperworks] vs tavsiya etilmaydi [detpak] vs SHALL be avoided [gs1ca]
- Magnification min 80% [onepaperworks, opm] vs EAN 110% [detpak] vs 150% tashqi quti [gs1india, pakfactory]
- Qizil/to'q sariq bo'shliq rangi sifatida OK [gs1india] vs qochish [opm]; ITF-14 32 mm [3m] vs 31.75 mm [gs1india]

## 7. Lug'at
| EN | RU | UZ |
|---|---|---|
| bleed | вылет под обрез | chiqim |
| safe zone | безопасная зона | xavfsiz zona |
| dieline | штанцформа, контур высечки | shtanets chizig'i |
| crease / score | биговка | bigiz chizig'i |
| glue flap | клапан склейки | yelim qopqog'i |
| reverse type | выворотка | teskari matn |
| trapping | треппинг | trepping |
| dot gain | растискивание | nuqta o'sishi |
| screen ruling | линиатура | rastr chastotasi |
| TAC | суммарное красочное покрытие | umumiy bo'yoq qoplami |
| spot colour | плашечный цвет | spot rang |
| drawdown | выкраска | bo'yoq namunasi |
| anilox roll | анилоксовый вал | aniloks val |
| doctor blade | ракель | rakel |
| litho laminate | кашировка | lito-laminat |
| steel-rule die | штанцформа | po'lat qoidali shtanp |
| quiet zone | свободная зона | tinch zona |
| X-dimension | X-размер | X-o'lcham |
| HRI | человекочитаемые символы | odam o'qiydigan raqamlar |
| picket fence / ladder | «частокол» / «лестница» | panjara / zinapoya |

## Tekshiruv (asosiy da'volar manbadan qayta o'qildi)

- ✅ **tasdiqlandi** — Flekso gofrokarton maket me'yorlari: rastr 45 lpi (3% nuqta 10% gacha o'sadi), min shrift 8 pt pozitiv / 10 pt reverse, min chiziq 2 pt (≈0.7 mm) / 4 pt (≈1.4 mm), bleed 12.7 mm, print-free zona RSC 12.7 mm / die-cut 6.35 mm, trapping ≥4.8 mm, registr tolerans ±1.6–6.35 mm, rang standarti GCMI (https://www.glbc.com/print-and-graphics/print-types/flexographic-printing-guidelines)
  - Sabab: GLBC manbasi (glbc.com Flexographic Printing Guidelines) da'vodagi barcha ko'rsatkichlarni bevosita keltiradi: "corrugated products are run at 45 lpi (i.e. a 3% dot may grow to 10%)"; "8pt ... is the minimum for point positive type", "10pt is the minimum for reverse-out type" (12pt afzal); "Minimum thickness for fine lines is 2pt for point positive print and 4pt for reverse-out print" (mm qiymatlari manbada yo'q, lekin 2pt=0,71 mm, 4pt=1,41 mm — to'g'ri hisob); "Minimum bleed off of 1/2″" = 12,7 mm; oddiy qutilar (ustki va ostki 4 qopqoqli, ya'ni RSC) uchun "minimum 1/2″ ... between a printed image and any scores" = 12,7 mm; die-cut uchun "minimum of 1/4″ ... between a printed image and the edge of the board" = 6,35 mm; "Minimum trapping (overprint) of 3/16″" = 4,76 ≈ 4,8 mm; "print registration tolerance is between +/- 1/16″ and 1/4″" = ±1,59–6,35 mm; "GCMI ink colour is the standard for flexo printing". Yagona nozik jihat: manbada "RSC" atamasi aynan yozilmagan, "regular boxes (4 flaps on top and 4 on bottom)" deyilgan — bu RSC ta'rifi bilan mos. Dyuymdan mm ga o'tkazishlar yaxlitlangan va to'g'ri.
- ✅ **tasdiqlandi** — Litho buklama karton: bleed 3.2 mm (glue flap 6.35 mm), matn safe zone 2 mm, TAC ≤280%, 150 lpi AM rastr, min shrift 4.875 pt / 6.85 pt reverse, min chiziq 0.36 pt, trapping 0.13 mm (metallic 0.065 mm), proof G7 GRACoL 2006/2013 (https://onepaperworks.com/wp-content/uploads/2024/07/paperworks-lithographic-print-specification-guide-r3.pdf)
  - Sabab: PaperWorks Lithographic Print Specification Guide r3 (onepaperworks.com PDF) manba to'g'ridan-to'g'ri o'qildi va barcha raqamlar mos keladi: bleed "3.2 mm / 0.125984\" past the knife cut"; glue flap "6.35mm / 0.25\" over the score on glue flaps"; matn uchun "clearance of 2 mm from the edge of the dieline" (jadvalda ham "Minimum distance from crease and trim: 2 mm"); TAC "Total dot percentages in any spot of four color file 280%"; rastr "standard definition (150 am dot) screening"; shrift "Positive Type: 4.875 pts", "Negative Type: 6.85 pts"; chiziqlar "Positive lines: 0.36 / 0.005\"" va "Negative (reverse) lines: 0.36"; trapping "Traps should be 0.13 mm / 0.005\"", metallic "0.065 mm / 0.002\""; proof "A calibrated inkjet proof profiled to G7 GRACoL 2006 or 2013". Eslatma: manbada "Type Thickness" bo'limida alohida 0.102 mm minimal qalinlik ham ko'rsatilgan va PaperWorks GRACoL o'rniga o'z ICC profiliga proof qilishni afzal ko'radi, lekin bu da'voga zid emas.
- ✅ **tasdiqlandi** — ITF-14 gofrokartonga bevosita bosish (3M RD158): Size A X=1.016 mm (+0.305), Size E X=0.813 mm, shtrix balandligi 32 mm, bearer bar 2X, tinch zona 10.2/8.1 mm; X<0.635 mm gofroga bosilmaydi; sifat ISO/IEC 15416 baho ≥C (1.5), kraftda kontrast ≥D (0.5); joylashuv tubdan 32 mm, qirradan ≥19 mm (https://multimedia.3m.com/mws/media/2598619O/crd-158-printing-and-location-requirements-for-itf-14.pdf)
  - Sabab: 3M CRD-158 manbasi (multimedia.3m.com, 2598619O) barcha raqamlarni tasdiqlaydi. Size A (gofrokartonga bevosita bosish, 7.2-bo'lim): X = .040 IN (1.016 mm), tolerans +0.012 IN (+0.305 mm); Size E: X = 0.0320 IN (0.813 mm); shtrix balandligi 1.25 IN (32 mm); minimal tinch zona A uchun 0.400 IN (10.2 mm), E uchun 0.320 IN (8.1 mm). 2.4-bo'lim: gorizontal bearer bar qalinligi X ning ikki baravari ("twice the x dimension in thickness"). 7.3-bo'lim: "In no case may a symbol smaller than 0.025" [0.635 mm] narrow bar be printed directly on corrugated." Sifat: 1.2-bo'limda ISO/IEC 15416 keltirilgan, 5.1.2-bo'lim: umumiy baho C (1.5) yoki yuqori; tabiiy jigarrang kraft uchun Symbol Contrast bahosi D (0.5) yoki yuqori. Joylashuv: 1 m dan past qutilarda shtrix pastki qirrasi tubdan 1.25 IN (32 mm), vertikal qirralardan kamida 0.75 IN (19 mm). Ogohlantirish: tinch zona manbada vertikal bearer bar ichida hisoblanadi; Size E uchun tolerans +0.254 mm (da'voda ko'rsatilmagan, lekin zid emas).
- ✅ **tasdiqlandi** — Tiraj bo'yicha tanlov: raqamli bosma bir necha yuz donagacha tejamli; litho-laminat kotirovkalari ~1000 donadan boshlanadi, sweet spot ~5000 dona; litho-laminatda bir martalik xarajatlar (dieline, cutting die, plates) reprintda takrorlanmaydi (https://blog.catalpha.com/corrugate-package-printing-litho-laminate-vs.-digital-printing)
  - Sabab: Manba (blog.catalpha.com, "Corrugate Package Printing: Litho Laminate vs. Digital Printing") da'voning har bir qismini tasdiqlaydi. Raqamli bosma: "With direct to corrugate digital printing, the cost usually makes more sense in low quantities" va misol sifatida "a couple of hundred pieces" (bir necha yuz dona) keltirilgan. Litho-laminat kotirovkalari: "the quantities that you really should be quoting will be about one thousand quantity and up" (~1000 donadan). Sweet spot: "Usually it makes more sense in the 5,000 quantity" (~5000 dona). Bir martalik xarajatlar: "the die line and the die for cutting this box shape out of the corrugate and the plate charges" — bular "one-time charges" deb nomlangan va "they won't be a charge for the next run of printing", reprintda "already done" — ya'ni takrorlanmaydi. Barcha raqamlar va mazmun manba bilan mos keladi.
- ✅ **tasdiqlandi** — GS1 X-o'lcham: EAN/UPC 0.264/0.330/0.660 mm, ITF-14 0.495/0.660/1.016 mm, GS1-128 0.495/0.495/0.940 mm; tashqi qutiga EAN/UPC X ≥0.495 mm (150%); ITF-14 balandligi ≥31.75 mm; EAN/GS1-128 jigarrang kartonga bevosita bosilmaydi; quti kodi tubdan 32 mm, vertikal qirradan ≥19 mm (https://gs1india.org/media/global-user-manual1.pdf)
  - Sabab: Manba (GS1 Global User Manual, gs1india.org) da'vodagi barcha raqamlarni to'g'ridan-to'g'ri tasdiqlaydi. 5.2.1.x (EAN-8/13, UPC-A/E): Min 0.264 mm, Target 0.330 mm, Max 0.660 mm. 5.2.2 (ITF-14): Min 0.495, Target 0.660, Max 1.016 mm; "the height of the bars must be at least 31.75 mm (1.250 inch)". 5.2.3 (GS1-128): Min 0.495, Target 0.495, Max 0.940 mm; "they cannot be printed directly onto brown corrugate packaging". 5.2.1: tashqi qutilarda EAN/UPC "must be used at a size of at least an X-dimension of 0.495 mm"; 7.4.2: "150% (equal to an x-dimension of 0.495 mm)". 7.4.4: "Don't print EAN/UPC and GS1-128 symbols directly onto brown board". 7.3 (On cartons and outer cases): "The lower edge of the barcode should be located 32 mm from the natural base of the item" va "The symbol (including Quiet Zones) should be at least 19 mm from the vertical edges".

## Manbalar orasidagi ziddiyatlar

- Bleed: 3 mm [opmgroup.co.uk] / 3.2 mm [onepaperworks.com, pakfactory.com] vs 12.7 mm flekso gofrokarton [glbc.com] — jarayonga bog'liq farq, gofro flekso uchun 12.7 mm qo'llanadi
- Safe zone: 2 mm [onepaperworks.com, opmgroup.co.uk] vs 3.2 mm [pakfactory.com] vs 6.35 mm (die-cut) / 12.7 mm (RSC) [glbc.com]
- TAC (umumiy bo'yoq qoplami): 280% [onepaperworks.com] vs 320% [opmgroup.co.uk]
- Rich black: 30C+100K yoki 40C 35M 20Y 100K [onepaperworks.com] vs C30 M30 Y30 K100 [pakfactory.com]
- Minimal shrift: 4 pt / 6 pt reverse [opmgroup.co.uk], 4.875 pt / 6.85 pt [onepaperworks.com], 8 pt / 10 pt [glbc.com], 10 pt [pakfactory.com]
- Minimal chiziq: 0.36 pt (≈0.127 mm) [onepaperworks.com], 0.15 / 0.3 mm [opmgroup.co.uk], 0.15 / 0.6 mm [detpak.com], 2 pt / 4 pt (0.7 / 1.4 mm) [glbc.com]
- Rastr tasvirlar: linked (embed qilinmaydi) [onepaperworks.com, detpak.com, opmgroup.co.uk] vs embedded [pakfactory.com]
- Shtrix-kod truncation: dizayner ixtiyorida [onepaperworks.com] vs tavsiya etilmaydi [detpak.com] vs SHALL be avoided / oxirgi chora [gs1ca.org, gs1india.org]
- Shtrix-kod magnification minimumi: 80% [onepaperworks.com, opmgroup.co.uk] vs EAN 110% [detpak.com] vs tashqi quti/UPC-A 150% [gs1india.org, pakfactory.com]
- Shtrix-kod yo'nalishi: litho istalgan yo'nalish [onepaperworks.com] vs flekso bosish yo'nalishi bo'ylab [gs1india.org]
- Qizil/to'q sariq rang: bo'shliq (space) rangi sifatida qabul [gs1india.org] vs pigmentdan qochish kerak [opmgroup.co.uk]
- ITF-14 shtrix balandligi: 32 mm [3m.com] vs 31.75 mm [gs1india.org] — 1.25 in yaxlitlash farqi
- Trapping: 0.13 mm litho [onepaperworks.com], 0.2 mm [opmgroup.co.uk], 0.5–1 mm [detpak.com], ≥4.8 mm flekso gofro [glbc.com] — jarayonga bog'liq
