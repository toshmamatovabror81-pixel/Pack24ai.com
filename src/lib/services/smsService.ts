// ─── Eskiz.uz SMS Service ────────────────────────────────────────────────────
// O'zbekiston SMS provayderi: https://eskiz.uz
// .env da quyidagi o'zgaruvchilar kerak:
//   ESKIZ_EMAIL=your@email.com
//   ESKIZ_PASSWORD=your_password
//   ESKIZ_SENDER=4546  (yoki boshqa raqam)

let cachedToken: string | null = null;
let tokenExpiry = 0;

const ESKIZ_BASE = 'https://notify.eskiz.uz/api';

/** Eskiz.uz dan JWT token olish */
async function getEskizToken(): Promise<string | null> {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

    const email = process.env.ESKIZ_EMAIL;
    const password = process.env.ESKIZ_PASSWORD;

    if (!email || !password) {
        console.warn('[SMS] ESKIZ_EMAIL yoki ESKIZ_PASSWORD sozlanmagan');
        return null;
    }

    try {
        const res = await fetch(`${ESKIZ_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (data.data?.token) {
            cachedToken = data.data.token;
            // Token 30 kun amal qiladi, biz 29 kundan keyin yangilaymiz
            tokenExpiry = Date.now() + 29 * 24 * 60 * 60 * 1000;
            return cachedToken;
        }
        console.error('[SMS] Eskiz auth xatolik:', data);
        return null;
    } catch (err) {
        console.error('[SMS] Eskiz auth xatolik:', err);
        return null;
    }
}

/** SMS yuborish */
export async function sendSms(phone: string, message: string): Promise<boolean> {
    const token = await getEskizToken();
    if (!token) return false;

    // Telefon raqamini formatlash (+998 → 998)
    const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '').replace(/^998/, '998');

    try {
        const res = await fetch(`${ESKIZ_BASE}/message/sms/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                mobile_phone: cleanPhone,
                message,
                from: process.env.ESKIZ_SENDER || '4546',
            }),
        });
        const data = await res.json();
        if (data.status === 'waiting' || data.status === 'success') {
            console.log(`[SMS] ✅ Yuborildi: ${cleanPhone}`);
            return true;
        }
        console.error('[SMS] Xatolik:', data);
        return false;
    } catch (err) {
        console.error('[SMS] Yuborish xatolik:', err);
        return false;
    }
}

/** Qo'ng'iroq orqali xabar yuborish (Eskiz Voice API) */
export async function makeVoiceCall(phone: string, message: string): Promise<boolean> {
    const token = await getEskizToken();
    if (!token) return false;

    const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '').replace(/^998/, '998');

    try {
        // Eskiz Voice Call API
        const res = await fetch(`${ESKIZ_BASE}/message/sms/send-call`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                mobile_phone: cleanPhone,
                message, // IVR message
                from: process.env.ESKIZ_SENDER || '4546',
            }),
        });
        const data = await res.json();
        console.log(`[CALL] Qo'ng'iroq natijasi (${cleanPhone}):`, data.status);
        return data.status === 'waiting' || data.status === 'success';
    } catch (err) {
        console.error('[CALL] Qo\'ng\'iroq xatolik:', err);
        return false;
    }
}
