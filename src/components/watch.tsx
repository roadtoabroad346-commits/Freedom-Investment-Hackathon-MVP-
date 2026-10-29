"use client";
import { useEffect, useState } from "react";
import { Bookmark, Check, Trash2, Download } from "lucide-react";
import Link from "next/link";
import { useAuth } from "./auth/provider";
import { cloudResearch, cloudSave, cloudDelete } from "@/lib/cloud-client";
import { modelSchema } from "@/lib/finance";
import type { CloudResearch } from "@/lib/research-schema";
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
function LocalWatchButton({ ticker }: { ticker: string }) {
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
function LocalWatchlist() {
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

export function WatchButton({ ticker }: { ticker: string }) {
  const { user, configured, ready } = useAuth();
  if (configured && !ready)
    return (
      <button className="button secondary" disabled>
        Проверяю сохранение…
      </button>
    );
  return user && configured ? (
    <CloudWatchButton ticker={ticker} />
  ) : (
    <LocalWatchButton ticker={ticker} />
  );
}
function CloudWatchButton({ ticker }: { ticker: string }) {
  const [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void cloudResearch(ticker)
      .then((rows) => {
        if (active) setSaved(Boolean(rows[0]?.is_watchlisted));
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [ticker]);
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      if (saved) await cloudDelete(ticker);
      else await cloudSave({ operation: "watch", ticker });
      setSaved(!saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        className="button secondary"
        disabled={busy}
        aria-pressed={saved}
        onClick={toggle}
      >
        {saved ? (
          <Check size={17} aria-hidden="true" />
        ) : (
          <Bookmark size={17} aria-hidden="true" />
        )}
        {busy
          ? "Подождите…"
          : saved
            ? "Сохранено в облаке"
            : "В мои исследования"}
      </button>
      {error && (
        <p role="alert" className="warning">
          {error}
        </p>
      )}
    </div>
  );
}
export function Watchlist() {
  const { user, configured, ready } = useAuth();
  if (configured && !ready) return <p role="status">Проверяю аккаунт…</p>;
  return user && configured ? (
    <CloudWatchlist key={user.id} />
  ) : (
    <>
      <div className="notice">
        Локальные записи доступны без входа.{" "}
        <Link href="/account" className="text-link">
          Войти для облачной синхронизации
        </Link>
      </div>
      <LocalWatchlist />
    </>
  );
}
function CloudWatchlist() {
  const [entries, setEntries] = useState<CloudResearch[]>([]),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function reload() {
    const all = await cloudResearch();
    setEntries(all.filter((r) => r.is_watchlisted));
    return all;
  }
  useEffect(() => {
    let active = true;
    void cloudResearch()
      .then((rows) => {
        if (active) setEntries(rows.filter((r) => r.is_watchlisted));
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(entry: CloudResearch) {
    setBusy(entry.ticker);
    setError("");
    setMessage("");
    try {
      const updated = await cloudSave({
        operation: "note",
        ticker: entry.ticker,
        note: entry.note,
      });
      setEntries((rows) =>
        rows.map((r) => (r.ticker === entry.ticker ? updated : r)),
      );
      setMessage(entry.ticker + ": заметка сохранена в облаке");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy("");
    }
  }
  async function remove(ticker: string) {
    setBusy(ticker);
    setError("");
    try {
      await cloudDelete(ticker);
      setEntries((rows) => rows.filter((r) => r.ticker !== ticker));
      setMessage(ticker + ": исследование удалено из облака");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить");
    } finally {
      setBusy("");
    }
  }
  async function migrateLocal() {
    setBusy("import");
    setError("");
    let done = 0;
    try {
      const current = await cloudResearch(),
        seen = new Set(current.map((r) => r.ticker)),
        local = load();
      for (const entry of local) {
        if (seen.has(entry.ticker)) continue;
        let assumptions;
        const raw = localStorage.getItem("mirror-x-model-" + entry.ticker);
        if (raw) {
          try {
            const parsed = modelSchema.safeParse(JSON.parse(raw).assumptions);
            if (parsed.success) assumptions = parsed.data;
          } catch {
            /* Invalid local models remain unchanged. */
          }
        }
        await cloudSave({
          operation: "import",
          ticker: entry.ticker,
          note: entry.note,
          assumptions,
        });
        done++;
        setMessage("Перенесено: " + done);
      }
      setMessage(
        "Перенесено в облако: " +
          done +
          ". Существующие облачные записи не перезаписаны. Локальные оригиналы сохранены.",
      );
      await reload();
    } catch (e) {
      setError(
        "Перенесено " +
          done +
          ". " +
          (e instanceof Error ? e.message : "Перенос прерван") +
          ". Локальные оригиналы сохранены.",
      );
      await reload().catch(() => {});
    } finally {
      setBusy("");
    }
  }
  function backup() {
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(entries, null, 2)], {
          type: "application/json",
        }),
      );
    a.href = url;
    a.download = "MIRROR_X_cloud_research.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  if (!ready) return <p role="status">Загружаю облачные исследования…</p>;
  return (
    <>
      <div className="section-title">
        <h2>Облачных исследований: {entries.length}</h2>
        <div className="button-group">
          <button
            className="button secondary"
            disabled={Boolean(busy)}
            onClick={migrateLocal}
          >
            Перенести локальные записи
          </button>
          <button className="button secondary" onClick={backup}>
            <Download size={16} aria-hidden="true" />
            Резервная копия
          </button>
        </div>
      </div>
      <p role="status">{message}</p>
      {error && (
        <p role="alert" className="warning">
          {error}
        </p>
      )}
      {!entries.length && !error && (
        <div className="empty">
          <Bookmark size={30} aria-hidden="true" />
          <h2>Сохраните первое облачное исследование</h2>
          <p>
            Добавьте компанию из Explorer или перенесите локальные записи. Они
            останутся доступны после входа на другом устройстве.
          </p>
          <Link href="/explore" className="button">
            Найти компанию
          </Link>
        </div>
      )}
      <div className="watch-grid">
        {entries.map((c) => (
          <article className="panel" key={c.ticker}>
            <div className="section-title">
              <Link href={"/company/" + c.ticker}>
                <h2>{c.ticker}</h2>
              </Link>
              <button
                className="icon-button"
                disabled={Boolean(busy)}
                aria-label={"Удалить " + c.ticker}
                onClick={() => remove(c.ticker)}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="muted">
              Обновлено{" "}
              {new Date(c.updated_at).toLocaleString("ru-RU", {
                timeZone: "Asia/Qyzylorda",
              })}{" "}
              · версия {c.revision}
            </p>
            <label className="note-label">
              Мой тезис и заметки
              <textarea
                maxLength={6000}
                value={c.note}
                onChange={(e) =>
                  setEntries((rows) =>
                    rows.map((r) =>
                      r.ticker === c.ticker
                        ? { ...r, note: e.target.value }
                        : r,
                    ),
                  )
                }
              />
            </label>
            <button
              className="button secondary"
              disabled={Boolean(busy)}
              onClick={() => save(c)}
            >
              {busy === c.ticker ? "Сохраняю…" : "Сохранить заметку"}
            </button>
            <a
              className="text-link"
              href={"/api/company/" + c.ticker + "/brief"}
            >
              Research brief <Download size={16} aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
    </>
  );
}
