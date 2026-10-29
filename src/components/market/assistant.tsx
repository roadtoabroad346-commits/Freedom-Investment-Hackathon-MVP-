"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Send } from "lucide-react";
import { useAuth } from "../auth/provider";
import type { Workspace } from "@/lib/market/schema";
export function Assistant({ workspace }: { workspace?: Workspace }) {
  const { user } = useAuth();
  const [configured, setConfigured] = useState<boolean | null>(null),
    [question, setQuestion] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [answer, setAnswer] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/assistant")
      .then((r) => r.json())
      .then((j) => {
        if (active) setConfigured(j.configured === true);
      })
      .catch(() => {
        if (active) setError("Статус AI недоступен");
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setAnswer("");
    setQuestion("");
    setConsent(false);
    setError("");
  }, [user?.id]);
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setAnswer("");
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          tickers: ["ADBE", "PYPL", "NKE"],
          ...(consent && workspace ? { workspace } : {}),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setAnswer(j.text + "\n\n" + j.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка AI");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel assistant-panel">
      <div className="chart-heading">
        <div>
          <div className="eyebrow">
            <Sparkles size={16} aria-hidden="true" /> GEMINI RESEARCH ASSISTANT
          </div>
          <h2>От графика — к пониманию</h2>
          <p>
            Объяснения показателей, рисков и вопросов к бизнесу. 10 запросов в
            сутки UTC на аккаунт.
          </p>
        </div>
        <span className={`badge ${configured ? "green" : "neutral"}`}>
          {configured === null
            ? "Проверка подключения"
            : configured
              ? "Подключён"
              : "Ожидает подключения"}
        </span>
      </div>
      {!configured && configured !== null && (
        <p>
          Владелец проекта может включить помощника, настроив серверный ключ
          Gemini и модель. Графики, расчёты и Excel работают независимо от AI.
        </p>
      )}
      <form onSubmit={ask}>
        <label>
          Вопрос помощнику
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={1500}
            minLength={5}
            placeholder="Как оценить концентрацию портфеля? Какие показатели проверить у Adobe?"
            required
          />
        </label>
        {workspace && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Приложить сводку моего набора для передачи Google Gemini. Исходный
            файл не передаётся.
          </label>
        )}
        <div className="toolbar">
          <button
            className="button"
            disabled={!configured || !user || busy}
            type="submit"
          >
            <Send size={16} aria-hidden="true" />
            {busy ? "Готовлю ответ…" : "Получить объяснение"}
          </button>
          {!user && (
            <Link href="/account" className="text-link">
              Войти для работы с AI
            </Link>
          )}
        </div>
      </form>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {answer && (
        <div className="ai-answer" role="status">
          {answer}
        </div>
      )}
      <small className="muted">
        AI может ошибаться. Он не получает live feed и не исполняет сделки.
        Вопросы отправляются Google только по нажатию кнопки.
      </small>
    </section>
  );
}
