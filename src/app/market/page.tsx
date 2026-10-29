import type { Metadata } from "next";
import { getDataset } from "@/lib/repository";
import { PageHead, ButtonLink, Stat, Notice } from "@/components/ui";
import { MarketOverview } from "@/components/market/overview";
import { Assistant } from "@/components/market/assistant";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Визуальный обзор рынка" };
export default async function Market() {
  const { universe, coverage } = await getDataset();
  const c = coverage();
  return (
    <>
      <PageHead
        eyebrow="MARKET INTELLIGENCE"
        title="Рынок в одной картине"
        description="От структуры секторов до конкретной компании. Интерактивные графики помогают увидеть масштаб, оценку и пробелы в данных."
        action={
          <ButtonLink href="/workspace">Мои графики и портфель</ButtonLink>
        }
      />
      <Notice>
        Это визуализация импортированного финансового набора, UNDATED: дата цен
        и мультипликаторов не подтверждена. Для истории торгов и портфеля
        загрузите собственные датированные котировки. Терминал не исполняет
        биржевые сделки.
      </Notice>
      <div className="stats-row">
        <Stat
          label="Инструментов в наборе"
          value={c.instruments}
          note="Поддерживаются произвольные тикеры из базы"
        />
        <Stat
          label="Отраслевых групп"
          value={new Set(universe.map((c) => c.sector)).size}
          note="Структура импортированного набора"
        />
        <Stat
          label="Финансовые метрики"
          value={c.financialMetrics}
          note="Есть P/E и/или EBITDA"
        />
        <Stat
          label="Датированные цены"
          value={c.datedPrices}
          note="История доступна через личный импорт"
        />
      </div>
      <div className="toolbar">
        <a className="button secondary" href="/api/spreadsheets/export">
          Скачать обзор рынка в Excel
        </a>
        <span className="muted">
          503 компании, отраслевые группы, источники и график · UNDATED
        </span>
      </div>
      <MarketOverview universe={universe} />
      <Assistant />
    </>
  );
}
