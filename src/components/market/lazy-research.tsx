"use client";
import dynamic from "next/dynamic";
const loading = () => (
  <div className="chart-loading">Загрузка визуализации…</div>
);
export const FundamentalCharts = dynamic(
  () => import("./research-charts").then((m) => m.FundamentalCharts),
  { ssr: false, loading },
);
export const DcfCharts = dynamic(
  () => import("./research-charts").then((m) => m.DcfCharts),
  { ssr: false, loading },
);
export const ComparisonChart = dynamic(
  () => import("./research-charts").then((m) => m.ComparisonChart),
  { ssr: false, loading },
);
