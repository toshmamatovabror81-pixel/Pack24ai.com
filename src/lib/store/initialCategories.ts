import { Category } from './useCategoryStore';

export const initialCategories: Category[] = [
    {
        id: 'cat-1',
        name: { uz: 'Karton Qutilar', ru: 'Картонные коробки', en: 'Cardboard Boxes' },
        icon: 'Box',
        slug: 'karton-qutilar',
        productCount: 0,
        isActive: true,
        children: [
            { id: 'sub-1-1', name: { uz: "To'rt klapanli", ru: 'Четырехклапанные', en: 'Four-flap' }, icon: 'Box', slug: 'tort-klapanli', productCount: 0, isActive: true },
            { id: 'sub-1-2', name: { uz: "O'zi yig'iladigan", ru: 'Самосборные', en: 'Self-assembling' }, icon: 'PackageOpen', slug: 'ozi-yigiladigan', productCount: 0, isActive: true },
            { id: 'sub-1-3', name: { uz: 'Pochta qutilari', ru: 'Почтовые коробки', en: 'Mail Boxes' }, icon: 'Mail', slug: 'pochta-qutilari', productCount: 0, isActive: true },
            { id: 'sub-1-4', name: { uz: 'Arxiv qutilari', ru: 'Архивные коробки', en: 'Archive Boxes' }, icon: 'Archive', slug: 'arxiv-qutilari', productCount: 0, isActive: true },
            { id: 'sub-1-5', name: { uz: 'Konditer qutilari', ru: 'Кондитерские', en: 'Confectionery' }, icon: 'Croissant', slug: 'konditer-qutilari', productCount: 0, isActive: true },
            { id: 'sub-1-6', name: { uz: 'Pitsa qutilari', ru: 'Для пиццы', en: 'Pizza Boxes' }, icon: 'Utensils', slug: 'pitsa-qutilari', productCount: 0, isActive: true },
            { id: 'sub-1-7', name: { uz: 'Oyoq kiyim qutilari', ru: 'Обувные', en: 'Shoe Boxes' }, icon: 'Footprints', slug: 'oyoq-kiyim-qutilari', productCount: 0, isActive: true }
        ]
    },
    {
        id: 'cat-2',
        name: { uz: 'Kuryer Paketlari', ru: 'Курьерские пакеты', en: 'Courier Bags' },
        icon: 'ShoppingBag',
        slug: 'kuryer-paketlari',
        productCount: 0,
        isActive: true,
        children: [
            { id: 'sub-2-1', name: { uz: 'Hujjatsiz', ru: 'Без кармана', en: 'Without Pocket' }, icon: 'Square', slug: 'kuryer-hujjatsiz', productCount: 0, isActive: true },
            { id: 'sub-2-2', name: { uz: 'Hujjat cho\'ntagi bilan', ru: 'С карманом', en: 'With Pocket' }, icon: 'FileText', slug: 'kuryer-hujjatli', productCount: 0, isActive: true },
            { id: 'sub-2-3', name: { uz: 'Ekonom variant', ru: 'Эконом', en: 'Economy' }, icon: 'TrendingDown', slug: 'kuryer-ekonom', productCount: 0, isActive: true },
            { id: 'sub-2-4', name: { uz: 'Qora rangli', ru: 'Черные', en: 'Black' }, icon: 'Moon', slug: 'kuryer-qora', productCount: 0, isActive: true }
        ]
    },
    { id: 'cat-3', name: { uz: 'Rossiya Pochta Paketlari', ru: 'Пакеты Почта России', en: 'Russian Post Bags' }, icon: 'Mail', slug: 'rossiya-pochta-paketlari', productCount: 0, isActive: true },
    {
        id: 'cat-4',
        name: { uz: 'BOPP Paketlar', ru: 'БОПП пакеты', en: 'BOPP Bags' },
        icon: 'Layers',
        slug: 'bopp-paketlar',
        productCount: 0,
        isActive: true,
        children: [
            { id: 'sub-4-1', name: { uz: 'Klapan va Skotchli', ru: 'С клапаном и скотчем', en: 'With Flap & Tape' }, icon: 'StickyNote', slug: 'bopp-klapan-skotch', productCount: 0, isActive: true },
            { id: 'sub-4-2', name: { uz: 'Yevroslotli', ru: 'С еврослотом', en: 'With Euroslot' }, icon: 'Maximize', slug: 'bopp-yevroslot', productCount: 0, isActive: true },
            { id: 'sub-4-3', name: { uz: 'Klapansiz', ru: 'Без клапана', en: 'Without Flap' }, icon: 'Square', slug: 'bopp-klapansiz', productCount: 0, isActive: true },
            { id: 'sub-4-4', name: { uz: 'Perforatsiyali', ru: 'С перфорацией', en: 'Perforated' }, icon: 'GripHorizontal', slug: 'bopp-perforatsiya', productCount: 0, isActive: true }
        ]
    },
    {
        id: 'cat-5',
        name: { uz: 'Zip-Lock Paketlar', ru: 'Зип-лок пакеты', en: 'Zip-Lock Bags' },
        icon: 'Lock',
        slug: 'zip-lock-paketlar',
        productCount: 0,
        isActive: true,
        children: [
            { id: 'sub-5-1', name: { uz: 'Oddiy shaffof', ru: 'Прозрачные', en: 'Transparent' }, icon: 'Scan', slug: 'zip-lock-shaffof', productCount: 0, isActive: true },
            { id: 'sub-5-2', name: { uz: 'Qalin (Extra)', ru: 'Плотные', en: 'Extra Thick' }, icon: 'Shield', slug: 'zip-lock-qalin', productCount: 0, isActive: true },
            { id: 'sub-5-3', name: { uz: 'Slayder bilan', ru: 'С бегунком', en: 'With Slider' }, icon: 'Sliders', slug: 'zip-lock-slayder', productCount: 0, isActive: true },
            { id: 'sub-5-4', name: { uz: 'Rangli', ru: 'Цветные', en: 'Colored' }, icon: 'Palette', slug: 'zip-lock-rangli', productCount: 0, isActive: true }
        ]
    },
    { id: 'cat-6', name: { uz: 'PVD Paketlar (Marketpleys)', ru: 'ПВД пакеты', en: 'PVD Bags' }, icon: 'ShoppingBag', slug: 'pvd-paketlar', productCount: 0, isActive: true },
    { id: 'cat-7', name: { uz: 'Slayder Paketlar', ru: 'Пакеты со слайдером', en: 'Slider Bags' }, icon: 'Sliders', slug: 'slayder-paketlar', productCount: 0, isActive: true },
    { id: 'cat-8', name: { uz: 'Qadoqlash Plyonkasi', ru: 'Упаковочная пленка', en: 'Packaging Film' }, icon: 'ScrollText', slug: 'qadoqlash-plyonkasi', productCount: 0, isActive: true },
    { id: 'cat-9', name: { uz: 'Paket Payvandlagichlar', ru: 'Запайщики пакетов', en: 'Bag Sealers' }, icon: 'Zap', slug: 'paket-payvandlagichlar', productCount: 0, isActive: true },
    { id: 'cat-10', name: { uz: 'Kraft Paketlar', ru: 'Крафт пакеты', en: 'Kraft Bags' }, icon: 'ShoppingBag', slug: 'kraft-paketlar', productCount: 0, isActive: true },
    { id: 'cat-11', name: { uz: 'Doy-Pak (Doy Pack)', ru: 'Дой-пак', en: 'Doy Pack' }, icon: 'Coffee', slug: 'doy-pak', productCount: 0, isActive: true },
    { id: 'cat-12', name: { uz: 'Polietilen Paketlar', ru: 'Полиэтиленовые пакеты', en: 'Polyethylene Bags' }, icon: 'ShoppingBag', slug: 'polietilen-paketlar', productCount: 0, isActive: true },
    {
        id: 'cat-13',
        name: { uz: 'Pufakchali Plyonka', ru: 'Пузырчатая пленка', en: 'Bubble Wrap' },
        icon: 'CircleDot',
        slug: 'pufakchali-plyonka',
        productCount: 0,
        isActive: true,
        children: [
            { id: 'sub-13-1', name: { uz: '2 qavatli (D-63)', ru: 'Двухслойная (Д 63)', en: '2-Layer (D-63)' }, icon: 'Layers', slug: 'vpp-2-63', productCount: 0, isActive: true },
            { id: 'sub-13-2', name: { uz: '2 qavatli (D-75)', ru: 'Двухслойная (Д 75)', en: '2-Layer (D-75)' }, icon: 'Layers', slug: 'vpp-2-75', productCount: 0, isActive: true },
            { id: 'sub-13-3', name: { uz: '3 qavatli (T-75)', ru: 'Трехслойная (Т 75)', en: '3-Layer (T-75)' }, icon: 'Layers', slug: 'vpp-3-75', productCount: 0, isActive: true },
            { id: 'sub-13-4', name: { uz: '3 qavatli (T-90)', ru: 'Трехслойная (Т 90)', en: '3-Layer (T-90)' }, icon: 'Layers', slug: 'vpp-3-90', productCount: 0, isActive: true },
            { id: 'sub-13-5', name: { uz: 'Kraft qog\'ozli', ru: 'Крафт-бабл', en: 'Kraft Bubble' }, icon: 'FileText', slug: 'vpp-kraft', productCount: 0, isActive: true }
        ]
    },
    { id: 'cat-14', name: { uz: "Havo Yostig'i Lentasi", ru: 'Лента воздушной подушки', en: 'Air Cushion Tape' }, icon: 'Wind', slug: 'havo-yostigi-lentasi', productCount: 0, isActive: true },
    { id: 'cat-15', name: { uz: 'Havo Yostiqli Paketlar', ru: 'Пакеты с воздушной подушкой', en: 'Air Cushion Bags' }, icon: 'Wind', slug: 'havo-yostiqli-paketlar', productCount: 0, isActive: true },
    { id: 'cat-16', name: { uz: 'Qadoqlash Qog\'ozi', ru: 'Упаковочная бумага', en: 'Packaging Paper' }, icon: 'FileText', slug: 'qadoqlash-qogozi', productCount: 0, isActive: true },
    { id: 'cat-17', name: { uz: 'Qog\'oz Konvertlar', ru: 'Бумажные конверты', en: 'Paper Envelopes' }, icon: 'Mail', slug: 'qogoz-konvertlar', productCount: 0, isActive: true },
    { id: 'cat-18', name: { uz: 'Termoetiketkalar', ru: 'Термоэтикетки', en: 'Thermal Labels' }, icon: 'Tag', slug: 'termoetiketkalar', productCount: 0, isActive: true },
    {
        id: 'cat-19',
        name: { uz: 'Skotch va Yelim Lenta', ru: 'Скотч и клейкая лента', en: 'Scotch & Adhesive Tape' },
        icon: 'StickyNote',
        slug: 'skotch-yelim-lenta',
        productCount: 0,
        isActive: true,
        children: [
            { id: 'sub-19-1', name: { uz: 'Shaffof Skotch', ru: 'Прозрачный скотч', en: 'Transparent Tape' }, icon: 'Disc', slug: 'skotch-shaffof', productCount: 0, isActive: true },
            { id: 'sub-19-2', name: { uz: 'Rangi (Jigarrang)', ru: 'Коричневый скотч', en: 'Brown Tape' }, icon: 'Disc', slug: 'skotch-jigarrang', productCount: 0, isActive: true },
            { id: 'sub-19-3', name: { uz: 'Logotipli', ru: 'С логотипом', en: 'Branded Tape' }, icon: 'Stamp', slug: 'skotch-logotip', productCount: 0, isActive: true },
            { id: 'sub-19-4', name: { uz: 'Rangli', ru: 'Цветной скотч', en: 'Colored Tape' }, icon: 'Palette', slug: 'skotch-rangli', productCount: 0, isActive: true },
            { id: 'sub-19-5', name: { uz: 'Yozuvli (Aksiya va h.k.)', ru: 'С надписями', en: 'With Text' }, icon: 'Type', slug: 'skotch-yozuvli', productCount: 0, isActive: true }
        ]
    },
    {
        id: 'cat-20',
        name: { uz: 'Streich-Plyonka', ru: 'Стретч-пленка', en: 'Stretch Film' },
        icon: 'ScrollText',
        slug: 'streich-plyonka',
        productCount: 0,
        isActive: true,
        children: [
            { id: 'sub-20-1', name: { uz: 'Qo\'l uchun (Shaffof)', ru: 'Ручная (Прозрачная)', en: 'Hand Roll (Clear)' }, icon: 'Hand', slug: 'streich-qol-shaffof', productCount: 0, isActive: true },
            { id: 'sub-20-2', name: { uz: 'Qora (Qo\'l uchun)', ru: 'Черная (Ручная)', en: 'Black (Hand)' }, icon: 'Moon', slug: 'streich-qora', productCount: 0, isActive: true },
            { id: 'sub-20-3', name: { uz: 'Mashina uchun', ru: 'Машинная', en: 'Machine Roll' }, icon: 'Cog', slug: 'streich-mashina', productCount: 0, isActive: true },
            { id: 'sub-20-4', name: { uz: 'Birlamchi (Pervichka)', ru: 'Первичная', en: 'Primary (Virgin)' }, icon: 'Sparkles', slug: 'streich-pervichka', productCount: 0, isActive: true },
            { id: 'sub-20-5', name: { uz: 'Ikkilamchi (Vtorichka)', ru: 'Вторичная', en: 'Secondary (Recycled)' }, icon: 'Recycle', slug: 'streich-vtorichka', productCount: 0, isActive: true }
        ]
    },
    { id: 'cat-21', name: { uz: 'To\'ldiruvchilar', ru: 'Наполнители', en: 'Fillers' }, icon: 'PackageOpen', slug: 'toldiruvchilar', productCount: 0, isActive: true },
    { id: 'cat-22', name: { uz: 'Karton Tubuslar', ru: 'Картонные тубусы', en: 'Cardboard Tubes' }, icon: 'Cylinder', slug: 'karton-tubuslar', productCount: 0, isActive: true },
    { id: 'cat-23', name: { uz: 'Gofrokarton', ru: 'Гофрокартон', en: 'Corrugated Cardboard' }, icon: 'LayoutGrid', slug: 'gofrokarton', productCount: 0, isActive: true },
    { id: 'cat-24', name: { uz: 'Himoya Profili', ru: 'Защитный профиль', en: 'Protective Profile' }, icon: 'Shield', slug: 'himoya-profili', productCount: 0, isActive: true },
    { id: 'cat-25', name: { uz: 'Plastik Qutilar', ru: 'Пластиковые ящики', en: 'Plastic Boxes' }, icon: 'BoxSelect', slug: 'plastik-qutilar', productCount: 0, isActive: true },
    { id: 'cat-26', name: { uz: 'Ko\'pikli Polietilen', ru: 'Вспененный полиэтилен', en: 'Foam Polyethylene' }, icon: 'Layers', slug: 'kopikli-polietilen', productCount: 0, isActive: true },
    { id: 'cat-27', name: { uz: 'Ko\'pikli PE Paketlar', ru: 'Пакеты из вспененного ПЭ', en: 'PE Foam Bags' }, icon: 'ShoppingBag', slug: 'kopikli-pe-paketlar', productCount: 0, isActive: true },
    { id: 'cat-28', name: { uz: 'Yelimli Cho\'ntaklar', ru: 'Самоклеящиеся карманы', en: 'Adhesive Pockets' }, icon: 'Square', slug: 'yelimli-chontaklar', productCount: 0, isActive: true },
    { id: 'cat-29', name: { uz: 'Do\'konlar uchun mollar', ru: 'Товары для магазинов', en: 'Goods for Shops' }, icon: 'Store', slug: 'dokonlar-uchun-mollar', productCount: 0, isActive: true },
    { id: 'cat-30', name: { uz: 'Vakuum Paketlar', ru: 'Вакуумные пакеты', en: 'Vacuum Bags' }, icon: 'Minimize2', slug: 'vakuum-paketlar', productCount: 0, isActive: true },
    { id: 'cat-31', name: { uz: 'Termo-qisqaruvchi Plyonka', ru: 'Термоусадочная пленка', en: 'Shrink Film' }, icon: 'Minimize', slug: 'termo-qisqaruvchi-plyonka', productCount: 0, isActive: true },
    { id: 'cat-32', name: { uz: 'PP Qoplar', ru: 'ПП мешки', en: 'PP Bags' }, icon: 'ShoppingBag', slug: 'pp-qoplar', productCount: 0, isActive: true },
    { id: 'cat-33', name: { uz: 'PP Lenta (Tasma)', ru: 'ПП лента', en: 'PP Tape' }, icon: 'Minus', slug: 'pp-lenta', productCount: 0, isActive: true },
    { id: 'cat-34', name: { uz: 'Termo Paketlar (Sumka)', ru: 'Термопакеты', en: 'Thermal Bags' }, icon: 'Thermometer', slug: 'termo-paketlar', productCount: 0, isActive: true },
    { id: 'cat-35', name: { uz: 'Iplar va Arqonlar', ru: 'Нитки и веревки', en: 'Threads and Ropes' }, icon: 'Anchor', slug: 'iplar-arqonlar', productCount: 0, isActive: true },
    { id: 'cat-36', name: { uz: 'Plombalar', ru: 'Пломбы', en: 'Seals' }, icon: 'Lock', slug: 'plombalar', productCount: 0, isActive: true },
    { id: 'cat-37', name: { uz: 'Kanselyariya', ru: 'Канцелярия', en: 'Stationery' }, icon: 'PenTool', slug: 'kanselyariya', productCount: 0, isActive: true },
    { id: 'cat-38', name: { uz: 'PET Bankalar', ru: 'ПЭТ банки', en: 'PET Cans' }, icon: 'Cylinder', slug: 'pet-bankalar', productCount: 0, isActive: true },
    { id: 'cat-39', name: { uz: 'Himoya Vositalari', ru: 'Средства защиты', en: 'Protective Equipment' }, icon: 'ShieldCheck', slug: 'himoya-vositalari', productCount: 0, isActive: true },
    { id: 'cat-40', name: { uz: 'Palletlar', ru: 'Паллеты', en: 'Pallets' }, icon: 'Pallet', slug: 'palletlar', productCount: 0, isActive: true },
    { id: 'cat-41', name: { uz: 'Qutilar uchun To\'ldiruvchilar', ru: 'Наполнители для коробок', en: 'Box Fillers' }, icon: 'PackageOpen', slug: 'qutilar-uchun-toldiruvchilar', productCount: 0, isActive: true },
    { id: 'cat-42', name: { uz: 'Gofrokoroblar', ru: 'Гофрокороба', en: 'Corrugated Boxes' }, icon: 'Box', slug: 'gofrokoroblar', productCount: 0, isActive: true },
    { id: 'cat-43', name: { uz: 'Arxiv Qutilari', ru: 'Архивные коробки', en: 'Archive Boxes' }, icon: 'Archive', slug: 'arxiv-qutilari', productCount: 0, isActive: true },
    { id: 'cat-44', name: { uz: 'Oziq-ovqat Konteynerlari', ru: 'Пищевые контейнеры', en: 'Food Containers' }, icon: 'Utensils', slug: 'oziq-ovqat-konteynerlari', productCount: 0, isActive: true },
    { id: 'cat-45', name: { uz: 'Stretch Plyonka (Qora)', ru: 'Стретч-пленка (черная)', en: 'Stretch Film (Black)' }, icon: 'ScrollText', slug: 'stretch-plyonka-qora', productCount: 0, isActive: true },
    { id: 'cat-46', name: { uz: 'Stretch Plyonka (Rangli)', ru: 'Стретч-пленка (цветная)', en: 'Stretch Film (Colored)' }, icon: 'ScrollText', slug: 'stretch-plyonka-rangli', productCount: 0, isActive: true },
    { id: 'cat-47', name: { uz: 'Polipropilen Qoplar', ru: 'Полипропиленовые мешки', en: 'Polypropylene Bags' }, icon: 'ShoppingBag', slug: 'polipropilen-qoplar', productCount: 0, isActive: true },
    { id: 'cat-48', name: { uz: 'Qurilish Qoplari', ru: 'Строительные мешки', en: 'Construction Bags' }, icon: 'HardHat', slug: 'qurilish-qoplari', productCount: 0, isActive: true },
    { id: 'cat-49', name: { uz: 'Chiqindi Paketlari', ru: 'Мешки для мусора', en: 'Garbage Bags' }, icon: 'Trash2', slug: 'chiqindi-paketlari', productCount: 0, isActive: true },
    { id: 'cat-50', name: { uz: 'Tibbiyot Paketlari', ru: 'Медицинские пакеты', en: 'Medical Bags' }, icon: 'Stethoscope', slug: 'tibbiyot-paketlari', productCount: 0, isActive: true },
    { id: 'cat-51', name: { uz: 'Non Paketlari', ru: 'Пакеты для хлеба', en: 'Bread Bags' }, icon: 'Croissant', slug: 'non-paketlari', productCount: 0, isActive: true },
    { id: 'cat-52', name: { uz: 'Kiyim G\'iloflari', ru: 'Чехлы для одежды', en: 'Garment Covers' }, icon: 'Shirt', slug: 'kiyim-giloflari', productCount: 0, isActive: true },
    { id: 'cat-53', name: { uz: 'Vakuum Plyonka', ru: 'Вакуумная пленка', en: 'Vacuum Film' }, icon: 'Minimize2', slug: 'vakuum-plyonka', productCount: 0, isActive: true },
    { id: 'cat-54', name: { uz: 'Pishiriq Qog\'ozi', ru: 'Бумага для выпечки', en: 'Baking Paper' }, icon: 'ChefHat', slug: 'pishiriq-qogozi', productCount: 0, isActive: true },
    { id: 'cat-55', name: { uz: 'Pergament Qog\'oz', ru: 'Пергаментная бумага', en: 'Parchment Paper' }, icon: 'FileText', slug: 'pergament-qogoz', productCount: 0, isActive: true },
    { id: 'cat-56', name: { uz: 'Ofis Qog\'ozi', ru: 'Офисная бумага', en: 'Office Paper' }, icon: 'File', slug: 'ofis-qogozi', productCount: 0, isActive: true },
    { id: 'cat-57', name: { uz: 'Chek Lentasi', ru: 'Чековая лента', en: 'Receipt Tape' }, icon: 'Receipt', slug: 'chek-lentasi', productCount: 0, isActive: true },
    { id: 'cat-58', name: { uz: 'Termo Etiketka (ECO)', ru: 'Термоэтикетки ЭКО', en: 'Thermal Labels (ECO)' }, icon: 'Tag', slug: 'termo-etiketka-eco', productCount: 0, isActive: true },
    { id: 'cat-59', name: { uz: 'Termo Etiketka (TOP)', ru: 'Термоэтикетки ТОП', en: 'Thermal Labels (TOP)' }, icon: 'Tag', slug: 'termo-etiketka-top', productCount: 0, isActive: true },
    { id: 'cat-60', name: { uz: 'Ribbonlar', ru: 'Риббоны', en: 'Ribbons' }, icon: 'Printer', slug: 'ribbonlar', productCount: 0, isActive: true }
];
