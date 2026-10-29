import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Badge } from "@/components/ui";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "MIRROR X — инвестиционные исследования",
    template: "%s · MIRROR X",
  },
  description:
    "Универсальный скринер акций, проверяемые источники и прозрачные сценарии оценки.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <a className="skip" href="#main">
          Перейти к содержимому
        </a>
        <Nav />
        <div className="app">
          <header className="topbar">
            <div>
              <span className="topbar-dot" />
              Исследовательский терминал{" "}
              <span className="topbar-separator">/</span>
              <span className="muted">Ваши идеи. Проверяемые числа.</span>
            </div>
            <div className="topbar-right">
              <Badge tone="neutral">PREVIEW</Badge>
              <span>29 октября 2026</span>
              <span className="avatar" aria-label="Локальный профиль">
                MX
              </span>
            </div>
          </header>
          <main id="main">{children}</main>
          <footer>
            <span>
              Исследование помогает принять решение. Доходность не
              гарантирована.
            </span>
            <div>
              <Link href="/privacy">Приватность</Link>
              <Link href="/limitations">Ограничения</Link>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
