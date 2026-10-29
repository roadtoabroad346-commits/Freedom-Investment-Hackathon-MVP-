"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers3,
  Compass,
  Bookmark,
  GitCompareArrows,
  BriefcaseBusiness,
  BookOpen,
  ArrowUpRight,
  PanelTop,
  ChartNoAxesCombined,
  ChartCandlestick,
} from "lucide-react";
const items = [
  { href: "/", label: "Обзор", icon: PanelTop },
  { href: "/market", label: "Обзор рынка", icon: ChartNoAxesCombined },
  { href: "/workspace", label: "Графики и портфель", icon: ChartCandlestick },
  { href: "/explore", label: "Компании", icon: Compass },
  { href: "/compare", label: "Сравнение", icon: GitCompareArrows },
  { href: "/watchlist", label: "Мои исследования", icon: Bookmark },
];
export function Nav() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="MIRROR X — главная">
        <span className="brand-icon">
          <Layers3 size={24} aria-hidden="true" />
        </span>
        <span>
          MIRROR<span className="brand-x"> X</span>
          <small>INVESTMENT RESEARCH</small>
        </span>
      </Link>
      <div className="nav-label">ИССЛЕДОВАНИЯ</div>
      <nav aria-label="Основная навигация">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`nav-item ${path === i.href ? "active" : ""}`}
            aria-current={path === i.href ? "page" : undefined}
          >
            <i.icon size={19} aria-hidden="true" />
            {i.label}
          </Link>
        ))}
      </nav>
      <div className="nav-label workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <Link
        href="/challenge/freedom-2026"
        className={`nav-item ${path.includes("challenge") || path === "/jury" ? "active" : ""}`}
      >
        <BriefcaseBusiness size={19} aria-hidden="true" />
        <span>
          Freedom 2026<small>Конкурс инвестиционных идей</small>
        </span>
      </Link>
      <div className="sidebar-bottom">
        <Link className="nav-item" href="/about/methodology">
          <BookOpen size={18} aria-hidden="true" />
          Как это работает
        </Link>
        <div className="pilot-box">
          <span className="mini-label">ДЛЯ ИССЛЕДОВАТЕЛЬСКИХ КОМАНД</span>
          <p>От отбора к аргументированной идее.</p>
          <Link href="/teams">
            Обсудить пилот <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="version">MIRROR X · RESEARCH PREVIEW 2.1</div>
      </div>
    </aside>
  );
}
