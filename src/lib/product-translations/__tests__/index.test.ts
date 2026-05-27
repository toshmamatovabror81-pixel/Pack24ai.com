import {
    translateProductText,
    translateProductName,
    translateProductDescription,
    translateSpecKey,
    translateSpecifications,
} from '../index';

describe('product-translations', () => {
    it('returns original text for uz language', () => {
        expect(translateProductText('Karton quti gofro', 'uz')).toBe('Karton quti gofro');
    });

    it('translates known terms to Russian', () => {
        expect(translateProductName('Karton quti gofro', 'ru')).toBe('картон коробка гофро');
    });

    it('translates product description', () => {
        const desc = 'Mustahkam qadoqlash paketi, ekologik materialdan';
        const result = translateProductDescription(desc, 'ru');
        expect(result).toContain('прочный');
        expect(result).toContain('упаковка');
    });

    it('translates specification keys and values', () => {
        const specs = { material: 'Karton', "o'lcham": '30x20x10 sm' };
        const translated = translateSpecifications(specs, 'ru');
        expect(translated).toEqual([
            { key: 'Материал', value: 'картон' },
            { key: 'Размер', value: '30x20x10 sm' },
        ]);
    });

    it('translates Russian spec keys to Uzbek', () => {
        const specs = [{ key: 'Вес', value: '0,5 kg' }, { key: 'Цвет', value: 'Серебристый' }];
        const translated = translateSpecifications(specs, 'uz');
        expect(translated[0].key).toBe('Vazn');
        expect(translated[1].key).toBe('Rang');
    });

    it('does not break words when replacing paket', () => {
        expect(translateProductName('Termopakety (issiqlik saqlash)', 'ru')).toBe('Termopakety (тепло хранение)');
        expect(translateProductName('Vakuum paket PA/PE', 'ru')).toBe('вакуум пакет PA/PE');
    });

    it('translates Cyrillic product name to Uzbek', () => {
        const name = 'Термопакет пищевой';
        const uz = translateProductName(name, 'uz');
        expect(uz).not.toBe(name);
        expect(uz.toLowerCase()).toContain('termopaket');
    });

    it('translates spec key via SPEC_KEY_MAP', () => {
        expect(translateSpecKey('material', 'ru')).toBe('Материал');
        expect(translateSpecKey("o'lcham", 'ru')).toBe('Размер');
    });
});
