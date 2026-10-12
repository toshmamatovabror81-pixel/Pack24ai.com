-- Mijoz botining haqiqiy nomi @Pack24SI_bot (ko'rinadigan nomi "@Pack24AI_bot", shuning uchun adashtirilgan). Sozlamalarda
-- eski nom saqlangan bo'lsa to'g'rilanadi: saytdagi Telegram tugmalari begona botga (@Pack24AI_bot boshqa odamniki) olib borardi.
-- Admin boshqa nom kiritgan bo'lsa tegilmaydi.
UPDATE "SiteSetting" SET "value" = jsonb_set("value"::jsonb, '{telegramBot}', '"Pack24SI_bot"')
  WHERE "key" = 'site' AND "value"::jsonb ->> 'telegramBot' = 'Pack24AI_bot';
