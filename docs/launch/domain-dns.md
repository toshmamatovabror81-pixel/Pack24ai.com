# pack24.uz — DNS va SSL

## Vercel custom domain

1. Vercel Dashboard → Project → **Settings** → **Domains**
2. **Add** → `pack24.uz`
3. **Add** → `www.pack24.uz` (redirect to apex yoki alohida)

## DNS yozuvlari (domain registrar)

Vercel ko'rsatadigan qiymatlarni kiriting. Odatda:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

> Aniq IP/CNAME Vercel domain sahifasida ko'rsatiladi — yuqoridagi misol.

## SSL

Vercel avtomatik Let's Encrypt sertifikat beradi (5–30 daqiqa DNS propagatsiyadan keyin).

Tekshirish:
```bash
curl -I https://pack24.uz
# HTTP/2 200 yoki 307
```

## Env yangilash

Domain faol bo'lgach Vercel env'ni yangilang:

```
NEXTAUTH_URL=https://pack24.uz
NEXT_PUBLIC_APP_URL=https://pack24.uz
ALLOWED_ORIGINS=https://pack24.uz,https://www.pack24.uz
```

Redeploy qiling.

## Tekshiruv

- [ ] `https://pack24.uz` ochiladi
- [ ] `https://www.pack24.uz` redirect ishlaydi
- [ ] Admin login cookie HTTPS da ishlaydi
- [ ] Telegram WebApp URL: `https://pack24.uz/mobile`
