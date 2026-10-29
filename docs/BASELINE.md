# Baseline — 29.10.2026

В выбранном workspace найден пустой Git-репозиторий Freedom-Investment-Hackathon-MVP- без коммитов и файлов. Существующий код MIRROR не предоставлен. Обнаружен отдельный пустой Vercel project `mirror-x`, id `prj_LDKPVUewu5ApyGEtK1KLkZ1c7jRW`, team `team_Hg7QYVwD6HqLqLcIERR9pWP3`, live=false.

Supabase: найдены только LinguaAI и Jetuu. Они не относятся к задаче и не изменялись. Новый платный проект не создавался. Выбран работающий автономный режим из ТЗ.

Политика сети исполнителя ограничивает произвольные HTTP-домены. Источники и документация изучались через подключённый web tool; исходный открытый CSV получен с разрешённого raw.githubusercontent.com. Нет market-data identity, SEC identifying User-Agent или лицензированного датированного EOD feed.

Критические риски: неизвестная дата общего финансового набора; отсутствие OHLCV; будущая конкурсная цена; непроверенная eligibility. Эти ограничения видны в продукте и gate, а не скрыты в документации.
