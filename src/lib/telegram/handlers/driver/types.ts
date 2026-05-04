import type { Lang } from '../../i18n';

export interface DriverSession {
    step: 'phone' | 'menu' | 'weight' | 'discount';
    lang: Lang;
    driverId?: number;
    activeRequestId?: number;
    weight?: number;
    discount?: number;
}

export const fmtN = (n: number) => n.toLocaleString('ru-RU');
