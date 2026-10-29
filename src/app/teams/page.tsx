"use client";
import { useState } from "react";
import Link from "next/link";
import { PageHead, Notice } from "@/components/ui";
import { useAuth } from "@/components/auth/provider";
export default function Teams() {
  const { user, configured } = useAuth();
  const [text, setText] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function download() {
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([`MIRROR X — запрос пилота\n${text}`], {
          type: "text/plain;charset=utf-8",
        }),
      );
    a.href = url;
    a.download = "MIRROR_X_pilot_request.txt";
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Файл подготовлен. Это локальная копия заявки.");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/pilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
          signal: AbortSignal.timeout(15000),
        }),
        x = await r.json();
      if (!r.ok) throw new Error(x.error ?? "Заявка не сохранена");
      setMessage(
        "Заявка сохранена в Supabase. Номер: " +
          x.id +
          ". Срок ответа владельца проекта не установлен.",
      );
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Сервис недоступен");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="FOR TEAMS / PILOT"
        title="Меньше поиска. Больше проверки."
        description="Для инвестиционных клубов, самостоятельных исследователей и небольших аналитических команд."
      />
      <div className="prose">
        <p>
          Гипотеза ценности: сократить время первичного отбора и сделать
          проверку расчётов воспроизводимой. Подтверждённых клиентов, выручки и
          измеренной экономии времени пока нет.
        </p>
        <Notice>
          {configured
            ? "Авторизованные пользователи могут сохранить заявку в базе. Письмо от вашего имени не отправляется."
            : "Облачный сервис не настроен; доступна локальная копия заявки."}
        </Notice>
        <form className="panel" onSubmit={submit}>
          <label>
            Что ваша команда хочет проверить?
            <textarea
              required
              minLength={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={6000}
              placeholder="Размер команды, текущий процесс, главный источник потерь времени…"
            />
          </label>
          <div className="downloads">
            {user && configured ? (
              <button
                className="button"
                disabled={busy || text.trim().length < 10}
                type="submit"
              >
                {busy ? "Сохраняю…" : "Сохранить заявку на пилот"}
              </button>
            ) : (
              <Link className="button" href="/account">
                Войти для отправки заявки
              </Link>
            )}
            <button
              type="button"
              className="button secondary"
              disabled={!text.trim()}
              onClick={download}
            >
              Скачать локальную копию
            </button>
          </div>
          {message && <p role="status">{message}</p>}
          {error && <p role="alert">{error}</p>}
        </form>
        <h2>Как оценить пилот</h2>
        <ol>
          <li>
            Выбрать одинаковый набор компаний для ручного и платформенного
            анализа.
          </li>
          <li>Сравнить время отбора, число ошибок и качество ссылок.</li>
          <li>
            Проверить готовность команды пользоваться продуктом повторно и
            платить за него.
          </li>
        </ol>
      </div>
    </>
  );
}
