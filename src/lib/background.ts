/**
 * `work`ni ko'pi bilan `ms` kutadi: ulgursa natijasini qaytaradi, ulgurmasa `undefined` qaytaradi va ish fonda oxirigacha
 * davom etadi (server uzoq yashaydigan `node server.js` jarayoni, so'rov tugagach ham bajarilaveradi).
 * Hech qachon xato tashlamaydi — `work` xatosi, kechikib kelgani ham, logga yoziladi va `undefined` qaytadi.
 * Mijoz yoki to'lov tizimi javob kutayotgan joylar uchun: Telegram sekin yoki ishlamayotgan bo'lsa ham javob kechikmaydi,
 * xabarnoma xatosi esa allaqachon saqlangan buyurtma yoki arizani "xato"ga aylantirmaydi.
 */
export async function settleWithin<T>(work: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // catch darhol ulanadi: muddatdan keyin kelgan xato ham ushlanadi (aks holda "unhandled rejection" jarayonni to'xtatishi mumkin)
  const safe = work.catch((e): undefined => {
    console.error('[background] fon ishi', e);
    return undefined;
  });
  const result = await Promise.race([safe, new Promise<undefined>((resolve) => { timer = setTimeout(() => resolve(undefined), ms); })]);
  clearTimeout(timer);
  return result;
}
