# ADR-001: Monorepo vs Multi-repo Arxitektura

**Sana**: 2026-05-21  
**Holat**: Qabul qilindi  
**Kontekst**: Pack24-web loyihasi uchun repo strategiyasini tanlash

---

## Kontekst va Muammo

Pack24-web loyihasi hozirda **bitta repo**da quyidagilarni o'z ichiga oladi:
- Next.js web app (admin panel, API routes)
- 3 ta Telegram bot (customer, driver, admin/supervisor)
- Prisma ORM + PostgreSQL schema
- Shared domain logic (`src/lib/domain/`)
- Shared utilities (auth, rate limiting, logging, validation)

**Savol**: Tizim o'sishi bilan repo'ni qismlarga bo'lish kerakmi?

---

## Ko'rib chiqilgan variantlar

### 1. Monorepo (hozirgi holat)

```
pack24-web/
├── src/
│   ├── app/              # Next.js pages + API routes
│   ├── lib/
│   │   ├── domain/       # Business logic (shared)
│   │   ├── telegram/     # Bot handlers
│   │   ├── auth/         # Auth (shared)
│   │   └── ...
│   └── ...
├── prisma/               # Schema + migrations
└── package.json
```

**Afzalliklari:**
- ✅ Oddiy CI/CD — bitta pipeline
- ✅ Shared types — Prisma client, domain types hamma joyda
- ✅ Atomic commits — bot + API + schema bir vaqtda o'zgaradi
- ✅ Refactoring oson — IDE hammasini ko'radi
- ✅ Dependency management oson — bitta `package.json`
- ✅ Kichik jamoa uchun ideal (2-5 dev)

**Kamchiliklari:**
- ⚠️ Build vaqti oshishi mumkin
- ⚠️ Bot'lar va web bir-biriga bog'liq deploy bo'ladi
- ⚠️ Katta jamoada merge conflict ko'p bo'ladi

### 2. Multi-repo (ajratilgan)

```
pack24-web/          # Next.js app
pack24-bots/         # Telegram bots
pack24-shared/       # Domain logic, types
pack24-prisma/       # Schema + migrations
```

**Afzalliklari:**
- ✅ Mustaqil deploy — bot'lar alohida, web alohida
- ✅ Izolatsiya — bot xatosi web'ga ta'sir qilmaydi
- ✅ Katta jamoalarda samarali

**Kamchiliklari:**
- ❌ Shared types versiyalash kerak (npm package qilish)
- ❌ Prisma client sinxronlash murakkab
- ❌ Cross-repo refactoring juda qiyin
- ❌ CI/CD murakkabligi x4
- ❌ Development environment setup murakkab
- ❌ Atomic o'zgarishlar imkonsiz

### 3. Monorepo + Turborepo/Nx (kelajakda)

```
pack24/
├── apps/
│   ├── web/          # Next.js app
│   └── bots/         # Telegram bots
├── packages/
│   ├── domain/       # Shared business logic
│   ├── prisma/       # Prisma schema
│   └── config/       # Shared config
├── turbo.json
└── package.json
```

**Afzalliklari:**
- ✅ Modulyar tuzilma
- ✅ Incremental builds
- ✅ Shared types native ishlaydi (workspace:*)
- ✅ Mustaqil deploy MUMKIN (turbo --filter)
- ✅ Monorepo'ning barcha afzalliklari saqlanadi

**Kamchiliklari:**
- ⚠️ Setup murakkabligi
- ⚠️ Turborepo/Nx o'rganish kerak
- ⚠️ Hozirgi bosqichda ortiqcha (premature optimization)

---

## Qaror

**Monorepo (hozirgi holat) saqlansin.**

### Asoslash:
1. **Jamoa hajmi**: 2-5 dev — monorepo eng samarali
2. **Shared types**: Prisma client va domain types hamma joyda kerak — multi-repo buni juda qiyinlashtiradi
3. **Deploy**: Hozircha barchasi bitta VPS/container da — ajratish zarurati yo'q
4. **Refactoring**: P1-P2 bosqichidamiz — tez-tez cross-cutting o'zgarishlar bo'ladi

### Kelajak uchun trigger:
Quyidagi sharoitlarda **Turborepo monorepo** ga o'tish kerak:
- Jamoa 5+ dev bo'lganda
- Bot'lar alohida container/server da deploy bo'lganda
- Build vaqti >5 daqiqa bo'lganda
- Bot'lar va web'ning release cycle'i farqlanganda

---

## Oqibatlari

1. ✅ Hozirgi tuzilmani saqlaymiz
2. ✅ `src/lib/domain/` — shared logic uchun yagona joy
3. ✅ CI/CD — bitta pipeline (`.github/workflows/ci.yml`)
4. 📋 **Tayyorgarlik**: Domain modullarni `src/lib/domain/` ga to'liq ajratish (P1 da bajarildi) — bu kelajakda Turborepo'ga o'tishni osonlashtiradi
5. 📋 Bot'lar uchun alohida entry point (`src/bots/`) yaratish mumkin — lekin hozircha kerak emas
