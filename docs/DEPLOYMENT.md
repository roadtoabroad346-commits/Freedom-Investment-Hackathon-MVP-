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
