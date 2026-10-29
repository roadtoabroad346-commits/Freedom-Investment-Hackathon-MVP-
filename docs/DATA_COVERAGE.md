# Покрытие и первоисточники

Дата работы/импорта: 29.10.2026. Не путать с датой рыночных значений.

| Данные | Фактически |
|---|---:|
| Уникальные instruments | 503 |
| P/E и/или EBITDA | См. `/api/health` — вычисляется из файла |
| Годовые отчётные модели | 3 |
| Датированные market close | 0 |
| Подтверждённые Buy | 0 |
| Полная eligibility PASS | 0 |

Общий набор: https://github.com/datasets/s-and-p-500-companies-financials, `main/data/constituents-financials.csv`. Публикатор заявляет ODC-PDDL-1.0; upstream Yahoo Finance. Исходный CSV, URL, SHA256 и ограничения сохранены в `data/`. Для коммерческого публичного feed потребуется отдельная проверка upstream-прав. Записи не подтверждают текущий активный exchange/instrument status. Нет OHLCV, даты котировки, истории листинга, liquidity или сегментной доли запрещённых отраслей.

Годовые отчётные входы — USD millions:

| Компания | Период | Выручка | Operating income | Diluted shares, млн | Источник |
|---|---|---:|---:|---:|---|
| Adobe | FY2025, 28.11.2025 | 23769 | 8706 | 427 | [10-K](https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/adbe-2025-annual-report.pdf), statements pp.47–48 |
| PayPal | FY2025, 31.12.2025 | 33172 | 6065 | 968 | [10-K](https://www.sec.gov/Archives/edgar/data/1633917/000163391726000024/pypl-20251231.htm), statements pp.58–59 |
| Nike | FY2026, 31.05.2026 | 46398 | 3797 | 1481 | [10-K](https://investors.nike.com/sec-filings/all-sec-filings/content/0000320187-26-000088/nke-20260531.htm), income p.55 |

Nike operating income = gross profit − selling and administrative expenses. Это операционная прибыль из соответствующих строк, она отличается от EBIT-определения эмитента с включением прочих неоперационных статей. Не называем её скорректированной EBIT компании.

Предыдущие годы используются только из тех же опубликованных сравнительных таблиц. Показатели не TTM, новые кварталы не слиты автоматически. [Q3 Adobe FY2026](https://news.adobe.com/news/2026/09/adobe-q3fy26-financial-results) существует, но не загружен в модель; годовая база не заявлена как последняя.

Факт FOMC 28.10.2026: диапазон 3,75–4,00% оставлен без изменения. [Официальное заявление](https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm). Остальные числа макрофона из конкурсного PDF — сценарные ориентиры, не выдуманный независимый live feed.
