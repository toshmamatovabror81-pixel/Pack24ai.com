# Pack24 — investitsiya / hamkorlik pitch (qoralama)

**Bir qator xabar:**  
Pack24 — qadoqlash mahsulotlari uchun **vertikal integratsiyalangan** platforma: e‑commerce, admin, ombor va ishlab chiqarish, **makulatura (recycling) operatsiyasi**, **Telegram** orqali mijoz / haydovchi / admin oqimlari va **AI-yordamchi** tajribasi — bitta texnik yadro ostida.

---

## 1. Muammo

| Muammo | Tafsilot |
|--------|----------|
| **Parchalangan jarayonlar** | Savdo (sayt), logistika, ombor, chiqindi yig‘ish alohida vositalarda — xato, kechikish, shaffoflik yo‘qolishi |
| **Operatsiya mobil kanalda** | Mijoz va haydovchi/supervisor Telegram’da; tizimsiz bo‘lsa hisobot va nazorat buziladi |
| **B2B/B2C murakkab savdo** | Qadoq o‘lcham, material, bosma, muddat — ko‘p savol; faqat operator bilan ishlash qimmat va sekin |
| **Ma’lumot faol aktiv emas** | Statuslar va kanallar bir xil konvensiyada bo‘lmasa, analitika va avtomatlashtirish qiyin |

---

## 2. Yechim (biz nima qilamiz)

**Bitta mahsuldor mahsuldorlik:**  
Barcha asosiy biznes qatlamlari **bitta kod bazasi va yagona ma’lumot modeli** (Prisma / PostgreSQL) orqali bog‘langan — operatsiya va savdo bir-biridan ajralmaydi.

**Asosiy modullar:**

- **Public sayt:** katalog, savat, checkout, to‘lov (Click / Payme integratsiyasi uchun infratuzilma), ko‘p tillilik, PWA yo‘nalishi
- **Admin panel:** buyurtmalar, mijozlar, marketing, logistika, ishlab chiqarish, **recycling** boshqaruvi
- **Recycling:** nuqta, supervisor, haydovchi, so‘rovlar, dispatch, yig‘im, shikoyatlar, jurnal (operatsion yuritish)
- **Telegram:** mijoz, haydovchi va admin botlari; webhook/polling; **Telegram Web App** mobil sirt
- **Sun’iy intellekt (hozirgi bosqich):** konfiguratorda **bilim bazasi + dialog state machine** (“Pack24 AI maslahatchisi”); **AI qadoq dizayn** mockuplari (generativ vizual); serverdagi to‘liq LLM chat **keyingi bosqich** (hozircha mock / kengaytirish uchun tayyor nuqta)

---

## 3. Nima uchun aynan hozir / bozor

- O‘rta Osiyoda **Telegram operatsiya** uchun tabiiy kanal
- **Ekologiya va qayta ishlash** (ecoPoints, recycling) — brend va regulatorik tendentsiyalar bilan uyg‘un
- **Qadoqlash** — e‑commerce va korporativ zanjir uchun takrorlanuvchi talab

*(Bu yerda sizning raqamlaringizni qo‘shing: yillik aylanma, mijozlar soni, shaharlar, recycling tonnasi va h.k.)*

---

## 4. Texnik ustunlar (investor uchun “build quality”)

- **Next.js 15**, **React 19**, TypeScript
- **Prisma** — bitta schema orqali barcha domenlar
- **Telegraf**, multi-bot arxitektura
- Domain qatlami, testlar (Jest), migratsiyalar — **scaling** va jamoa kengayishi uchun bazis
- **Schema tightening** rejasi — status va konvensiyalarni typed qilib, keyin DB darajasida qat’iylashtirish (analytics va botlar izchilligi)

---

## 5. AI — samimiy va kuchli qanday aytish kerak

| Hozir | Ma’nosi |
|-------|---------|
| **Konsultant** | Kalit so‘z + bilim bazasi + dialog oqimi — tez, nazorat qilinadigan, xarajat past |
| **AI dizayn sahifasi** | Generativ **qadoq mockup** vizuallari (tashqi xizmat orqali) — marketing va lead uchun kuchli |
| **Kelgusi** | RAG / LLM (`/api/ai/chat` kabi nuqtalar)— katalog va siyosat bilan bog‘langan aqlli javob |

**Investor uchun xulosa:** AI — **faqat slid sarlavhasi emas**, lekin **haqiqiy generativ matn‑AI** hali to‘liq ishga tushmagan; roadmap aniq aytilsa — bu zaiflik emas, **tartibli investitsiya** uchun plus.

---

## 6. Moneta va biznes modeli *(to‘ldiring)*

Masalan: mahsulot marjasi + yetkazib berish + B2B shartnomalar + recycling operatsiyasi daromadi + premium AI xizmatlar (kelajak).

---

## 7. Rag‘batlantiruvchi omillar (Moat)**

- **Vertikal**: savdo + operatsiya + chiqindi zanjiri bir brand ostida
- **Operational data**: buyurtma, mijoz segmentlari, recycling oqimi — **keyinchalik forecasting va automatlashtirish**
- **Regional moslashuv**: tillar, Telegram, mahalliy to‘lov va logistika

---

## 8. Yo‘l xaritasi (tavsiya etilgan tuzilma)

| Bosqich | Maqsad |
|---------|--------|
| **Qisqa muddat** | Schema tightening, status izchilligi, recycling/bot operatsiyasining barqarorligi |
| **O‘rta** | To‘liq LLM yoki RAG mijoz konsultatsiyasi + xavfsizlik va narx moderatsiyasi |
| **Uzoq** | Prediktiv zapas, dinamik narx taklifi, chuqur korporativ integratsiyalar |

---

## 9. Nimani so‘raymiz *(raqamlarni siz yozasiz)*

- **Summasi:** …  
- **Forma:** equity / qarz / strategik hamkor  
- **Ishlatish:** jamoa, marketing, logistika, AI infra, yuridik  
- **Muddat / KPI:** …  

---

## 10. Keyingi qadam

Qisqa **demo**: sayt + admin + Telegram oqimi + AI konsultant + AI dizayn sahifasi.  
**Data room** uchun: texnik hujjatlar (`docs/architecture-overview.md` va bog‘liq fayllar), *(moliyaviy model — alohida)*.

---

*Hujjat: loyiha kod bazasi va ichki README tahlili asosidagi qoralama. Raqamlar va hukumat bo‘yoqlarini tashkilotingiz to‘ldirib chiqadi.*
