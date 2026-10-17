# Pack24 qadoqlash bilimi

Bu papka Claude skili «pack24-qadoqlash» (`.claude/skills/pack24-qadoqlash/SKILL.md`) tayanadigan bilim fayllarini saqlaydi.

- `internet/` — 115 ta inglizcha va ruscha internet manbadan (ro'yxat: `tools/nace/manbalar.txt`) yig'ilgan 1002 fakt asosida yozilgan 9 ta o'zbekcha mavzu eslatmasi. Har eslatmaning oxirida «Tekshiruv» bo'limi bor: asosiy da'volar manbadan qayta tekshirilgan (✅ tasdiqlandi, ❌ aniqlashtirildi, ❓ tekshirib bo'lmadi) va manbalar o'rtasidagi ziddiyatlar sanab o'tilgan. Jadval: `internet/README.md`.
- Faktlarning to'liq ro'yxati (manba URL bilan, `faktlar.json`, ~850 KB) va loyiha eslatmalari (`note-katalog.md`, `note-sayt.md`, `note-biznes.md`, `note-muhandislik.md`) repoga kiritilmagan; ular loyiha papkasida: `/mnt/project-files/skill/pack24-qadoqlash-bilim/`.
- Kompyuterdagi qadoqlash fayllarini nace.ai (Drex) orqali saralash vositasi: `tools/nace/` (README o'sha papkada). Saralash natijasi chiqqach shu papkaga `drex/` bo'limi qo'shiladi va skil yangilanadi.

Skilni yangilash tartibi: eslatmalarni to'g'rilang → `SKILL.md` ning tegishli bo'limini tuzating → claude.ai da skilni qayta yuklang (Settings › Capabilities › Skills) yoki Claude Code shu papkadagi nusxani o'zi oladi.
