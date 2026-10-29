"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
export const colors = [
  "#147d55",
  "#355fba",
  "#ba6a20",
  "#7d56ac",
  "#167e8c",
  "#ac4668",
  "#64748b",
  "#8c761c",
];
export function Chart({
  children,
  label,
  height = 300,
}: {
  children: ReactNode;
  label: string;
  height?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div
      className="chart-host"
      style={{ height }}
      role="img"
      aria-label={label}
    >
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {children}
        </ResponsiveContainer>
      ) : (
        <div className="chart-loading">Загрузка визуализации…</div>
      )}
    </div>
  );
}
export function ChartPanel({
  title,
  note,
  children,
  action,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel chart-panel">
      <div className="chart-heading">
        <div>
          <h2>{title}</h2>
          {note && <p>{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
