# Архитектура

Один Next.js modular monolith. Серверные страницы читают версионированные файлы, общие чистые модули отвечают за screening / finance / imports / snapshots / exports. Для 503 записей линейное фильтрование и серверная пагинация оправданы. Это не DB-side query и не заявляется как готовая архитектура для миллионов записей.

`src/lib/data.ts` → загруженные instruments/facts; `screening.ts` → фильтры, процентили и независимая contest eligibility; `finance.ts` → DCF, reverse, sensitivity, allocation и technicals; `build-snapshot.ts` → общий snapshot и строгая проверка финализации; `exports.ts` → XLSX/PPTX; `brief.ts` → независимый экспорт любой компании.

Все страницы, JSON snapshot и конкурсные файлы используют `data/snapshot.json`. Sandbox sliders не изменяют snapshot. Экспорты создаются на build-time и отдаются готовыми: serverless не выполняет массовый ingest или генерацию больших книг при каждом запросе.

Записи пользователя хранятся в браузере с версионированным ключом. Удалённая синхронизация не имитируется. Для роста: отдельно подключить согласованный источник EOD, затем целевую БД с индексами ticker/sector/date, RLS и изоляцией workspaces. Подготовленный SQL-кандидат не применён к чужой базе.
