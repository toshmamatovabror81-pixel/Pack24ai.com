// ─── Pack24 Ko'p tilli matnlar bazasi ────────────────────────────────────────
// Har bir kalit uchun 3 tilda tarjima

export type Lang = 'uz' | 'ru' | 'en';

type Texts = Record<string, Record<Lang, string>>;

export const t: Texts = {
    // ─── /start va Ro'yxatdan o'tish ────────────────────────────────────
    welcome: {
        uz: '🏭 <b>Pack24 — Qadoqlash Yechimlari</b>\n\nAssalomu alaykum! Til tanlang 👇',
        ru: '🏭 <b>Pack24 — Упаковочные Решения</b>\n\nЗдравствуйте! Выберите язык 👇',
        en: '🏭 <b>Pack24 — Packaging Solutions</b>\n\nHello! Choose your language 👇',
    },

    // ─── Yangi ro'yxatdan o'tish oqimi ──────────────────────────────────
    reg_ask_phone: {
        uz: '📱 <b>Telefon raqamingizni yuboring</b>\n\nQuyidagi tugmani bosing yoki raqamni yozing:\n<i>Masalan: +998901234567</i>',
        ru: '📱 <b>Отправьте номер телефона</b>\n\nНажмите кнопку ниже или введите вручную:\n<i>Например: +998901234567</i>',
        en: '📱 <b>Send your phone number</b>\n\nTap the button below or type manually:\n<i>Example: +998901234567</i>',
    },
    reg_ask_name: {
        uz: '👤 <b>F.I.Sh. kiriting</b>\n\nIsmingiz va familiyangizni to\'liq yozing:\n<i>Masalan: Alisher Karimov</i>',
        ru: '👤 <b>Введите ФИО</b>\n\nВведите полное имя и фамилию:\n<i>Например: Алишер Каримов</i>',
        en: '👤 <b>Enter your Full Name</b>\n\nType your first and last name:\n<i>Example: Alisher Karimov</i>',
    },
    reg_code_sent: {
        uz: '🎉 <b>Tabriklaymiz, {name}!</b>\n\nSizning Pack24 shaxsiy kabinetingiz yaratildi.\n\n🔑 <b>Kirish kodi: <code>{code}</code></b>\n\n📱 Telefon: <b>{phone}</b>\n\n━━━━━━━━━━━━━━━━━━━━\n🌐 Shaxsiy kabinetga kirish:\n<b>pack24.ai</b> → Kirish → Telefon + Kod\n━━━━━━━━━━━━━━━━━━━━\n\n⚠️ Ushbu kodni hech kimga bermang!',
        ru: '🎉 <b>Поздравляем, {name}!</b>\n\nВаш личный кабинет Pack24 создан.\n\n🔑 <b>Код входа: <code>{code}</code></b>\n\n📱 Телефон: <b>{phone}</b>\n\n━━━━━━━━━━━━━━━━━━━━\n🌐 Войти в личный кабинет:\n<b>pack24.ai</b> → Войти → Телефон + Код\n━━━━━━━━━━━━━━━━━━━━\n\n⚠️ Не передавайте этот код никому!',
        en: '🎉 <b>Congratulations, {name}!</b>\n\nYour Pack24 personal cabinet has been created.\n\n🔑 <b>Login code: <code>{code}</code></b>\n\n📱 Phone: <b>{phone}</b>\n\n━━━━━━━━━━━━━━━━━━━━\n🌐 Access your cabinet:\n<b>pack24.ai</b> → Login → Phone + Code\n━━━━━━━━━━━━━━━━━━━━\n\n⚠️ Never share this code!',
    },
    reg_already_exists: {
        uz: '👋 <b>Xush kelibsiz qaytadan, {name}!</b>\n\n📱 Telefon: <b>{phone}</b>\n🔑 Kirish kodingiz: <code>{code}</code>\n\n🌐 <b>pack24.ai</b> saytida shaxsiy kabinetingizga kiring.',
        ru: '👋 <b>С возвращением, {name}!</b>\n\n📱 Телефон: <b>{phone}</b>\n🔑 Ваш код входа: <code>{code}</code>\n\n🌐 Войдите в личный кабинет на <b>pack24.ai</b>',
        en: '👋 <b>Welcome back, {name}!</b>\n\n📱 Phone: <b>{phone}</b>\n🔑 Your login code: <code>{code}</code>\n\n🌐 Access your cabinet at <b>pack24.ai</b>',
    },
    reg_phone_taken: {
        uz: '❌ Bu telefon raqam allaqachon ro\'yxatdan o\'tgan.\n\n/start ni bosing va kabinetingizga kiring.',
        ru: '❌ Этот номер телефона уже зарегистрирован.\n\nНажмите /start для входа в кабинет.',
        en: '❌ This phone number is already registered.\n\nPress /start to access your cabinet.',
    },
    reg_name_too_short: {
        uz: '❌ Ism juda qisqa. Iltimos, to\'liq F.I.Sh. kiriting (kamida 3 harf).',
        ru: '❌ Имя слишком короткое. Пожалуйста, введите полное ФИО (минимум 3 символа).',
        en: '❌ Name is too short. Please enter your full name (at least 3 characters).',
    },

    // ─── Shaxsiy kabinet ─────────────────────────────────────────────────
    cabinet_menu: {
        uz: '🏠 <b>Shaxsiy kabinet</b>\n\n👤 {name}\n📱 {phone}\n⭐ Eko-ballar: <b>{points}</b>\n\nNimani qilmoqchisiz? 👇',
        ru: '🏠 <b>Личный кабинет</b>\n\n👤 {name}\n📱 {phone}\n⭐ Эко-баллы: <b>{points}</b>\n\nЧто хотите сделать? 👇',
        en: '🏠 <b>Personal Cabinet</b>\n\n👤 {name}\n📱 {phone}\n⭐ Eco points: <b>{points}</b>\n\nWhat would you like to do? 👇',
    },
    cabinet_btn_orders: {
        uz: '📦 Buyurtmalarim',
        ru: '📦 Мои заказы',
        en: '📦 My Orders',
    },
    cabinet_btn_recycling: {
        uz: '♻️ Makulatura tarixi',
        ru: '♻️ История макулатуры',
        en: '♻️ Recycling History',
    },
    cabinet_btn_referral: {
        uz: '👥 Referral dastur',
        ru: '👥 Реферальная программа',
        en: '👥 Referral Program',
    },
    cabinet_btn_settings: {
        uz: '⚙️ Sozlamalar',
        ru: '⚙️ Настройки',
        en: '⚙️ Settings',
    },
    cabinet_btn_code: {
        uz: '🔑 Kirish kodimni ko\'rish',
        ru: '🔑 Показать код входа',
        en: '🔑 Show login code',
    },

    register_name: {
        uz: '👤 Iltimos, <b>Ismingiz va Familiyangizni</b> kiriting:\n<i>Masalan: Alisher Karimov</i>',
        ru: '👤 Пожалуйста, введите <b>Имя и Фамилию</b>:\n<i>Например: Алишер Каримов</i>',
        en: '👤 Please enter your <b>Full Name</b>:\n<i>Example: Alisher Karimov</i>',
    },
    register_phone: {
        uz: '📱 Telefon raqamingizni yuboring:',
        ru: '📱 Отправьте свой номер телефона:',
        en: '📱 Send your phone number:',
    },
    register_success: {
        uz: '✅ Ro\'yxatdan muvaffaqiyatli o\'tdingiz!\n\nQuyidagi tugmalar orqali foydalaning 👇',
        ru: '✅ Вы успешно зарегистрированы!\n\nИспользуйте кнопки ниже 👇',
        en: '✅ Successfully registered!\n\nUse the buttons below 👇',
    },
    share_contact: {
        uz: '📱 Kontakt yuborish',
        ru: '📱 Отправить контакт',
        en: '📱 Share Contact',
    },

    // ─── Bosh menyu tugmalari ────────────────────────────────────────────
    btn_open_app: {
        uz: '🌐 Pack24 ni ochish',
        ru: '🌐 Открыть Pack24',
        en: '🌐 Open Pack24',
    },
    btn_catalog: {
        uz: '📦 Mahsulotlar katalogi',
        ru: '📦 Каталог продукции',
        en: '📦 Product Catalog',
    },
    btn_recycle: {
        uz: '♻️ Makulatura xizmati',
        ru: '♻️ Услуга по макулатуре',
        en: '♻️ Recycling Service',
    },
    btn_ai: {
        uz: '🤖 AI Assistent',
        ru: '🤖 AI Ассистент',
        en: '🤖 AI Assistant',
    },
    btn_contact: {
        uz: '📞 Bog\'lanish',
        ru: '📞 Связаться',
        en: '📞 Contact Us',
    },
    btn_my_requests: {
        uz: '📋 Arizalarim',
        ru: '📋 Мои заявки',
        en: '📋 My Requests',
    },
    btn_settings: {
        uz: '⚙️ Sozlamalar',
        ru: '⚙️ Настройки',
        en: '⚙️ Settings',
    },

    // ─── Makulatura oqimi ────────────────────────────────────────────────
    recycle_start: {
        uz: '♻️ <b>Makulatura xizmati</b>\n\nIltimos, joylashuvingizni yuboring 👇',
        ru: '♻️ <b>Услуга макулатуры</b>\n\nПожалуйста, отправьте свою геолокацию 👇',
        en: '♻️ <b>Recycling Service</b>\n\nPlease send your location 👇',
    },
    location_gps: {
        uz: '📍 GPS orqali yuborish',
        ru: '📍 Отправить по GPS',
        en: '📍 Send via GPS',
    },
    location_map: {
        uz: '🗺️ Xaritadan tanlash',
        ru: '🗺️ Выбрать на карте',
        en: '🗺️ Choose on map',
    },
    location_text: {
        uz: '✍️ Manzilni yozish',
        ru: '✍️ Написать адрес',
        en: '✍️ Type address',
    },
    recycle_choose: {
        uz: '📍 Joylashuvingiz qabul qilindi!\n\n<b>Qanday topshirmoqchisiz?</b>',
        ru: '📍 Ваша геолокация принята!\n\n<b>Как хотите сдать?</b>',
        en: '📍 Location received!\n\n<b>How would you like to deliver?</b>',
    },
    btn_self_delivery: {
        uz: '🏭 O\'zim olib boraman',
        ru: '🏭 Привезу сам',
        en: '🏭 Self-delivery',
    },
    btn_call_truck: {
        uz: '🚛 Mashina chaqiraman',
        ru: '🚛 Вызвать машину',
        en: '🚛 Call a truck',
    },

    // ─── Eng yaqin punkt ─────────────────────────────────────────────────
    nearest_point: {
        uz: '📍 <b>Eng yaqin punkt:</b> {name}\n📏 Masofa: ~{distance} km\n🕐 Ish tartibi: {schedule}\n{status}\n\n💰 <b>Narxlar:</b>\n{prices}\n\n👷 Masul: <b>{supervisor}</b>\n📞 Tel: {phone}\n💬 Telegram: @{telegram}\n\n📍 Lokatsiya:',
        ru: '📍 <b>Ближайший пункт:</b> {name}\n📏 Расстояние: ~{distance} км\n🕐 Режим работы: {schedule}\n{status}\n\n💰 <b>Цены:</b>\n{prices}\n\n👷 Ответственный: <b>{supervisor}</b>\n📞 Тел: {phone}\n💬 Telegram: @{telegram}\n\n📍 Локация:',
        en: '📍 <b>Nearest point:</b> {name}\n📏 Distance: ~{distance} km\n🕐 Working hours: {schedule}\n{status}\n\n💰 <b>Prices:</b>\n{prices}\n\n👷 Supervisor: <b>{supervisor}</b>\n📞 Phone: {phone}\n💬 Telegram: @{telegram}\n\n📍 Location:',
    },
    point_open: {
        uz: '🟢 <b>OCHIQ</b> — qabul qilinmoqda',
        ru: '🟢 <b>ОТКРЫТ</b> — принимается',
        en: '🟢 <b>OPEN</b> — accepting',
    },
    point_closed: {
        uz: '🔴 <b>YOPIQ</b> — hozircha qabul bo\'lmayapti',
        ru: '🔴 <b>ЗАКРЫТ</b> — временно не принимается',
        en: '🔴 <b>CLOSED</b> — not accepting now',
    },

    // ─── Mashina chaqirish ───────────────────────────────────────────────
    truck_volume: {
        uz: '⚖️ <b>Taxminiy hajmni tanlang:</b>',
        ru: '⚖️ <b>Выберите примерный объём:</b>',
        en: '⚖️ <b>Select approximate volume:</b>',
    },
    vol_small: {
        uz: '📦 Kichik (50 kg gacha)',
        ru: '📦 Малый (до 50 кг)',
        en: '📦 Small (up to 50 kg)',
    },
    vol_medium: {
        uz: '📦📦 O\'rta (50–200 kg)',
        ru: '📦📦 Средний (50–200 кг)',
        en: '📦📦 Medium (50–200 kg)',
    },
    vol_large: {
        uz: '📦📦📦 Katta (200+ kg)',
        ru: '📦📦📦 Большой (200+ кг)',
        en: '📦📦📦 Large (200+ kg)',
    },
    truck_photo: {
        uz: '📸 Iloji bo\'lsa makulaturangiz rasmini yuboring.\nBu haydovchiga tayyorgarlik ko\'rishga yordam beradi.',
        ru: '📸 Если возможно, отправьте фото макулатуры.\nЭто поможет водителю подготовиться.',
        en: '📸 If possible, send a photo of your recyclables.\nThis helps the driver prepare.',
    },
    btn_skip_photo: {
        uz: '⏭️ O\'tkazib yuborish',
        ru: '⏭️ Пропустить',
        en: '⏭️ Skip',
    },
    truck_request_sent: {
        uz: '✅ <b>Arizangiz qabul qilindi!</b>\n\nMasul xodim tez orada haydovchi tayinlaydi.\nJarayon haqida sizga avtomatik xabar berib boriladi 👇',
        ru: '✅ <b>Заявка принята!</b>\n\nОтветственный сотрудник скоро назначит водителя.\nВы будете получать уведомления автоматически 👇',
        en: '✅ <b>Request accepted!</b>\n\nA supervisor will assign a driver soon.\nYou will receive automatic updates 👇',
    },

    // ─── Status tracking ─────────────────────────────────────────────────
    status_new: { uz: '🔵 Yangi', ru: '🔵 Новая', en: '🔵 New' },
    status_dispatched: { uz: '📋 Masulga yuborildi', ru: '📋 Отправлено ответственному', en: '📋 Dispatched' },
    status_assigned: { uz: '🚚 Haydovchi tayinlandi', ru: '🚚 Водитель назначен', en: '🚚 Driver assigned' },
    status_en_route: { uz: '🚚 Haydovchi yo\'lda', ru: '🚚 Водитель в пути', en: '🚚 Driver en route' },
    status_arrived: { uz: '📍 Haydovchi yetib keldi', ru: '📍 Водитель прибыл', en: '📍 Driver arrived' },
    status_collecting: { uz: '⚖️ Tortilmoqda', ru: '⚖️ Взвешивание', en: '⚖️ Weighing' },
    status_completed: { uz: '✅ Yakunlandi', ru: '✅ Завершено', en: '✅ Completed' },
    status_cancelled: { uz: '❌ Bekor qilindi', ru: '❌ Отменено', en: '❌ Cancelled' },

    // ─── Umumiy ──────────────────────────────────────────────────────────
    cancel: { uz: '❌ Bekor qilish', ru: '❌ Отменить', en: '❌ Cancel' },
    back: { uz: '🔙 Orqaga', ru: '🔙 Назад', en: '🔙 Back' },
    error: {
        uz: '❌ Xatolik yuz berdi. Qayta urinib ko\'ring.',
        ru: '❌ Произошла ошибка. Попробуйте снова.',
        en: '❌ An error occurred. Please try again.',
    },
    register_code_btn: {
        uz: '🔑 Kod bilan kirish (xodim)',
        ru: '🔑 Войти по коду (сотрудник)',
        en: '🔑 Login with code (staff)',
    },

    // ═══════════════════════════════════════════════════════════════════════
    // HAYDOVCHI BOT (driverBot) MATNLARI
    // ═══════════════════════════════════════════════════════════════════════

    drv_welcome: {
        uz: '🚚 <b>Pack24 — Haydovchi boti</b>\n\nXush kelibsiz! Ro\'yxatdan o\'tish uchun telefon raqamingizni ulashing 👇',
        ru: '🚚 <b>Pack24 — Бот водителя</b>\n\nДобро пожаловать! Поделитесь номером телефона для регистрации 👇',
        en: '🚚 <b>Pack24 — Driver Bot</b>\n\nWelcome! Share your phone number to register 👇',
    },
    drv_share_phone: {
        uz: '📱 Kontaktni ulashish',
        ru: '📱 Поделиться контактом',
        en: '📱 Share Contact',
    },
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
    drv_btn_tasks: {
        uz: '📋 Topshiriqlar',
        ru: '📋 Задания',
        en: '📋 Tasks',
    },
    drv_btn_report: {
        uz: '📊 Kunlik hisobot',
        ru: '📊 Дневной отчёт',
        en: '📊 Daily report',
    },
    drv_btn_online: {
        uz: '🟢 Men onlineman',
        ru: '🟢 Я онлайн',
        en: '🟢 I\'m online',
    },
    drv_btn_offline: {
        uz: '🔴 Offlineman',
        ru: '🔴 Я оффлайн',
        en: '🔴 I\'m offline',
    },
    drv_btn_profile: {
        uz: '👤 Profilim',
        ru: '👤 Мой профиль',
        en: '👤 My profile',
    },
    drv_no_tasks: {
        uz: '📋 Hozircha sizga tayinlangan topshiriq yo\'q.',
        ru: '📋 Пока нет назначенных заданий.',
        en: '📋 No assigned tasks yet.',
    },
    drv_task_info: {
        uz: '🆕 <b>Topshiriq #{id}</b>\n\n👤 {name}\n📞 {phone}\n📍 {region}\n⚖️ Hajm: {volume}\n📸 Rasm: {photo}\n\n🕐 {time}',
        ru: '🆕 <b>Задание #{id}</b>\n\n👤 {name}\n📞 {phone}\n📍 {region}\n⚖️ Объём: {volume}\n📸 Фото: {photo}\n\n🕐 {time}',
        en: '🆕 <b>Task #{id}</b>\n\n👤 {name}\n📞 {phone}\n📍 {region}\n⚖️ Volume: {volume}\n📸 Photo: {photo}\n\n🕐 {time}',
    },
    drv_accepted: {
        uz: '✅ Topshiriq #{id} qabul qilindi!\n\nMijozga xabar yuborildi.',
        ru: '✅ Задание #{id} принято!\n\nКлиент уведомлён.',
        en: '✅ Task #{id} accepted!\n\nCustomer notified.',
    },
    drv_rejected: {
        uz: '❌ Topshiriq #{id} rad etildi.\n\nMasulga xabar yuborildi.',
        ru: '❌ Задание #{id} отклонено.\n\nОтветственный уведомлён.',
        en: '❌ Task #{id} rejected.\n\nSupervisor notified.',
    },
    drv_en_route: {
        uz: '🚚 Yo\'lga chiqdingiz!\n\nMijozga avtomatik xabar yuborildi.',
        ru: '🚚 Вы в пути!\n\nКлиент автоматически уведомлён.',
        en: '🚚 You\'re en route!\n\nCustomer notified automatically.',
    },
    drv_arrived: {
        uz: '📍 Yetib keldingiz!\n\nMijozga xabar yuborildi.\nEndi tortishni boshlang ⚖️',
        ru: '📍 Вы прибыли!\n\nКлиент уведомлён.\nНачните взвешивание ⚖️',
        en: '📍 You arrived!\n\nCustomer notified.\nStart weighing ⚖️',
    },
    drv_enter_weight: {
        uz: '⚖️ <b>Og\'irlikni kiriting (kg):</b>\n<i>Masalan: 45.5</i>',
        ru: '⚖️ <b>Введите вес (кг):</b>\n<i>Например: 45.5</i>',
        en: '⚖️ <b>Enter weight (kg):</b>\n<i>Example: 45.5</i>',
    },
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
    drv_collection_saved: {
        uz: '✅ <b>Hisob-kitob saqlandi!</b>\n\nMijoz tasdiqini kutamiz...',
        ru: '✅ <b>Расчёт сохранён!</b>\n\nОжидаем подтверждение клиента...',
        en: '✅ <b>Calculation saved!</b>\n\nWaiting for customer confirmation...',
    },
    drv_report: {
        uz: '📊 <b>Kunlik hisobot — {date}</b>\n\n🚛 Topshiriqlar: {tasks}\n✅ Bajarilgan: {completed}\n⚖️ Jami og\'irlik: {weight} kg\n💰 Jami summa: {amount} so\'m',
        ru: '📊 <b>Дневной отчёт — {date}</b>\n\n🚛 Заданий: {tasks}\n✅ Выполнено: {completed}\n⚖️ Общий вес: {weight} кг\n💰 Общая сумма: {amount} сум',
        en: '📊 <b>Daily report — {date}</b>\n\n🚛 Tasks: {tasks}\n✅ Completed: {completed}\n⚖️ Total weight: {weight} kg\n💰 Total amount: {amount} UZS',
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN/MASUL BOT (adminBot) MATNLARI
    // ═══════════════════════════════════════════════════════════════════════

    adm_welcome: {
        uz: '👷 <b>Pack24 — Masul boti</b>\n\nXush kelibsiz! Ro\'yxatdan o\'tish uchun telefon raqamingizni ulashing 👇',
        ru: '👷 <b>Pack24 — Бот ответственного</b>\n\nДобро пожаловать! Поделитесь номером телефона для регистрации 👇',
        en: '👷 <b>Pack24 — Supervisor Bot</b>\n\nWelcome! Share your phone number to register 👇',
    },
    adm_share_phone: {
        uz: '📱 Kontaktni ulashish',
        ru: '📱 Поделиться контактом',
        en: '📱 Share Contact',
    },
    adm_not_in_db: {
        uz: '❌ <b>Raqamingiz tizimda topilmadi!</b>\n\nAdmin bilan bog\'laning:\n📞 +998 88 055-78-88',
        ru: '❌ <b>Номер не найден в системе!</b>\n\nСвяжитесь с администратором:\n📞 +998 88 055-78-88',
        en: '❌ <b>Phone not found in system!</b>\n\nContact admin:\n📞 +998 88 055-78-88',
    },
    adm_already_registered: {
        uz: '⚠️ Bu telefon raqam boshqa Telegram akkauntga bog\'langan.\nAdmin bilan bog\'laning.',
        ru: '⚠️ Этот номер привязан к другому аккаунту Telegram.\nОбратитесь к администратору.',
        en: '⚠️ This phone is linked to another Telegram account.\nContact admin.',
    },
    adm_code_sent: {
        uz: '✅ <b>Muvaffaqiyatli ro\'yxatdan o\'tdingiz!</b>\n\n👤 {name}\n🏭 Punkt: {point}\n\n🔑 <b>Sizning verifikatsion kodingiz:</b>\n\n<code>{code}</code>\n\n📌 Bu kodni xotirada saqlang.\n\nAdmin panelda ham ko\'rinadi ✓',
        ru: '✅ <b>Успешно зарегистрированы!</b>\n\n👤 {name}\n🏭 Пункт: {point}\n\n🔑 <b>Ваш верификационный код:</b>\n\n<code>{code}</code>\n\n📌 Сохраните этот код.\n\nТакже виден в панели администратора ✓',
        en: '✅ <b>Successfully registered!</b>\n\n👤 {name}\n🏭 Point: {point}\n\n🔑 <b>Your verification code:</b>\n\n<code>{code}</code>\n\n📌 Save this code.\n\nAlso visible in admin panel ✓',
    },
    adm_registered: {
        uz: '✅ <b>Muvaffaqiyatli!</b>\n\n👷 Siz masul sifatida ro\'yxatdan o\'tdingiz.\n👤 {name}\n🏭 Punkt: {point}\n\nQuyidagi tugmalar orqali ishlang 👇',
        ru: '✅ <b>Успешно!</b>\n\n👷 Вы зарегистрированы как ответственный.\n👤 {name}\n🏭 Пункт: {point}\n\nИспользуйте кнопки ниже 👇',
        en: '✅ <b>Success!</b>\n\n👷 You are registered as a supervisor.\n👤 {name}\n🏭 Point: {point}\n\nUse the buttons below 👇',
    },
    adm_not_registered: {
        uz: '❌ Siz masul sifatida ro\'yxatdan o\'tmagansiz.\n\n5 raqamli kodingizni kiriting yoki /start bosing.',
        ru: '❌ Вы не зарегистрированы как ответственный.\n\nВведите 5-значный код или нажмите /start.',
        en: '❌ You are not registered as a supervisor.\n\nEnter your 5-digit code or press /start.',
    },
    adm_btn_requests: {
        uz: '📋 Arizalar',
        ru: '📋 Заявки',
        en: '📋 Requests',
    },
    adm_btn_drivers: {
        uz: '👥 Haydovchilar',
        ru: '👥 Водители',
        en: '👥 Drivers',
    },
    adm_btn_payments: {
        uz: '💰 To\'lovlar',
        ru: '💰 Оплаты',
        en: '💰 Payments',
    },
    adm_btn_point: {
        uz: '🏭 Punkt holati',
        ru: '🏭 Управление пунктом',
        en: '🏭 Point management',
    },
    adm_btn_report: {
        uz: '📊 Hisobotlar',
        ru: '📊 Отчёты',
        en: '📊 Reports',
    },
    adm_no_requests: {
        uz: '📋 Hozircha yangi ariza yo\'q.',
        ru: '📋 Пока нет новых заявок.',
        en: '📋 No new requests yet.',
    },
    adm_request_info: {
        uz: '📋 <b>Ariza #{id}</b>\n\n👤 {name}\n📞 {phone}\n📍 {region}\n⚖️ Hajm: {volume}\n📸 Rasm: {photo}\n🕐 {time}\n\n📌 Status: {status}',
        ru: '📋 <b>Заявка #{id}</b>\n\n👤 {name}\n📞 {phone}\n📍 {region}\n⚖️ Объём: {volume}\n📸 Фото: {photo}\n🕐 {time}\n\n📌 Статус: {status}',
        en: '📋 <b>Request #{id}</b>\n\n👤 {name}\n📞 {phone}\n📍 {region}\n⚖️ Volume: {volume}\n📸 Photo: {photo}\n🕐 {time}\n\n📌 Status: {status}',
    },
    adm_select_driver: {
        uz: '🚚 <b>Ariza #{id} uchun haydovchi tanlang:</b>',
        ru: '🚚 <b>Выберите водителя для заявки #{id}:</b>',
        en: '🚚 <b>Select a driver for request #{id}:</b>',
    },
    adm_driver_assigned: {
        uz: '✅ Ariza #{id} ga <b>{driver}</b> tayinlandi!\n\nHaydovchi va mijozga xabar yuborildi.',
        ru: '✅ На заявку #{id} назначен <b>{driver}</b>!\n\nВодитель и клиент уведомлены.',
        en: '✅ <b>{driver}</b> assigned to request #{id}!\n\nDriver and customer notified.',
    },
    adm_no_drivers: {
        uz: '❌ Hozircha online haydovchi yo\'q.',
        ru: '❌ Пока нет водителей онлайн.',
        en: '❌ No drivers online.',
    },
    adm_point_status: {
        uz: '🏭 <b>{name}</b>\n\n📍 Holat: {status}\n🕐 Ish vaqti: {hours}\n\nO\'zgartiring 👇',
        ru: '🏭 <b>{name}</b>\n\n📍 Статус: {status}\n🕐 Рабочее время: {hours}\n\nИзмените 👇',
        en: '🏭 <b>{name}</b>\n\n📍 Status: {status}\n🕐 Working hours: {hours}\n\nChange 👇',
    },
    adm_point_toggled: {
        uz: '✅ Punkt holati o\'zgartirildi: {status}',
        ru: '✅ Статус пункта изменён: {status}',
        en: '✅ Point status changed: {status}',
    },
    adm_report: {
        uz: '📊 <b>Hisobot — {period}</b>\n\n📋 Arizalar: {requests}\n✅ Bajarilgan: {completed}\n⚖️ Jami og\'irlik: {weight} kg\n💰 Jami summa: {amount} so\'m\n🚚 Haydovchilar: {drivers}',
        ru: '📊 <b>Отчёт — {period}</b>\n\n📋 Заявок: {requests}\n✅ Выполнено: {completed}\n⚖️ Общий вес: {weight} кг\n💰 Общая сумма: {amount} сум\n🚚 Водителей: {drivers}',
        en: '📊 <b>Report — {period}</b>\n\n📋 Requests: {requests}\n✅ Completed: {completed}\n⚖️ Total weight: {weight} kg\n💰 Total amount: {amount} UZS\n🚚 Drivers: {drivers}',
    },
    adm_payment_info: {
        uz: '💰 <b>To\'lov #{id}</b>\n\n👤 Mijoz: {customer}\n🚚 Haydovchi: {driver}\n⚖️ Og\'irlik: {weight} kg\n💵 Summa: {amount} so\'m\n\n📌 Holat: {status}',
        ru: '💰 <b>Оплата #{id}</b>\n\n👤 Клиент: {customer}\n🚚 Водитель: {driver}\n⚖️ Вес: {weight} кг\n💵 Сумма: {amount} сум\n\n📌 Статус: {status}',
        en: '💰 <b>Payment #{id}</b>\n\n👤 Customer: {customer}\n🚚 Driver: {driver}\n⚖️ Weight: {weight} kg\n💵 Amount: {amount} UZS\n\n📌 Status: {status}',
    },
    adm_payment_approved: {
        uz: '✅ To\'lov #{id} tasdiqlandi!',
        ru: '✅ Оплата #{id} подтверждена!',
        en: '✅ Payment #{id} approved!',
    },

    // ─── Umumiy (cross-bot) ──────────────────────────────────────────────
    notif_driver_assigned: {
        uz: '🚚 Sizga haydovchi tayinlandi!\n\n👤 {driver}\n📞 {phone}\n\nTez orada sizga qo\'ng\'iroq qiladi.',
        ru: '🚚 Вам назначен водитель!\n\n👤 {driver}\n📞 {phone}\n\nСкоро с вами свяжется.',
        en: '🚚 A driver has been assigned!\n\n👤 {driver}\n📞 {phone}\n\nWill contact you soon.',
    },
    notif_en_route: {
        uz: '🚚 Haydovchi <b>{driver}</b> yo\'lga chiqdi!\n\nTaxminiy vaqt: 15-30 daqiqa',
        ru: '🚚 Водитель <b>{driver}</b> выехал!\n\nПримерное время: 15-30 минут',
        en: '🚚 Driver <b>{driver}</b> is on the way!\n\nEstimated time: 15-30 minutes',
    },
    notif_arrived: {
        uz: '📍 Haydovchi <b>{driver}</b> yetib keldi!\n\nIltimos, makulaturani tayyorlang.',
        ru: '📍 Водитель <b>{driver}</b> прибыл!\n\nПожалуйста, подготовьте макулатуру.',
        en: '📍 Driver <b>{driver}</b> has arrived!\n\nPlease prepare your recyclables.',
    },
    notif_calc_confirm: {
        uz: '🧮 <b>Hisob-kitob tayyor!</b>\n\n⚖️ Og\'irlik: {weight} kg\n📉 Chegirma: {discount}%\n💵 <b>Jami: {total} so\'m</b>\n\nTasdiqlaysizmi?',
        ru: '🧮 <b>Расчёт готов!</b>\n\n⚖️ Вес: {weight} кг\n📉 Скидка: {discount}%\n💵 <b>Итого: {total} сум</b>\n\nПодтверждаете?',
        en: '🧮 <b>Calculation ready!</b>\n\n⚖️ Weight: {weight} kg\n📉 Discount: {discount}%\n💵 <b>Total: {total} UZS</b>\n\nConfirm?',
    },

    // ═══════════════════════════════════════════════════════════════════════
    // 🌿 PRTS (Personal Recycle Track System)
    // ═══════════════════════════════════════════════════════════════════════

    btn_prts: {
        uz: '🌿 PRTS Ballarim',
        ru: '🌿 Мои PRTS баллы',
        en: '🌿 My PRTS Points',
    },
    cabinet_btn_prts: {
        uz: '🌿 PRTS Dashboard',
        ru: '🌿 PRTS Панель',
        en: '🌿 PRTS Dashboard',
    },
    prts_info: {
        uz: '🌿 <b>PRTS — Personal Recycle Track System</b>\n\n♻️ PRTS — bu chiqindilarni qayta ishlashga topshirish va buning evaziga mukofotlar olish platformasi.\n\n<b>Qanday ishlaydi?</b>\n\n1️⃣ Siz makulatura, plastmassa, shisha, bakalashka kabi chiqindilarni yig\'ishga buyurtma berasiz\n2️⃣ Haydovchi kelib chiqindini olib ketadi\n3️⃣ Har bir kg uchun <b>PRTS ballar</b> olasiz\n4️⃣ Ballarni pul yoki boshqa mukofotlarga almashtirasiz!\n\n📦 <b>Qabul qilinadigan chiqindilar:</b>\n• 📄 Makulatura (gazeta, kitob, karton)\n• 🧴 Plastmassa (butilka, idish)\n• 🍶 Shisha (bankalar, butilkalar)\n• 🥫 Metal (konservalar, banalar)\n• 💻 Elektronika (eski texnika)\n\n💰 <b>Mukofotlar:</b>\n• ☕ 150 ball → Kofe 50% chegirma\n• 🚌 300 ball → Bepul transport\n• 🎬 500 ball → Kino chipta\n• 🌳 1000 ball → Daraxt ekish\n\n🌍 Har bir kg chiqindi — tabiat uchun katta yordam!\n\n━━━━━━━━━━━━━━━━━━━━\n🔗 <b>pack24.ai/prts</b> — Veb dashboard',
        ru: '🌿 <b>PRTS — Personal Recycle Track System</b>\n\n♻️ PRTS — это платформа для сдачи отходов на переработку и получения наград.\n\n<b>Как это работает?</b>\n\n1️⃣ Вы заказываете вывоз макулатуры, пластика, стекла, бутылок и др.\n2️⃣ Водитель приезжает и забирает отходы\n3️⃣ За каждый кг вы получаете <b>PRTS баллы</b>\n4️⃣ Баллы обмениваются на деньги или подарки!\n\n📦 <b>Принимаемые отходы:</b>\n• 📄 Макулатура (газеты, книги, картон)\n• 🧴 Пластик (бутылки, тара)\n• 🍶 Стекло (банки, бутылки)\n• 🥫 Металл (консервы, банки)\n• 💻 Электроника (старая техника)\n\n💰 <b>Награды:</b>\n• ☕ 150 баллов → 50% скидка на кофе\n• 🚌 300 баллов → Бесплатный проезд\n• 🎬 500 баллов → Билет в кино\n• 🌳 1000 баллов → Посадка дерева\n\n🌍 Каждый кг отходов — большая помощь природе!\n\n━━━━━━━━━━━━━━━━━━━━\n🔗 <b>pack24.ai/prts</b> — Веб панель',
        en: '🌿 <b>PRTS — Personal Recycle Track System</b>\n\n♻️ PRTS is a platform for recycling waste and earning rewards in return.\n\n<b>How does it work?</b>\n\n1️⃣ You order a pickup for paper, plastic, glass, bottles, etc.\n2️⃣ A driver comes and collects your waste\n3️⃣ You earn <b>PRTS points</b> for every kg\n4️⃣ Exchange points for cash or rewards!\n\n📦 <b>Accepted waste:</b>\n• 📄 Paper (newspapers, books, cardboard)\n• 🧴 Plastic (bottles, containers)\n• 🍶 Glass (jars, bottles)\n• 🥫 Metal (cans, tins)\n• 💻 Electronics (old devices)\n\n💰 <b>Rewards:</b>\n• ☕ 150 pts → 50% coffee discount\n• 🚌 300 pts → Free transport pass\n• 🎬 500 pts → Cinema ticket\n• 🌳 1000 pts → Plant a tree\n\n🌍 Every kg of waste helps nature!\n\n━━━━━━━━━━━━━━━━━━━━\n🔗 <b>pack24.ai/prts</b> — Web dashboard',
    },
    prts_dashboard: {
        uz: '📊 <b>Sizning PRTS hisobingiz</b>\n\n👤 {name}\n\n♻️ Qayta ishlangan: <b>{weight} kg</b>\n🌍 CO₂ tejaldi: <b>{co2} kg</b>\n🌳 Daraxtlar saqlandi: <b>{trees} ta</b>\n💧 Suv tejaldi: <b>{water} L</b>\n\n🏆 <b>PRTS ballaringiz: {points}</b>',
        ru: '📊 <b>Ваш PRTS аккаунт</b>\n\n👤 {name}\n\n♻️ Переработано: <b>{weight} кг</b>\n🌍 CO₂ сэкономлено: <b>{co2} кг</b>\n🌳 Деревьев спасено: <b>{trees} шт.</b>\n💧 Воды сэкономлено: <b>{water} л</b>\n\n🏆 <b>Ваши PRTS баллы: {points}</b>',
        en: '📊 <b>Your PRTS Account</b>\n\n👤 {name}\n\n♻️ Recycled: <b>{weight} kg</b>\n🌍 CO₂ saved: <b>{co2} kg</b>\n🌳 Trees saved: <b>{trees}</b>\n💧 Water saved: <b>{water} L</b>\n\n🏆 <b>Your PRTS points: {points}</b>',
    },
    prts_rewards_list: {
        uz: '🎁 <b>Mukofotlar</b>\n\nSizning ballaringiz: <b>{points} PRTS</b>\n\n☕ Kofe 50% chegirma — <b>150 ball</b>\n🚌 Bepul transport — <b>300 ball</b>\n🎬 Kino chipta — <b>500 ball</b>\n🌳 Daraxt ekish — <b>1000 ball</b>\n\nAlmashtirish uchun tanlang 👇',
        ru: '🎁 <b>Награды</b>\n\nВаши баллы: <b>{points} PRTS</b>\n\n☕ 50% скидка на кофе — <b>150 баллов</b>\n🚌 Бесплатный проезд — <b>300 баллов</b>\n🎬 Билет в кино — <b>500 баллов</b>\n🌳 Посадка дерева — <b>1000 баллов</b>\n\nВыберите для обмена 👇',
        en: '🎁 <b>Rewards</b>\n\nYour points: <b>{points} PRTS</b>\n\n☕ 50% coffee discount — <b>150 pts</b>\n🚌 Free transport — <b>300 pts</b>\n🎬 Cinema ticket — <b>500 pts</b>\n🌳 Plant a tree — <b>1000 pts</b>\n\nSelect to redeem 👇',
    },
    prts_reward_success: {
        uz: '🎉 <b>Tabriklaymiz!</b>\n\n{reward} muvaffaqiyatli almashtirildi!\n\n💰 Sarflandi: <b>{spent} ball</b>\n📊 Qoldiq: <b>{remaining} ball</b>',
        ru: '🎉 <b>Поздравляем!</b>\n\n{reward} успешно получена!\n\n💰 Потрачено: <b>{spent} баллов</b>\n📊 Остаток: <b>{remaining} баллов</b>',
        en: '🎉 <b>Congratulations!</b>\n\n{reward} successfully redeemed!\n\n💰 Spent: <b>{spent} pts</b>\n📊 Remaining: <b>{remaining} pts</b>',
    },
    prts_insufficient: {
        uz: '❌ <b>Ball yetarli emas!</b>\n\nKerakli: {required} ball\nSizda: {current} ball\nYetishmaydi: {diff} ball\n\n♻️ Ko\'proq makulatura topshiring va ball to\'plang!',
        ru: '❌ <b>Недостаточно баллов!</b>\n\nНеобходимо: {required} баллов\nУ вас: {current} баллов\nНе хватает: {diff} баллов\n\n♻️ Сдавайте больше макулатуры и копите баллы!',
        en: '❌ <b>Insufficient points!</b>\n\nRequired: {required} pts\nYou have: {current} pts\nNeed: {diff} more\n\n♻️ Recycle more to earn points!',
    },
};

// Yordamchi: matnni olish
export function getText(key: string, lang: Lang): string {
    return t[key]?.[lang] || t[key]?.uz || key;
}

// Yordamchi: template o'zgaruvchilarni almashtirish
export function formatText(key: string, lang: Lang, vars: Record<string, string>): string {
    let text = getText(key, lang);
    for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return text;
}
