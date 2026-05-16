// ─── Haydovchi bot matnlari ───────────────────────────────────────────────────
import type { Lang } from './index';

type Texts = Record<string, Record<Lang, string>>;

export const driverTexts: Texts = {
    drv_welcome: {
        uz: '🚚 <b>Pack24 — Haydovchi boti</b>\n\nXush kelibsiz! Ro\'yxatdan o\'tish uchun telefon raqamingizni ulashing 👇',
        ru: '🚚 <b>Pack24 — Бот водителя</b>\n\nДобро пожаловать! Поделитесь номером телефона для регистрации 👇',
        en: '🚚 <b>Pack24 — Driver Bot</b>\n\nWelcome! Share your phone number to register 👇',
    },
    drv_share_phone: { uz: '📱 Kontaktni ulashish', ru: '📱 Поделиться контактом', en: '📱 Share Contact' },
    drv_not_in_db: {
        uz: '❌ <b>Raqamingiz tizimda topilmadi!</b>\n\nAdmin bilan bog\'laning:\n📞 +998 88 055-78-88',
        ru: '❌ <b>Номер не найден в системе!</b>\n\nСвяжитесь с администратором:\n📞 +998 88 055-78-88',
        en: '❌ <b>Phone not found in system!</b>\n\nContact admin:\n📞 +998 88 055-78-88',
    },
    drv_already_registered: {
        uz: '⚠️ Bu telefon raqam boshqa Telegram akkauntga bog\'langan.\nAdmin bilan bog\'laning.',
        ru: '⚠️ Этот номер привязан к другому аккаунту Telegram.\nОбратитесь к администратору.',
        en: '⚠️ This phone is linked to another Telegram account.\nContact admin.',
    },
    drv_code_sent: {
        uz: '✅ <b>Muvaffaqiyatli ro\'yxatdan o\'tdingiz!</b>\n\n👤 {name}\n\n🔑 <b>Sizning verifikatsion kodingiz:</b>\n\n<code>{code}</code>\n\n📌 Bu kodni xotirada saqlang — keyinchalik kerak bo\'lishi mumkin.\n\nAdmin panelda ham ko\'rinadi ✓',
        ru: '✅ <b>Успешно зарегистрированы!</b>\n\n👤 {name}\n\n🔑 <b>Ваш верификационный код:</b>\n\n<code>{code}</code>\n\n📌 Сохраните этот код — он может понадобиться позже.\n\nТакже виден в панели администратора ✓',
        en: '✅ <b>Successfully registered!</b>\n\n👤 {name}\n\n🔑 <b>Your verification code:</b>\n\n<code>{code}</code>\n\n📌 Save this code — you may need it later.\n\nAlso visible in admin panel ✓',
    },
    drv_registered: {
        uz: '✅ <b>Muvaffaqiyatli!</b>\n\n🚚 Siz haydovchi sifatida ro\'yxatdan o\'tdingiz.\n👤 {name}\n\nQuyidagi tugmalar orqali ishlang 👇',
        ru: '✅ <b>Успешно!</b>\n\n🚚 Вы зарегистрированы как водитель.\n👤 {name}\n\nИспользуйте кнопки ниже 👇',
        en: '✅ <b>Success!</b>\n\n🚚 You are registered as a driver.\n👤 {name}\n\nUse the buttons below 👇',
    },
    drv_not_registered: {
        uz: '❌ Siz haydovchi sifatida ro\'yxatdan o\'tmagansiz.\n\n5 raqamli kodingizni kiriting yoki /start bosing.',
        ru: '❌ Вы не зарегистрированы как водитель.\n\nВведите 5-значный код или нажмите /start.',
        en: '❌ You are not registered as a driver.\n\nEnter your 5-digit code or press /start.',
    },
    drv_btn_tasks: { uz: '📋 Topshiriqlar', ru: '📋 Задания', en: '📋 Tasks' },
    drv_btn_report: { uz: '📊 Kunlik hisobot', ru: '📊 Дневной отчёт', en: '📊 Daily report' },
    drv_btn_online: { uz: '🟢 Men onlineman', ru: '🟢 Я онлайн', en: '🟢 I\'m online' },
    drv_btn_offline: { uz: '🔴 Offlineman', ru: '🔴 Я оффлайн', en: '🔴 I\'m offline' },
    drv_btn_profile: { uz: '👤 Profilim', ru: '👤 Мой профиль', en: '👤 My profile' },
    drv_no_tasks: { uz: '📋 Hozircha sizga tayinlangan topshiriq yo\'q.', ru: '📋 Пока нет назначенных заданий.', en: '📋 No assigned tasks yet.' },
    drv_task_info: {
        uz: '🆕 <b>Topshiriq #{id}</b>\n\n👤 {name}\n📞 {phone}\n📍 {region}\n🏠 Manzil: {address}\n⚖️ Hajm: {volume}\n📸 Rasm: {photo}\n\n🕐 {time}',
        ru: '🆕 <b>Задание #{id}</b>\n\n👤 {name}\n📞 {phone}\n📍 {region}\n🏠 Адрес: {address}\n⚖️ Объём: {volume}\n📸 Фото: {photo}\n\n🕐 {time}',
        en: '🆕 <b>Task #{id}</b>\n\n👤 {name}\n📞 {phone}\n📍 {region}\n🏠 Address: {address}\n⚖️ Volume: {volume}\n📸 Photo: {photo}\n\n🕐 {time}',
    },
    drv_accepted: { uz: '✅ Topshiriq #{id} qabul qilindi!\n\nMijozga xabar yuborildi.', ru: '✅ Задание #{id} принято!\n\nКлиент уведомлён.', en: '✅ Task #{id} accepted!\n\nCustomer notified.' },
    drv_rejected: { uz: '❌ Topshiriq #{id} rad etildi.\n\nMasulga xabar yuborildi.', ru: '❌ Задание #{id} отклонено.\n\nОтветственный уведомлён.', en: '❌ Task #{id} rejected.\n\nSupervisor notified.' },
    drv_en_route: { uz: '🚚 Yo\'lga chiqdingiz!\n\nMijozga avtomatik xabar yuborildi.', ru: '🚚 Вы в пути!\n\nКлиент автоматически уведомлён.', en: '🚚 You\'re en route!\n\nCustomer notified automatically.' },
    drv_arrived: { uz: '📍 Yetib keldingiz!\n\nMijozga xabar yuborildi.\nEndi tortishni boshlang ⚖️', ru: '📍 Вы прибыли!\n\nКлиент уведомлён.\nНачните взвешивание ⚖️', en: '📍 You arrived!\n\nCustomer notified.\nStart weighing ⚖️' },
    drv_enter_weight: { uz: '⚖️ <b>Og\'irlikni kiriting (kg):</b>\n<i>Masalan: 45.5</i>', ru: '⚖️ <b>Введите вес (кг):</b>\n<i>Например: 45.5</i>', en: '⚖️ <b>Enter weight (kg):</b>\n<i>Example: 45.5</i>' },
    drv_enter_discount: {
        uz: '📉 <b>Chegirma foizini kiriting:</b>\n<i>0 — chegirmasiz, 10 — 10% chegirma</i>\n\nSabablar: namlik, ifloslik, yirtiqlik',
        ru: '📉 <b>Введите процент скидки:</b>\n<i>0 — без скидки, 10 — скидка 10%</i>\n\nПричины: влажность, загрязнение, повреждение',
        en: '📉 <b>Enter discount percent:</b>\n<i>0 — no discount, 10 — 10% discount</i>\n\nReasons: moisture, dirt, damage',
    },
    drv_calc_result: {
        uz: '🧮 <b>Hisob-kitob</b>\n\n⚖️ Og\'irlik: {weight} kg\n📉 Chegirma: {discount}%\n📊 Hisoblangan: {effective} kg\n💰 Narx: {price} so\'m/kg\n\n💵 <b>Jami: {total} so\'m</b>\n\nTasdiqlaysizmi?',
        ru: '🧮 <b>Расчёт</b>\n\n⚖️ Вес: {weight} кг\n📉 Скидка: {discount}%\n📊 Расчётный: {effective} кг\n💰 Цена: {price} сум/кг\n\n💵 <b>Итого: {total} сум</b>\n\nПодтверждаете?',
        en: '🧮 <b>Calculation</b>\n\n⚖️ Weight: {weight} kg\n📉 Discount: {discount}%\n📊 Effective: {effective} kg\n💰 Price: {price} UZS/kg\n\n💵 <b>Total: {total} UZS</b>\n\nConfirm?',
    },
    drv_collection_saved: { uz: '✅ <b>Hisob-kitob saqlandi!</b>\n\nMijoz tasdiqini kutamiz...', ru: '✅ <b>Расчёт сохранён!</b>\n\nОжидаем подтверждение клиента...', en: '✅ <b>Calculation saved!</b>\n\nWaiting for customer confirmation...' },
    drv_report: {
        uz: '📊 <b>Kunlik hisobot — {date}</b>\n\n🚛 Topshiriqlar: {tasks}\n✅ Bajarilgan: {completed}\n⚖️ Jami og\'irlik: {weight} kg\n💰 Jami summa: {amount} so\'m',
        ru: '📊 <b>Дневной отчёт — {date}</b>\n\n🚛 Заданий: {tasks}\n✅ Выполнено: {completed}\n⚖️ Общий вес: {weight} кг\n💰 Общая сумма: {amount} сум',
        en: '📊 <b>Daily report — {date}</b>\n\n🚛 Tasks: {tasks}\n✅ Completed: {completed}\n⚖️ Total weight: {weight} kg\n💰 Total amount: {amount} UZS',
    },
};
