import { createHash } from "node:crypto";
import {
  universe,
  getModel,
  getCompany,
  annualFacts,
  provenance,
} from "./data";
import { focusResearch } from "./research";
import { dcf, allocate } from "./finance";
import { eligibility, SCORE_VERSION } from "./screening";
import type { Snapshot } from "./types";
export function buildSnapshot(): Snapshot {
  const payload = {
    universe,
    annualFacts,
    research: focusResearch,
    modelVersion: "fcff-drivers-v1",
    scoreVersion: SCORE_VERSION,
  };
  const sourceHash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  allocate(focusResearch.map((r) => r.allocationBps));
  const companies = focusResearch.map((r) => {
    const c = getCompany(r.ticker)!,
      model = getModel(r.ticker),
      out = model ? dcf(model) : null;
    const price = c.priceAsOf === null ? null : c.price;
    return {
      ticker: r.ticker,
      name: c.name,
      price,
      priceAsOf: c.priceAsOf,
      fairValue: out?.fairValue ?? null,
      target12m: out?.target12m ?? null,
      upside: price && out ? out.target12m / price - 1 : null,
      allocationBps: r.allocationBps,
      recommendation: "NOT-RATED" as const,
      reviewed: false,
      gates: eligibility(c),
    };
  });
  return {
    id: `MX-${sourceHash.slice(0, 12)}`,
    generatedAt: new Date().toISOString(),
    cutoff: "2026-10-29",
    modelVersion: "fcff-drivers-v1",
    scoreVersion: SCORE_VERSION,
    sourceHash,
    status: "PRELIMINARY",
    companies,
    blockers: [
      "До закрытия 02.11.2026 конкурсные цены ещё недоступны.",
      "Не подтверждены 3-месячная ликвидность, история торгов и доли выручки запрещённых направлений.",
      "Три основных кандидата выбраны для исследования; нет трёх аналитически подтверждённых Buy.",
      "Годовые финансовые модели требуют сверки с последними кварталами и нормализации; PayPal BNPL требует отдельной проверки.",
      "Не загружена актуальная история OHLCV: технический анализ и вход/выход не финализированы.",
      "Общий набор: котировки без даты; провайдер " + provenance.provider + ".",
    ],
  };
}
export function finalGate(s: Snapshot) {
  return {
    passed:
      s.companies.length >= 3 &&
      s.companies.every(
        (c) =>
          c.reviewed &&
          c.recommendation === "BUY" &&
          c.price !== null &&
          c.price > 0 &&
          c.priceAsOf === "2026-11-02" &&
          c.upside !== null &&
          c.upside > 0 &&
          c.gates.every((g) => g.status === "PASS"),
      ) &&
      s.companies.reduce((n, c) => n + c.allocationBps, 0) === 10000 &&
      s.blockers.length === 0,
    blockers: s.blockers,
  };
}
