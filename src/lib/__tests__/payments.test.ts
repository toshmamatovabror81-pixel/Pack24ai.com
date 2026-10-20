import { afterEach, describe, expect, it } from 'vitest';
import { paymeAuthorized, paymeUrl } from '../payments/payme';
import { clickSignature, clickSignatureValid, type ClickParams } from '../payments/click';

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe('Payme', () => {
  it('kalit bo\'lmasa hech qanday so\'rov qabul qilinmaydi', () => {
    delete process.env.PAYME_SECRET_KEY;
    const header = `Basic ${Buffer.from('Paycom:').toString('base64')}`;
    expect(paymeAuthorized(header)).toBe(false);
  });

  it('to\'g\'ri va noto\'g\'ri kalit', () => {
    process.env.PAYME_SECRET_KEY = 'k3y:with:colons';
    expect(paymeAuthorized(`Basic ${Buffer.from('Paycom:k3y:with:colons').toString('base64')}`)).toBe(true);
    expect(paymeAuthorized(`Basic ${Buffer.from('Paycom:wrong').toString('base64')}`)).toBe(false);
    expect(paymeAuthorized(`Basic ${Buffer.from('Other:k3y:with:colons').toString('base64')}`)).toBe(false);
    expect(paymeAuthorized(null)).toBe(false);
  });

  it('checkout havolasida summa tiyinda', () => {
    process.env.PAYME_MERCHANT_ID = 'm1';
    const url = paymeUrl(42, 1500.5, 'https://pack24.uz/uz/orders/tok');
    const decoded = Buffer.from(url.split('/').pop()!, 'base64').toString();
    expect(decoded).toBe('m=m1;ac.order_id=42;a=150050;c=https://pack24.uz/uz/orders/tok');
  });
});

describe('Click', () => {
  const base: ClickParams = {
    click_trans_id: '111', service_id: 's1', merchant_trans_id: '42', amount: '1500.00', action: '0', error: '0', sign_time: '2026-10-08 10:00:00', sign_string: '',
  };

  it('imzo tekshiruvi', () => {
    process.env.CLICK_SECRET_KEY = 'secret';
    process.env.CLICK_SERVICE_ID = 's1';
    const p = { ...base, sign_string: clickSignature(base, 'secret') };
    expect(clickSignatureValid(p)).toBe(true);
    expect(clickSignatureValid({ ...p, amount: '1.00' })).toBe(false);
    expect(clickSignatureValid({ ...p, service_id: 's2', sign_string: clickSignature({ ...base, service_id: 's2' }, 'secret') })).toBe(false);
  });

  it('bo\'sh kalit bilan imzo soxtalashtirib bo\'lmaydi', () => {
    process.env.CLICK_SECRET_KEY = '';
    process.env.CLICK_SERVICE_ID = 's1';
    expect(clickSignatureValid({ ...base, sign_string: clickSignature(base, '') })).toBe(false);
  });

  it('COMPLETE imzosiga merchant_prepare_id kiradi', () => {
    const complete = { ...base, action: '1', merchant_prepare_id: '42' };
    expect(clickSignature(complete, 'k')).not.toBe(clickSignature({ ...complete, merchant_prepare_id: '43' }, 'k'));
  });
});
