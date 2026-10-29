## Registration without domain or email

Open https://mirror-x-three.vercel.app/account and choose a handle and password. Save the one-time recovery key before entering your workspace. No SMTP, purchased domain or Vercel account is needed. Existing email accounts remain available separately. Details and security model: [docs/HANDLE_ACCOUNTS.md](docs/HANDLE_ACCOUNTS.md).

# MIRROR X 2.1

Универсальный исследовательский терминал: 503 импортированные компании, поиск и фильтры, объяснимый отраслевой рейтинг, company facts, сравнение, DCF / Reverse DCF, сценарии, локальные заметки и индивидуальный research export. Freedom 2026 — отдельное пространство с тремя основными исследованиями Adobe, PayPal и Nike.

**Статус: рабочий research preview; конкурсные файлы PRELIMINARY.** Цены закрытия 02.11.2026 ещё недоступны на дату работы 29.10.2026. Нет утверждённых Buy. Котировки общего набора UNDATED. Мы не выдаём их за цены на дату импорта.

## Запуск

Требуется Node.js 24 и npm.

```sh
npm ci
npm run dev
```

Для production-сборки локально:

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npm run test:e2e` использует Chromium по `/usr/bin/chromium`; другой путь можно передать в `CHROMIUM_PATH`. `BASE_URL` позволяет прогнать тесты против уже работающего доступного сервера.

## Что открыть

- `/explore` — весь импортированный universe, без конкурсных ограничений.
- `/company/MSFT` — пример исследования вне основной тройки.
- `/company/ADBE` и `/valuation/ADBE` — факты и драйверная модель.
- `/compare?tickers=ADBE,PYPL,NKE` — произвольные 2–3 тикера.
- `/watchlist` — локальные исследования и заметки.
- `/challenge/freedom-2026`, `/jury` — конкурсный предварительный snapshot.
- `/api/health`, `/api/screen`, `/api/snapshot` — проверяемое API.

## Данные и импорт

`data/universe.json`: 503 реальные записи открытого набора datasets. У источника не указаны периоды метрик и дата котировок. `data/annual-facts.json`: введённые из официальных годовых отчётов факты по ADBE / PYPL / NKE. Денежные значения и акции в миллионах.

```sh
npm run import -- instruments data/templates/instruments.csv 2026-10-29
npm run import -- facts data/templates/facts.csv 2026-10-29
npm run import -- prices data/templates/prices.csv 2026-10-29
npm run snapshot
npm run exports
npm run check
```

Шаблоны содержат только заголовки; впишите собственный законно полученный экспорт. Источник HTTPS обязателен. Не копируйте демонстрационные числа в реальные исследования. Импорт отвергает look-ahead, отрицательные цены и дубли. Цена не превращает старую капитализацию в новую: после импорта цены капитализация сбрасывается, её нужно независимо подтвердить. Импорт не означает подтверждение лицензии или достоверности провайдера.

Новая подходящая компания получает модель после импорта согласованных annual facts. Для банков/страховщиков/REIT FCFF не навязывается. Прогнозные драйверы — изменяемые допущения, не факты отчётности.

## Экспорты

```sh
npm run snapshot
npm run exports
```

`public/downloads/` содержит 14-слайдовую PPTX и XLSX с формулами, кэшированными результатами, исходниками и проверками. Все числа экспорта связаны с `data/snapshot.json`. Экспорт `?final=1` возвращает HTTP 409, пока строгий gate не пройден. Перевод в FINAL намеренно не реализован как обходная кнопка; необходима отдельная проверенная финализация.

## Технологии и ограничения

Next.js 16.4.3, React 19.3.1, TypeScript strict, Zod, ExcelJS, PptxGenJS, Vitest, Playwright. Версии зафиксированы, lockfile включён. Все вычисления — чистые модули TypeScript; LLM и API-ключи не требуются. Массовых запросов провайдерам при открытии страниц нет.

Хранение: Supabase при настроенном подключении; локальный snapshot и localStorage доступны без облачной конфигурации. Есть личные облачные заметки, watchlist и модели. Командные роли, платёжная система и live market feed не входят в этот MVP. Документы по архитектуре, приёмке и финализации — в `docs/`.

## Независимый пересчёт Excel

`python -m pip install -r scripts/requirements-verification.txt` и `python scripts/verify-exports.py` запускают отдельный Python-движок, сравнивают числовые формулы с кэшем и сверяют PPTX/XLSX с snapshot. Результат записывается в `docs/EXPORT_VERIFICATION.json`.

## Облачная конфигурация: бесплатный режим

С разрешения владельца используется существующий Supabase project Jetuu (`edpuovkgoisyzpguksdi`), отдельная схема `mirror_x`. Новый платный проект не создан; существующие таблицы и настройки Jetuu не изменялись. Auth общий с Jetuu, пользовательские сессии на домене MIRROR X отдельные. Можно использовать существующий аккаунт или регистрацию с текущими правилами подтверждения почты. После подтверждения письма вернитесь в MIRROR X и войдите.

Vercel получает только `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Service-role не используется. Public views `mx_*` работают с security_invoker и RLS. Notes/models защищены owner policies, API проверяет действительную сессию через getUser и Origin. Частные ответы не кэшируются публично. Ограничение сохранений — 120 операций на пользователя в минуту, в самой БД.

Миграции в `supabase/migrations/` применяются только к согласованному проекту. `npm exec --package=supabase@2.122.0 -- supabase migration new <name>` создаёт новую миграцию. `npx tsx scripts/seed-sql.ts work/mirror-x-seed.json` готовит идемпотентные SQL-пакеты справочника; выполнять их можно через SQL Editor/MCP владельца. Они не изменяют личные исследования.

Без входа старые локальные записи остаются доступны. После входа кнопка «Перенести локальные записи» добавляет новые облачные записи атомарно, сохраняет локальные оригиналы и не перезаписывает облачные заметки. Для отката приложения можно убрать облачные env vars и развернуть предыдущий код; данные Supabase сохранятся. Удаление базы или схемы для отката не требуется.

## Visual market, personal charts, portfolio and business data

Open `/market` for the visual reference universe and `/workspace` for personal XLSX/CSV uploads, OHLC charts, allocation/P&L and business financial charts. Download the empty spreadsheet template from `/api/spreadsheets/template`; the UI validates and previews data before applying it. Personal Excel exports contain editable native charts and source/limitation notes. Cloud saves use owner RLS and revision checks in the approved `mirror_x` schema.

Gemini is optional and remains visibly disabled without server-only `GEMINI_API_KEY` and `GEMINI_MODEL` in Vercel. Do not place the key in browser variables or commit it. Full data contracts, privacy, limits, verification and rollback: [docs/VISUAL_WORKSPACE.md](docs/VISUAL_WORKSPACE.md).
