import { notFound } from "next/navigation";
import { getCompany, getModel, annualFacts } from "@/lib/data";
import { PageHead, Empty, Source } from "@/components/ui";
import { Valuation } from "@/components/valuation";
export default async function Value({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: t } = await params,
    ticker = t.toUpperCase(),
    c = getCompany(ticker);
  if (!c) notFound();
  const model = getModel(ticker),
    fact = annualFacts[ticker];
  return (
    <>
      <PageHead
        eyebrow="VALUATION STUDIO"
        title={`${ticker} · От допущений к стоимости`}
        description="Проверьте, что должно быть правдой, чтобы оценка имела смысл."
      />
      {model ? (
        <>
          <div className="valuation-source">
            <Source href={fact.sourceUrl}>
              Базовый годовой отчёт до {fact.periodEnd}
            </Source>
            <span>
              Факты: выручка, акции, cash + short-term investments и долг.
              Остальное — явные сценарии.
            </span>
          </div>
          <Valuation initial={model} ticker={ticker} />
        </>
      ) : (
        <Empty title="Для этой компании нет проверяемой FCFF-модели">
          Нужны согласованные исходные данные. Для банков, страховщиков и REIT
          необходима отраслевая модель; оценка не подставляется автоматически.
        </Empty>
      )}
    </>
  );
}
