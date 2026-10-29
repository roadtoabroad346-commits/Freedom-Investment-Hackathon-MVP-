import Link from "next/link";
import {
  ArrowRight,
  Search,
  SlidersHorizontal,
  FileCheck2,
  ScanLine,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { coverage } from "@/lib/data";
import { focusResearch } from "@/lib/research";
import { Badge, ButtonLink, SectionTitle, Stat } from "@/components/ui";
export default function Home() {
  const c = coverage();
  return (
    <>
      <div className="home-intro">
        <div className="eyebrow">
          <span className="tiny-line" /> ОТ ДАННЫХ К ИНВЕСТИЦИОННОЙ ИДЕЕ
        </div>
        <span className="edition">MIRROR X / 01</span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <Badge tone="navy">ОБЪЯСНИМЫЙ EQUITY RESEARCH</Badge>
          <h1>
            Найдите идею.
            <br />
            Поймите <em>почему.</em>
            <br />
            Проверьте числа.
          </h1>
          <p>
            Компании, источники и оценка — в одном исследовании. От широкого
            списка акций к гипотезе, которую можно защитить.
          </p>
          <div className="hero-actions">
            <ButtonLink href="/explore">Начать анализ</ButtonLink>
            <ButtonLink secondary href="/about/methodology">
              Открыть методологию
            </ButtonLink>
          </div>
          <div className="hero-foot">
            <Check size={16} aria-hidden="true" /> Без регистрации{" "}
            <span>·</span> Допущения видны <span>·</span> Без обещаний
            доходности
          </div>
        </div>
        <div
          className="pipeline-visual"
          aria-label="Процесс исследования: компании, отбор, проверка гипотезы"
        >
          <div className="visual-grid" />
          <div className="visual-caption">
            <ScanLine size={18} aria-hidden="true" /> EXPLAINABLE OPPORTUNITY
            PIPELINE
          </div>
          <div className="visual-card first">
            <span className="visual-step">01 / UNIVERSE</span>
            <div>
              <div>
                <small>Загруженные компании</small>
                <strong>
                  {c.instruments}
                  <span>компании</span>
                </strong>
              </div>
              <div className="mini-bars">
                {[29, 46, 37, 67, 52, 82, 70, 93].map((h, i) => (
                  <i key={i} style={{ height: h }} />
                ))}
              </div>
            </div>
            <div className="visual-card-footer">
              Фактическое покрытие <span>↗</span>
            </div>
          </div>
          <div className="connector" />
          <div className="visual-card second">
            <div>
              <span className="icon-square">
                <SlidersHorizontal size={19} aria-hidden="true" />
              </span>
              <span>
                <b>Прозрачный отбор</b>
                <small>Факторы → объяснение → источники</small>
              </span>
              <span className="step-number">02</span>
            </div>
          </div>
          <div className="connector short" />
          <div className="visual-card third">
            <div>
              <span className="verified-icon">
                <FileCheck2 size={21} aria-hidden="true" />
              </span>
              <span>
                <b>Проверяемая гипотеза</b>
                <small>DCF · риски · сценарии</small>
              </span>
              <ArrowUpRight size={21} aria-hidden="true" />
            </div>
            <div className="evidence-line">
              <span /> Факты отдельно от предположений
            </div>
          </div>
          <div className="visual-bottom">
            Сильная идея выдерживает проверку.
          </div>
        </div>
      </section>
      <div className="stats-row">
        <Stat
          label="В импортированном universe"
          value={c.instruments}
          note="Компании из открытого набора"
        />
        <Stat
          label="Глубокие исследования"
          value="03"
          note="Adobe · PayPal · Nike"
        />
        <Stat
          label="Датированные котировки"
          value={c.datedPrices}
          note="Обновление рынка требует импорта"
        />
        <Stat
          label="Прозрачная модель"
          value="5 лет"
          note="DCF + Reverse DCF + sensitivity"
        />
      </div>
      <section className="workflow">
        <SectionTitle
          title="Одно исследование. Вся цепочка."
          aside={
            <Link className="text-link" href="/explore">
              Открыть компании <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        <div className="feature-grid">
          {[
            {
              n: "01",
              icon: Search,
              title: "Найдите кандидата",
              text: "Поиск по всему universe, отраслевые фильтры и объяснение каждого вычисленного рейтинга.",
            },
            {
              n: "02",
              icon: FileCheck2,
              title: "Проверьте аргументы",
              text: "Финансовые факты, первоисточники и контраргументы. Пропуски остаются пропусками.",
            },
            {
              n: "03",
              icon: SlidersHorizontal,
              title: "Оцените сценарии",
              text: "Изменяйте драйверы модели и смотрите, какие допущения определяют результат.",
            },
          ].map((f) => (
            <article className="feature-card" key={f.n}>
              <div>
                <f.icon size={23} aria-hidden="true" />
                <span>{f.n}</span>
              </div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle
          title="Три основных исследования"
          aside={<Badge tone="amber">Кандидаты · не подтверждённые Buy</Badge>}
        />
        <div className="focus-grid">
          {focusResearch.map((r, i) => (
            <Link
              href={`/company/${r.ticker}`}
              className="focus-card"
              key={r.ticker}
            >
              <div>
                <span className={`ticker-mark mark-${i}`}>
                  {r.ticker.slice(0, 1)}
                </span>
                <ArrowUpRight size={19} aria-hidden="true" />
              </div>
              <h3>
                {r.ticker}
                <span>{["Adobe", "PayPal", "Nike"][i]}</span>
              </h3>
              <p>{r.thesis}</p>
              <div className="focus-card-bottom">
                Открыть исследование <ArrowRight size={16} aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      </section>
      <div className="data-strip">
        <FileCheck2 size={20} aria-hidden="true" />
        <p>
          <strong>Качество данных видно сразу.</strong> Общий набор содержит
          котировки без даты. Он доступен для изучения, но не используется как
          текущая цена и не проходит конкурсную проверку.
        </p>
        <Link href="/limitations">
          Подробнее <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
