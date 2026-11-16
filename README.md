# «До 23 июля» — семейный финансовый план

Telegram Mini App для пары: цели накоплений, план покупок и дел, месячный бюджет, календарь, расходы и меню. В браузере данные остаются локально; внутри Telegram приложение узнаёт пользователя без отдельной регистрации и синхронизирует общий семейный бюджет через Supabase.

## Локальный запуск

Самодостаточную версию можно открыть двойным кликом:

```text
economy-calc-local.html
```

Версия с Vite запускается так:

```bash
npm ci
npm run dev
```

Проверки:

```bash
npm run typecheck
npm run build
```

## Telegram Mini App и общий доступ

1. Создайте бота через `@BotFather` и сохраните токен в безопасном месте.
2. Создайте проект Supabase и выполните [`supabase/schema.sql`](supabase/schema.sql) в SQL Editor.
3. Установите Supabase CLI, выполните `supabase login`, затем свяжите проект: `supabase link --project-ref PROJECT_REF`.
4. Добавьте токен только в секрет функции: `supabase secrets set TELEGRAM_BOT_TOKEN=...`.
5. Разверните функцию: `supabase functions deploy telegram-budget`. Проверка JWT отключена только для этой функции в [`supabase/config.toml`](supabase/config.toml); вместо JWT она проверяет подпись Telegram.
6. Укажите публичный URL проекта в [`telegram-config.js`](telegram-config.js).
7. В `Settings → Pages` выберите источник `GitHub Actions` и запустите workflow `Deploy Telegram Mini App`.
8. В `@BotFather` выберите бота → `Bot Settings` → `Menu Button` и укажите выданный GitHub Pages HTTPS-адрес.

Первый пользователь создаёт семью в разделе «Настройки». Второй открывает Mini App из своего Telegram и присоединяется по шестизначному коду.

Функция проверяет криптографическую подпись Telegram `initData`; доверять переданному клиентом ID без этой проверки нельзя. Service-role key существует только в среде Supabase и не попадает во фронтенд.
