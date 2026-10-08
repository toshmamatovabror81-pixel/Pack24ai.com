import { describe, expect, it } from 'vitest';
import { canTransition, REQUEST_STATUSES, TRANSITIONS, volumeSizeFromKg } from '../recycling/statuses';
import { haversineKm, isValidLat, isValidLng, nearestPoint, yandexMapsUrl } from '../recycling/geo';

describe('makulatura holatlari', () => {
  it("o'tish jadvali: har bir holat ro'yxatda", () => {
    for (const s of REQUEST_STATUSES) expect(Array.isArray(TRANSITIONS[s])).toBe(true);
    for (const s of REQUEST_STATUSES) for (const t of TRANSITIONS[s]) expect(REQUEST_STATUSES).toContain(t);
  });
  it('asosiy oqim ruxsat etilgan, teskari yurish taqiqlangan', () => {
    expect(canTransition('new_', 'dispatched')).toBe(true);
    expect(canTransition('dispatched', 'assigned')).toBe(true);
    expect(canTransition('assigned', 'en_route')).toBe(true);
    expect(canTransition('en_route', 'arrived')).toBe(true);
    expect(canTransition('arrived', 'collected')).toBe(true);
    expect(canTransition('collected', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'completed')).toBe(true);
    expect(canTransition('completed', 'new_')).toBe(false);
    expect(canTransition('cancelled', 'dispatched')).toBe(false);
    expect(canTransition('collected', 'en_route')).toBe(false);
  });
  it('haydovchi rad etsa ariza masulga qaytadi, mijoz inkor qilsa disputed', () => {
    expect(canTransition('assigned', 'dispatched')).toBe(true);
    expect(canTransition('collected', 'disputed')).toBe(true);
    expect(canTransition('disputed', 'collected')).toBe(true);
    expect(canTransition('disputed', 'completed')).toBe(true);
  });
  it('hajm toifasi', () => {
    expect(volumeSizeFromKg(10)).toBe('small');
    expect(volumeSizeFromKg(150)).toBe('medium');
    expect(volumeSizeFromKg(1000)).toBe('large');
    expect(volumeSizeFromKg(null)).toBeNull();
  });
});

describe('geo', () => {
  it('masofa va eng yaqin punkt', () => {
    const tashkent = { lat: 41.311081, lng: 69.240562 };
    const samarkand = { lat: 39.654, lng: 66.959 };
    expect(Math.round(haversineKm(tashkent.lat, tashkent.lng, samarkand.lat, samarkand.lng))).toBeGreaterThan(250);
    const near = nearestPoint([{ id: 1, ...samarkand }, { id: 2, ...tashkent }, { id: 3, lat: null, lng: null }], 41.3, 69.25);
    expect(near?.point.id).toBe(2);
    expect(near!.km).toBeLessThan(2);
  });
  it('koordinata tekshiruvi', () => {
    expect(isValidLat(0)).toBe(false);
    expect(isValidLat(41.3)).toBe(true);
    expect(isValidLng(181)).toBe(false);
    expect(yandexMapsUrl(41.3, 69.2)).toContain('pt=69.200000,41.300000');
  });
});
