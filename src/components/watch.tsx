"use client";
import { useEffect, useState } from "react";
import { Bookmark, Check, Trash2, Download } from "lucide-react";
import Link from "next/link";
const key = "mirror-x-watchlist-v1";
type Entry = { ticker: string; note: string; addedAt: string };
function load(): Entry[] {
  try {
    const x = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(x)
      ? x.filter(
          (c) =>
            c &&
            typeof c.ticker === "string" &&
            typeof c.note === "string" &&
            typeof c.addedAt === "string",
        )
      : [];
  } catch {
    return [];
  }
}
export function WatchButton({ ticker }: { ticker: string }) {
  const [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  useEffect(() => setSaved(load().some((c) => c.ticker === ticker)), [ticker]);
  function toggle() {
    try {
      let x = load();
      x = saved
        ? x.filter((c) => c.ticker !== ticker)
        : [...x, { ticker, note: "", addedAt: new Date().toISOString() }];
      localStorage.setItem(key, JSON.stringify(x));
      setSaved(!saved);
      setError("");
    } catch {
      setError("Браузер запретил сохранение");
    }
  }
  return (
    <div>
      <button
        className="button secondary"
        onClick={toggle}
        aria-pressed={saved}
      >
        {saved ? (
          <Check size={17} aria-hidden="true" />
        ) : (
          <Bookmark size={17} aria-hidden="true" />
        )}
        {saved ? "Сохранено локально" : "В мои исследования"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function Watchlist() {
  const [entries, setEntries] = useState<Entry[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setEntries(load());
    setReady(true);
  }, []);
  function update(next: Entry[]) {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setEntries(next);
      setError("");
    } catch {
      setError("Не удалось сохранить: проверьте настройки браузера");
    }
  }
  function backup() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "MIRROR_X_watchlist.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  if (!ready) return <p role="status">Загружаю локальные исследования…</p>;
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {!entries.length ? (
        <div className="empty">
          <Bookmark size={30} aria-hidden="true" />
          <h2>Ваш следующий аргумент начинается здесь</h2>
          <p>
            Откройте любую компанию и сохраните её для исследования. Список
            хранится только в этом браузере.
          </p>
          <Link href="/explore" className="button">
            Найти компанию
          </Link>
        </div>
      ) : (
        <>
          <div className="section-title">
            <h2>Сохранено: {entries.length}</h2>
            <button className="button secondary" onClick={backup}>
              <Download size={16} aria-hidden="true" />
              Скачать резервную копию
            </button>
          </div>
          <div className="watch-grid">
            {entries.map((c) => (
              <article className="panel" key={c.ticker}>
                <div className="section-title">
                  <Link href={`/company/${c.ticker}`}>
                    <h2>{c.ticker}</h2>
                  </Link>
                  <button
                    className="icon-button"
                    aria-label={`Удалить ${c.ticker}`}
                    onClick={() =>
                      update(entries.filter((x) => x.ticker !== c.ticker))
                    }
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
                <p className="muted">
                  Добавлено{" "}
                  {new Date(c.addedAt).toLocaleDateString("ru-RU", {
                    timeZone: "Asia/Qyzylorda",
                  })}
                </p>
                <label className="note-label">
                  Мой тезис и заметки
                  <textarea
                    maxLength={6000}
                    value={c.note}
                    placeholder="Что я хочу проверить?"
                    onChange={(e) =>
                      update(
                        entries.map((x) =>
                          x.ticker === c.ticker
                            ? { ...x, note: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                </label>
                <a
                  href={`/api/company/${c.ticker}/brief`}
                  className="text-link"
                >
                  Скачать research brief{" "}
                  <Download size={16} aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
