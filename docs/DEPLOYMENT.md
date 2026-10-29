# Current release: no-domain, no-email registration

Production **READY**: https://mirror-x-three.vercel.app/account . Deployment `dpl_AYyzoFKjuexNx2c9dEVYSKNYdP7F`, source `8c5e6598e6157a3b82b292f00a95350776245265`.

Default signup is handle + password with a one-time recovery key. No SMTP, custom domain, real email, telephone or Vercel account is needed. Existing email Auth settings remain unchanged. The historical SMTP setup paragraphs below apply only to the optional email flow and do not block default registration.

Evidence: HANDLE_ACCOUNTS.md, HANDLE_VERIFICATION.json, HANDLE_PRODUCTION_SMOKE.json. 78 unit/Postgres tests, 12 standard browser scenarios, configured UI signup/recovery checks and 12 actual remote Auth/API/DB checks passed. New Edge function keeps gateway JWT verification enabled. QA users and their cloud rows were removed. Production QA route:404; account:200; health:200/CONNECTED; registration GET:405 (POST only).

---

# Accounts / Excel / Gemini release

Source: `87d6518cb3660d219517ca9594a32b68d2ea5771`. Production deployment requested: `dpl_Et3nB8diVHa4rdswRE8zjVTwpQ8n`. Primary public alias remains https://mirror-x-three.vercel.app; it requires no Vercel registration. Protected generated deployment and preview URLs are for owner QA.

Gemini key accepted by provider; actual fixed-prompt generation returned200 with `gemini-3.5-flash-lite`. Key stored in encrypted server variables only. Sign-in is still required for the assistant; a complete authenticated production assistant conversation has not been claimed as verified. Details: GEMINI_ACTIVATION.json.

Account forms and Excel report layout are improved. Public signup/password recovery email delivery still requires operator SMTP/sender verification and redirect URL setup; these shared Supabase settings were not changed. Connected tools cannot provision that provider account or modify Auth settings. Concrete steps: ACCOUNT_AND_MAIL_SETUP.md. Guest market/Excel/local portfolio flows are working without registration.

Verification: 69 unit/Postgres tests; 12 standard browser scenarios; additional mocked Auth UI signup/password/recovery checks; independent Excel chart/formula/print-layout/priced-total checks. No actual email sent. Prior releases below are historical.

---

# Текущий визуальный релиз

- Production: https://mirror-x-three.vercel.app, **READY**.
- Рынок: https://mirror-x-three.vercel.app/market; личные графики, портфель, бизнес и Excel: https://mirror-x-three.vercel.app/workspace.
- Deployment: `dpl_5w9q182QcAg2T1Le82V2VjLpwfyQ`.
- Исполняемый source SHA: `67cc68d38602b75efd47b946ec26832a450b0d38`.
- 69 unit/PostgreSQL tests, 12 local Chromium scenarios, remote RLS/concurrency/quota proof; 3 independently parsed native Excel workbooks.
- Remote production: health/CONNECTED, market/workspace SSR, template and market XLSX:200; FINAL export:409; Gemini status configured=false.
- Workspace API fetch returned a connector-wrapped401; its actual application body could not be independently inspected with this connector. Do not count this as authenticated production HTTP CRUD verification. Local browser flows and real database-role CRUD are independently verified.
- Полные договорённости и ограничения: VISUAL_WORKSPACE.md; доказательства: VISUAL_VERIFICATION.json, VISUAL_EXCEL_VERIFICATION.json, VISUAL_PRODUCTION_SMOKE.json.
- Gemini ожидает серверные GEMINI_API_KEY и GEMINI_MODEL; live feed не подключён. Тарифы не повышались.

Ниже — предыдущие релизы; их deployment IDs и проверки сохранены как история.

---

# Текущая production-версия с Supabase

- URL: https://mirror-x-three.vercel.app
- Deployment: dpl_4BFZ3yxGVNutvWjMV3AoFsRiuxY7, READY, production.
- Проверенный source SHA: eea2c5bba3d3cb54ffccd013ec119b59059f428b.
- Supabase: edpuovkgoisyzpguksdi (Jetuu), одобренная схема mirror_x.
- /api/health:200, mode=supabase, database=CONNECTED;503 records/3 annual facts.
- /api/account:200,configured=true,user=null для гостя;private no-store.
- /api/research без входа:401.
- /api/screen?q=MSFT:200.
- XLSX/PPTX:200, один snapshot MX-3777d2e495a9.
- FINAL export:409 при текущих блокерах.
- Временный QA endpoint в production отсутствует:404.
- Защита Vercel: Standard Protection (prod_deployment_urls_and_all_previews); production domain предназначен для публичного просмотра, preview URLs защищены. Приватные исследования требуют Supabase Auth независимо от защиты Vercel.
- Тарифы не повышались. Детали, фактические проверки и ограничения: CLOUD_INTEGRATION.md, CLOUD_VERIFICATION.json, CLOUD_PRODUCTION_SMOKE.json.

Документационные коммиты после указанного source SHA не меняют исполняемый код production. Ниже сохранена история первого автономного размещения.

---

# Фактическое размещение — 29.10.2026

- GitHub: https://github.com/roadtoabroad346-commits/Freedom-Investment-Hackathon-MVP-
- Branch: `feat/mirror-x-universal`.
- Проверенный runtime/source commit: `dfcd4475be5fd4886089c19eb5ef92caeb556099`.
- Draft PR: https://github.com/roadtoabroad346-commits/Freedom-Investment-Hackathon-MVP-/pull/1. Не слит в main.
- Vercel project: `mirror-x`, `prj_LDKPVUewu5ApyGEtK1KLkZ1c7jRW`.
- Vercel team: `team_Hg7QYVwD6HqLqLcIERR9pWP3`.
- Deployment: `dpl_8tfDzq3GnF3YDZVRRyebu2GfSYx7`, **READY**.
- URL: https://mirror-5yd8uubiq-impact-hub.vercel.app
- Alias: https://mirror-x-three.vercel.app
- Snapshot: `MX-3777d2e495a9`.

Запрошен target=preview. Vercel автоматически пометил самый первый deployment нового пустого проекта как **production**. До этой операции у проекта не было deployment и live=false; существующее приложение не перезаписывалось. Защита Vercel Authentication/SSO не отключалась. Это research preview по готовности продукта, но фактическая среда первого deployment — production. Обычное открытие URL может требовать входа владельца/разрешённого участника Vercel; публичный доступ жюри без входа не заявлен.

## Реальный remote smoke

Через авторизованный Vercel connector, без отключения защиты:

| Endpoint | Фактический ответ |
|---|---|
| `/` | 200, MIRROR HTML |
| `/company/ADBE` | 200, research HTML |
| `/valuation/ADBE` | 200, valuation HTML |
| `/api/health` | 200;503 instruments,486 financial-metric records,3 annual statements,0 dated quotes;NOT_CONNECTED database |
| `/api/screen?q=MSFT` | 200, одна реальная MSFT запись, UNDATED |
| `/downloads/manifest.json` | 200 |
| `/api/export/xlsx` | 200, правильный XLSX MIME, X-Snapshot-Id совпадает |
| `/api/export/pptx` | 200, правильный PPTX MIME, X-Snapshot-Id совпадает |
| `/api/export/xlsx?final=1` | 409, реальные блокеры возвращены |

Браузерные интерактивные сценарии проверены локально в production build; удалённый smoke — HTTP/SSR/API и загрузки через авторизованный connector. Remote Chromium/SSO-flow не проверялся. Краткое машиночитаемое подтверждение: `REMOTE_SMOKE.json`.

## Подключения и запуск

Supabase не подключён. Существующие LinguaAI/Jetuu не затронуты. Нет удалённых schema mutations и платных ресурсов. `SUPABASE_SCHEMA_CANDIDATE.sql` — не применённая миграция и не доказательство RLS.

Приложение работает без секретов: `npm ci`, `npm run build`, `npm start`. Для обновления данных — проверенный CSV через `npm run import`, затем `npm run snapshot`, `npm run exports`, `npm run check`; отдельно повторить browser/Excel proof и deploy. Имена дополнительных credential variables, если подключается SEC-провайдер позднее: `SEC_USER_AGENT`; текущий продукт не делает live SEC запросов. Supabase variables и auth не подключены и не обещаются как готовые.

Коммерческий публичный запуск требует проверки upstream data rights и актуального feed. Открытый доступ жюри настраивается отдельно владельцем после проверки содержимого. Защиту не следует отключать ради прохождения автоматического smoke.

Этот документ и REMOTE_SMOKE добавлены отдельным документационным коммитом после source commit; исполняемый код deployment соответствует указанному выше SHA.
