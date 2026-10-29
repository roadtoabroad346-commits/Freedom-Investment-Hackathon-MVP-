"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Download,
  Cloud,
  FolderOpen,
  RotateCcw,
  Trash2,
  CheckCircle2,
  ChartCandlestick,
  BriefcaseBusiness,
  FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "../auth/provider";
import {
  validateWorkspace,
  emptyWorkspace,
  type Workspace,
} from "@/lib/market/schema";
import { mergeWorkspaces } from "@/lib/market/merge";
import { Assistant } from "./assistant";
const HistoryCharts = dynamic(
  () => import("./history").then((m) => m.HistoryCharts),
  {
    ssr: false,
    loading: () => <div className="chart-loading">Загрузка графиков…</div>,
  },
);
const Portfolio = dynamic(
  () => import("./portfolio").then((m) => m.Portfolio),
  {
    ssr: false,
    loading: () => <div className="chart-loading">Загрузка портфеля…</div>,
  },
);
const Business = dynamic(() => import("./business").then((m) => m.Business), {
  ssr: false,
  loading: () => (
    <div className="chart-loading">Загрузка показателей бизнеса…</div>
  ),
});
type Preview = { workspace: Workspace; revision?: number };
export function InvestorWorkspace() {
  const { user, ready, configured } = useAuth();
  const key = ready ? `mirror-x-workspace-v1-${user?.id ?? "guest"}` : "";
  const [w, setW] = useState<Workspace>(emptyWorkspace),
    [loadedKey, setLoadedKey] = useState(""),
    [pending, setPending] = useState<Preview | null>(null),
    [undo, setUndo] = useState<Workspace | null>(null),
    [tab, setTab] = useState("charts"),
    [source, setSource] = useState(""),
    [basis, setBasis] = useState<Workspace["priceBasis"]>("unknown"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [issues, setIssues] = useState<
      { sheet: string; row: number; message: string }[]
    >([]),
    [revision, setRevision] = useState(0),
    [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scopeRef = useRef(key);
  scopeRef.current = key;
  useEffect(() => {
    if (!key) return;
    setLoadedKey("");
    setW(emptyWorkspace);
    setRevision(0);
    setUndo(null);
    setPending(null);
    setMessage("");
    setError("");
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const item = JSON.parse(raw);
        setW(validateWorkspace(item.workspace));
        setRevision(Number.isInteger(item.revision) ? item.revision : 0);
      }
    } catch {
      setError(
        "Не удалось восстановить локальные данные. Можно загрузить файл или облачную копию.",
      );
    }
    setLoadedKey(key);
  }, [key]);
  function commit(next: Workspace, nextRevision = revision) {
    if (loadedKey !== key) throw new Error("Дождитесь проверки аккаунта");
    // Persist before updating the screen; storage failures must not pretend data are saved.
    localStorage.setItem(
      key,
      JSON.stringify({ workspace: next, revision: nextRevision }),
    );
    setUndo(w);
    setW(next);
    setRevision(nextRevision);
  }
  async function importFile(file: File) {
    if (!source.trim()) {
      setError("Укажите источник котировок или портфеля перед загрузкой");
      return;
    }
    if (file.size > 4_000_000) {
      setError("Максимальный размер файла — 4 MB");
      return;
    }
    const scope = key;
    setBusy(true);
    setError("");
    setIssues([]);
    setMessage("");
    setPending(null);
    try {
      const p = new URLSearchParams({
        filename: file.name,
        source: source.trim(),
        basis,
      });
      const r = await fetch(`/api/spreadsheets/import?${p}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      const j = await r.json();
      if (scopeRef.current !== scope) return;
      if (!r.ok) {
        setIssues(j.issues ?? []);
        throw new Error(j.error);
      }
      setPending({ workspace: validateWorkspace(j.workspace) });
      setMessage("Файл проверен. Посмотрите состав и примените данные.");
    } catch (e) {
      if (scopeRef.current === scope)
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  function apply(replace: boolean) {
    if (!pending) return;
    try {
      const next = replace
        ? pending.workspace
        : mergeWorkspaces(w, pending.workspace);
      commit(next, pending.revision ?? revision);
      setPending(null);
      setMessage("Данные применены и сохранены в этом браузере");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось применить данные");
    }
  }
  async function exportFile(format: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/spreadsheets/export?format=${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(w),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `MIRROR_X_workspace.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMessage("Выгрузка подготовлена");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка выгрузки");
    } finally {
      setBusy(false);
    }
  }
  async function cloud(action: "save" | "load" | "delete") {
    const scope = key;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch(
        "/api/workspace",
        action === "load"
          ? {}
          : {
              method: action === "delete" ? "DELETE" : "POST",
              headers: { "Content-Type": "application/json" },
              ...(action === "save"
                ? { body: JSON.stringify({ workspace: w, revision }) }
                : {}),
            },
      );
      const j = await r.json();
      if (scopeRef.current !== scope) return;
      if (!r.ok) throw new Error(j.error);
      if (action === "load") {
        if (!j.item) {
          setMessage("В облаке пока нет рабочего пространства");
          return;
        }
        setPending({
          workspace: validateWorkspace(j.item.payload),
          revision: j.item.revision,
        });
        setMessage(
          "Облачная копия загружена для просмотра. Примените её кнопкой замены набора.",
        );
      } else if (action === "save") {
        localStorage.setItem(
          key,
          JSON.stringify({ workspace: w, revision: j.item.revision }),
        );
        setRevision(j.item.revision);
        setMessage("Рабочее пространство сохранено в вашем аккаунте");
      } else {
        localStorage.setItem(
          key,
          JSON.stringify({ workspace: w, revision: 0 }),
        );
        setRevision(0);
        setMessage("Облачная копия удалена. Локальная копия сохранена.");
      }
    } catch (e) {
      if (scopeRef.current === scope)
        setError(e instanceof Error ? e.message : "Ошибка облачного сервиса");
    } finally {
      setBusy(false);
    }
  }
  const loaded = Boolean(key && loadedKey === key),
    hasData = Boolean(
      w.bars.length || w.positions.length || w.financials.length,
    );
  if (!loaded)
    return (
      <div className="chart-loading" role="status">
        Восстанавливаю личное рабочее пространство…
      </div>
    );
  return (
    <>
      <div className="workspace-banner">
        <div>
          <span className="eyebrow">ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО</span>
          <h2>{w.name}</h2>
          <p>
            {w.bars.length} котировок · {w.positions.length} позиций ·{" "}
            {w.financials.length} финансовых периодов · USD
          </p>
        </div>
        <span className="badge neutral">
          {user ? "Личная копия · аккаунт" : "Личная копия · браузер"}
        </span>
      </div>
      <div
        className="workspace-tabs"
        role="group"
        aria-label="Разделы рабочего пространства"
      >
        {[
          ["charts", "Графики", ChartCandlestick],
          ["portfolio", "Портфель", BriefcaseBusiness],
          ["business", "Мой бизнес", BriefcaseBusiness],
          ["files", "Файлы и облако", FileSpreadsheet],
        ].map(([id, label, Icon]) => {
          const I = Icon as typeof ChartCandlestick;
          return (
            <button
              key={String(id)}
              onClick={() => setTab(String(id))}
              aria-pressed={tab === id}
            >
              <I size={18} aria-hidden="true" />
              {String(label)}
            </button>
          );
        })}
      </div>
      {(!hasData || tab === "files") && (
        <section className="panel import-panel">
          <div className="chart-heading">
            <div>
              <div className="eyebrow">EXCEL / CSV → ВИЗУАЛИЗАЦИЯ</div>
              <h2>Ваши данные, понятная картина</h2>
              <p>
                Загрузите котировки, позиции, отчётность своего бизнеса или
                книгу с несколькими листами. Сначала проверка и просмотр, затем
                применение.
              </p>
            </div>
            <a href="/api/spreadsheets/template" className="button secondary">
              <Download size={16} aria-hidden="true" />
              Скачать шаблон XLSX
            </a>
          </div>
          <div className="analytics-grid">
            <label>
              Источник данных
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                maxLength={300}
                placeholder="Например, выгрузка моего брокера"
              />
            </label>
            <label>
              Корректировка котировок
              <select
                value={basis}
                onChange={(e) =>
                  setBasis(e.target.value as Workspace["priceBasis"])
                }
              >
                <option value="unknown">Не указана</option>
                <option value="adjusted">
                  Скорректированы на сплиты / дивиденды
                </option>
                <option value="unadjusted">Без корректировки</option>
              </select>
            </label>
          </div>
          <div
            className={`upload-zone ${drag ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              if (!busy && loaded && e.dataTransfer.files[0])
                void importFile(e.dataTransfer.files[0]);
            }}
          >
            <Upload size={30} aria-hidden="true" />
            <h3>Перетащите таблицу сюда</h3>
            <p>XLSX или CSV · до 4 MB · 5 000 котировок · только USD</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              aria-label="Выбрать Excel или CSV"
              disabled={busy || !loaded}
              onChange={(e) => {
                if (e.target.files?.[0]) void importFile(e.target.files[0]);
              }}
            />
            <small>
              Формулы не исполняются и не импортируются. Вставьте вычисленные
              значения.
            </small>
          </div>
          <details>
            <summary>Формат таблиц и правила импорта</summary>
            <p>
              <b>Prices:</b> ticker, date, open, high, low, close, volume.
              <br />
              <b>Positions:</b> ticker, quantity, averageCost, sector.
              <br />
              <b>Financials:</b> ticker, periodEnd, revenue, operatingIncome,
              cash, debt, source.
            </p>
            <p>
              Обязательные поля котировки: ticker, date, close. Дата —
              YYYY-MM-DD. OHLC нужны вместе; объём можно оставить пустым. CSV:
              UTF-8, запятая или точка с запятой, десятичная точка (или запятая
              с разделителем «;»). Русские заголовки поддерживаются. Названия
              листов произвольные: тип определяется по заголовкам.
            </p>
            <p>
              До 30 тикеров истории и 200 длинных позиций. Повторы ticker/date,
              некорректный OHLC и будущие даты отклоняются. Один агрегированный
              лот на тикер. Короткие позиции и другие валюты пока не
              поддерживаются.
            </p>
          </details>
        </section>
      )}
      {busy && (
        <p role="status" className="notice">
          Обрабатываю данные…
        </p>
      )}
      {message && (
        <div className="workspace-message" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="notice form-error">
          {error}
        </div>
      )}
      {issues.length > 0 && (
        <div className="panel">
          <h3>Ошибки в строках</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Лист</th>
                  <th>Строка</th>
                  <th>Что исправить</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((i, n) => (
                  <tr key={n}>
                    <td>{i.sheet}</td>
                    <td>{i.row}</td>
                    <td>{i.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {pending && (
        <section
          className="panel import-preview"
          aria-label="Предпросмотр импорта"
        >
          <h2>Проверьте перед применением</h2>
          <p>
            {pending.workspace.name} · {pending.workspace.bars.length} котировок
            · {pending.workspace.positions.length} позиций ·{" "}
            {pending.workspace.financials.length} финансовых периодов ·
            источник: {pending.workspace.source}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Тикер</th>
                  <th>Дата</th>
                  <th>Close USD</th>
                </tr>
              </thead>
              <tbody>
                {pending.workspace.bars.slice(0, 5).map((b) => (
                  <tr key={b.ticker + b.date}>
                    <td>{b.ticker}</td>
                    <td>{b.date}</td>
                    <td>{b.close}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pending.workspace.positions.length > 0 && (
            <p>
              Позиции:{" "}
              {pending.workspace.positions
                .slice(0, 10)
                .map((p) => `${p.ticker} × ${p.quantity}`)
                .join(", ")}
            </p>
          )}
          <div className="toolbar">
            {pending.revision === undefined && (
              <button className="button" onClick={() => apply(false)}>
                Добавить без перезаписи
              </button>
            )}
            <button className="button secondary" onClick={() => apply(true)}>
              Заменить набор целиком
            </button>
            <button className="text-link" onClick={() => setPending(null)}>
              Отмена
            </button>
          </div>
          <small>
            Повторы при добавлении не перезаписываются: файл будет отклонён.
            После применения можно отменить последнее изменение.
          </small>
        </section>
      )}
      {hasData && (
        <div className="toolbar workspace-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => exportFile("xlsx")}
          >
            <Download size={16} aria-hidden="true" />
            {w.bars.filter((b) => b.ticker === w.bars[0]?.ticker).length >= 2 ||
            w.financials.length
              ? "Выгрузить Excel с графиком"
              : "Выгрузить Excel"}
          </button>
          <button
            className="button secondary"
            disabled={busy || !w.bars.length}
            onClick={() => exportFile("csv")}
          >
            Котировки CSV
          </button>
          <button
            className="text-link"
            disabled={!undo || busy}
            onClick={() => {
              if (undo) {
                try {
                  commit(undo);
                  setUndo(null);
                  setMessage("Последнее изменение отменено");
                } catch {
                  setError("Не удалось сохранить отмену");
                }
              }
            }}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Отменить изменение
          </button>
        </div>
      )}
      {tab === "charts" && <HistoryCharts workspace={w} />}
      {tab === "portfolio" && <Portfolio workspace={w} />}
      {tab === "business" && <Business financials={w.financials} />}
      {tab === "files" && (
        <section className="panel">
          <h2>
            <Cloud size={22} aria-hidden="true" /> Личная облачная копия
          </h2>
          <p>
            Импорт передаётся серверу для проверки, но сохраняется только после
            применения в вашем браузере. Облачное сохранение выполняется
            отдельно. Исходные файлы не хранятся.
          </p>
          <div className="toolbar">
            <button
              className="button"
              disabled={!user || !configured || busy || !hasData}
              onClick={() => cloud("save")}
            >
              <Cloud size={16} aria-hidden="true" />
              Сохранить в облако
            </button>
            <button
              className="button secondary"
              disabled={!user || !configured || busy}
              onClick={() => cloud("load")}
            >
              <FolderOpen size={16} aria-hidden="true" />
              Загрузить из облака
            </button>
            <button
              className="text-link"
              disabled={!user || !configured || busy || revision === 0}
              onClick={() => cloud("delete")}
            >
              <Trash2 size={16} aria-hidden="true" />
              Удалить облачную копию
            </button>
          </div>
          {!user && (
            <p>
              <Link href="/account" className="text-link">
                Войдите для сохранения между устройствами
              </Link>
              . Гостевая копия остаётся в этом браузере.
            </p>
          )}
          <div className="toolbar">
            <button
              className="text-link"
              disabled={busy || !hasData}
              onClick={() => {
                try {
                  commit({
                    ...emptyWorkspace,
                    bars: [],
                    positions: [],
                    financials: [],
                  });
                  setMessage(
                    "Локальный набор очищен. Можно отменить изменение; облачная копия сохранена.",
                  );
                } catch {
                  setError("Не удалось очистить локальные данные");
                }
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
              Очистить локальный набор
            </button>
          </div>
          <small>
            Один набор на аккаунт · до 2 MB. Конфликт версий не перезапишет
            облако. Локальные копии разделены по аккаунтам; экспортируйте данные
            перед работой на общем компьютере.
          </small>
        </section>
      )}
      <Assistant workspace={hasData ? w : undefined} />
    </>
  );
}
